import dgram from "node:dgram";
import streamDeck from "@elgato/streamdeck";
import {
	encodeFloat,
	encodeInt,
	isHeartbeat,
	parsePacket,
	type OscMessage,
	type OscValue,
} from "../osc/codec.js";

/**
 * A single long-lived connection to one TotalMix FX instance.
 *
 * This replaces the v3 design, which opened a fresh socket per state query, ran a
 * blocking receive loop, then closed and disposed it. That cost a socket lifecycle
 * per poll and — more importantly — meant nothing was bound to the port most of the
 * time, so any state TotalMix pushed spontaneously was missed. Which in turn forced
 * polling to compensate.
 *
 * Here the socket stays open for the lifetime of the plugin, every inbound message
 * updates a cache, and actions subscribe to the addresses they care about.
 */

export interface ConnectionOptions {
	/** Host running TotalMix FX. */
	host: string;
	/** TotalMix "Port incoming" — where we send. Default 7001. */
	sendPort: number;
	/** TotalMix "Port outgoing" — where we listen. Default 9001. */
	receivePort: number;
}

export const DEFAULT_OPTIONS: ConnectionOptions = {
	host: "127.0.0.1",
	sendPort: 7001,
	receivePort: 9001,
};

export type Listener = (value: OscValue) => void;

/** A view requirement: which bus/bank an action's data must belong to. */
export interface ViewRequirement {
	bus?: "input" | "playback" | "output";
	bank?: number;
}

/** Timing knobs, injectable so tests can run in milliseconds. */
export interface ConnectionTiming {
	/** Ms without any inbound packet before the connection is treated as stale. */
	staleMs: number;
	/** How often to re-check and re-assert when something is off. */
	refreshMs: number;
}

const DEFAULT_TIMING: ConnectionTiming = { staleMs: 5000, refreshMs: 2000 };

/**
 * Outbound rate limit. Dial rotation fires far faster than TotalMix needs to be
 * told; coalescing to one send per address per tick keeps the wire quiet without
 * any perceptible lag.
 */
const SEND_COALESCE_MS = 25;

export class TotalMixConnection {
	private socket: dgram.Socket | null = null;
	private options: ConnectionOptions = DEFAULT_OPTIONS;

	/**
	 * Non-positional state (mastervolume, mainDim, groups…): one value globally,
	 * because these mean the same thing in every view.
	 */
	private readonly globals = new Map<string, OscValue>();

	/**
	 * Positional state, retained PER VIEW. /1/volume3 under (playback, bank 0,
	 * submix Main) and under (input, bank 0, submix Main) are different faders;
	 * both values are kept, each under its own key. Switching views never
	 * destroys data — a dial parked on a non-current view keeps its last known
	 * value and its own bus's channel name.
	 */
	private readonly viewState = new Map<string, Map<string, OscValue>>();

	/**
	 * The view (bus + bank start) the positional page-1 addresses currently refer
	 * to. Page-1 keys like /1/volume3 mean "the third fader of the current view" —
	 * they are positions, not channels — so a cached value is only meaningful for
	 * the view it was captured under. undefined = unknown.
	 */
	private view: { bus?: "input" | "playback" | "output"; bank?: number; submix?: string } = {};

	/** Address -> subscribers. Actions are woken only for what they asked for. */
	private readonly listeners = new Map<string, Set<Listener>>();

	/** Pending outbound values, flushed on a timer so dials cannot flood the wire. */
	private readonly pending = new Map<string, number>();
	private flushTimer: NodeJS.Timeout | null = null;

	private refreshTimer: NodeJS.Timeout | null = null;
	private lastInbound = 0;
	private connectedFlag = false;

	/**
	 * True once at least one real (non-heartbeat) message has arrived. TotalMix
	 * sends heartbeats even when a refresh request was lost — e.g. when the
	 * plugin started before TotalMix was ready — so "packets are arriving" must
	 * not be mistaken for "the cache is populated". Until this is true, the
	 * timer keeps re-requesting the page dump.
	 */
	private primed = false;

	/** Views actions have declared they need, each primed once at startup. */
	private readonly primeQueue: ViewRequirement[] = [];
	private readonly primedViews = new Set<string>();
	private primeTimer: NodeJS.Timeout | null = null;

	private readonly timing: ConnectionTiming;

	constructor(timing: Partial<ConnectionTiming> = {}) {
		this.timing = { ...DEFAULT_TIMING, ...timing };
	}
	private page: 1 | 2 | 3 | 4 = 1;
	private loggedFirstInbound = false;

	private readonly connectionListeners = new Set<(connected: boolean) => void>();

	get connected(): boolean {
		return this.connectedFlag;
	}

	get options_(): Readonly<ConnectionOptions> {
		return this.options;
	}

	/**
	 * Opens the socket, or reopens it if the port changed. Safe to call repeatedly —
	 * every action calls it on appear.
	 */
	async connect(options: Partial<ConnectionOptions> = {}): Promise<void> {
		// Defensive coercion: settings from the property inspector arrive as
		// strings, and a string port must not register as a port *change*.
		const next = {
			host: options.host !== undefined ? String(options.host) : this.options.host,
			sendPort: options.sendPort !== undefined ? Number(options.sendPort) : this.options.sendPort,
			receivePort:
				options.receivePort !== undefined ? Number(options.receivePort) : this.options.receivePort,
		};

		if (!Number.isFinite(next.sendPort) || !Number.isFinite(next.receivePort)) {
			streamDeck.logger.error(
				`Ignoring invalid ports (send=${String(options.sendPort)}, receive=${String(options.receivePort)})`,
			);
			return;
		}
		const portChanged = this.socket !== null && next.receivePort !== this.options.receivePort;

		this.options = next;

		if (this.socket !== null && !portChanged) {
			return;
		}

		if (portChanged) {
			this.closeSocket();
		}

		await this.openSocket();
		this.startRefreshTimer();
		this.requestFullRefresh();
	}

	private openSocket(): Promise<void> {
		return new Promise((resolve) => {
			const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

			socket.on("message", (buf) => this.handlePacket(buf));

			socket.on("error", (err) => {
				streamDeck.logger.error(`OSC socket error: ${err.message}`);
				// Do not rethrow: an unhandled error here would take the plugin down.
				this.setConnected(false);
				this.closeSocket();
			});

			socket.on("listening", () => {
				streamDeck.logger.info(
					`Listening for TotalMix on udp/${this.options.receivePort}, ` +
						`sending to ${this.options.host}:${this.options.sendPort}`,
				);
				resolve();
			});

			try {
				socket.bind(this.options.receivePort);
				this.socket = socket;
			} catch (err) {
				streamDeck.logger.error(`Could not bind udp/${this.options.receivePort}: ${err}`);
				resolve();
			}
		});
	}

	private handlePacket(buf: Buffer): void {
		const messages = parsePacket(buf);
		if (messages.length === 0) return;

		const now = Date.now();
		// Inbound resuming after a long gap usually means TotalMix restarted; its
		// state and the slot's page are then unknown, so the cache must be
		// re-primed even though packets are flowing again.
		const resumedAfterGap = this.lastInbound !== 0 && now - this.lastInbound > this.timing.staleMs;
		const hasData = messages.some((m) => !isHeartbeat(m));

		if (hasData) {
			this.primed = true;
		} else if (resumedAfterGap) {
			this.primed = false;
			this.requestFullRefresh();
		}

		// One-shot diagnostic: proves inbound OSC is arriving and shows what page
		// TotalMix is actually mirroring. Without this, "no feedback" and "wrong
		// page selected" look identical from the outside.
		if (!this.loggedFirstInbound) {
			this.loggedFirstInbound = true;
			const sample = messages.slice(0, 8).map((m) => m.address).join(", ");
			streamDeck.logger.info(
				`First inbound OSC: ${messages.length} message(s). Sample: ${sample}`,
			);
		}

		this.lastInbound = now;
		this.setConnected(true);

		for (const m of messages) {
			this.applyMessage(m);
		}
	}

	private applyMessage(m: OscMessage): void {
		if (isHeartbeat(m)) return;

		// TotalMix reports the active bus as busX = 1.0. That is authoritative:
		// when it differs from what we thought, the view moved underneath us
		// (e.g. the dump for another action's pin), so positional cache captured
		// before this message no longer describes these positions.
		// Submix is a third view dimension: verified in a capture, selecting a
		// different submix in the GUI re-sends every volumeN as that submix's send
		// level. Same positions, entirely different meaning.
		if (m.address === "/1/labelSubmix" && typeof m.value === "string") {
			// Key component only: each submix retains its own slice.
			this.view.submix = m.value;
		}

		if (m.address === "/1/busInput" || m.address === "/1/busPlayback" || m.address === "/1/busOutput") {
			const bus =
				m.address === "/1/busInput" ? "input" : m.address === "/1/busPlayback" ? "playback" : "output";
			const active = typeof m.value === "number" ? m.value >= 0.5 : m.value === true;
			if (active) this.view.bus = bus;
		}

		const positional = TotalMixConnection.POSITIONAL.test(m.address);
		const store = positional ? this.viewMap(this.viewKey()) : this.globals;

		const previous = store.get(m.address);
		if (previous === m.value) return; // unchanged; do not wake subscribers

		store.set(m.address, m.value);

		const subs = this.listeners.get(m.address);
		if (subs === undefined) return;

		for (const fn of subs) {
			try {
				fn(m.value);
			} catch (err) {
				// One misbehaving action must not stop the others being updated.
				streamDeck.logger.error(`Listener for ${m.address} threw: ${err}`);
			}
		}
	}

	/** Current cached value for an address, or undefined if never received. */
	get(address: string, req?: ViewRequirement | null): OscValue | undefined {
		if (TotalMixConnection.POSITIONAL.test(address)) {
			return this.viewState.get(this.viewKey(req))?.get(address);
		}
		return this.globals.get(address);
	}

	getNumber(address: string, fallback = 0, req?: ViewRequirement | null): number {
		const v = this.get(address, req);
		return typeof v === "number" ? v : typeof v === "boolean" ? (v ? 1 : 0) : fallback;
	}

	getString(address: string, req?: ViewRequirement | null): string | undefined {
		const v = this.get(address, req);
		return typeof v === "string" ? v : undefined;
	}

	/**
	 * Subscribes to an address. Returns an unsubscribe function — call it from the
	 * action's onWillDisappear, or listeners accumulate as profiles switch.
	 */
	subscribe(address: string, listener: Listener): () => void {
		let subs = this.listeners.get(address);
		if (subs === undefined) {
			subs = new Set();
			this.listeners.set(address, subs);
		}
		subs.add(listener);

		// Deliver the cached value immediately so a button that has just appeared
		// renders correctly instead of waiting for the next change.
		const cached = this.get(address);
		if (cached !== undefined) {
			queueMicrotask(() => listener(cached));
		}

		return () => {
			const set = this.listeners.get(address);
			if (set === undefined) return;
			set.delete(listener);
			if (set.size === 0) this.listeners.delete(address);
		};
	}

	onConnectionChange(listener: (connected: boolean) => void): () => void {
		this.connectionListeners.add(listener);
		listener(this.connectedFlag);
		return () => this.connectionListeners.delete(listener);
	}

	private setConnected(connected: boolean): void {
		if (this.connectedFlag === connected) return;
		this.connectedFlag = connected;
		for (const fn of this.connectionListeners) {
			try {
				fn(connected);
			} catch {
				/* ignore */
			}
		}
	}

	/**
	 * Sends immediately, bypassing coalescing. Use for discrete events — toggles,
	 * navigation, snapshot recall — where every message is meaningful.
	 */
	send(address: string, value: number): void {
		// Every discrete command is logged: a key press must leave a trace, so
		// "nothing happened" is diagnosable from the log alone.
		streamDeck.logger.debug(`OSC out: ${address} = ${value}`);
		this.trackViewChange(address, value);
		this.sendBuffer(encodeFloat(address, Number(value)));
	}

	/**
	 * Detects outbound commands that move the shared view and invalidates every
	 * positional cache entry when they fire. Without this, values captured under
	 * one view get read back as if they belonged to another — which is how a dial
	 * ends up displaying (and, worse, stepping from) a different channel's fader.
	 */
	private trackViewChange(address: string, value: number): void {
		switch (address) {
			case "/1/busInput":
				this.view.bus = "input";
				return;
			case "/1/busPlayback":
				this.view.bus = "playback";
				return;
			case "/1/busOutput":
				this.view.bus = "output";
				return;
			case "/setBankStart":
				this.view.bank = value;
				return;
			case "/1/bank+":
			case "/1/bank-":
			case "/1/track+":
			case "/1/track-":
				// Moves the bank by an amount we can't know: a "?"-bank slice
				// would mix two real banks, so drop it rather than retain it.
				this.view.bank = undefined;
				this.viewState.delete(this.viewKey());
				return;
			case "/setSubmix":
				// The resulting dump carries labelSubmix, which re-keys the slice.
				return;
		}
	}

	private static readonly POSITIONAL =
		/^\/1\/(?:(?:volume|pan|micgain|trackname)\d+(?:Val)?|(?:mute|solo|phantom|cue|select)\/1\/\d+)$/;

	/** Drops all per-view state, e.g. after TotalMix restarted underneath us. */
	private invalidateBankView(): void {
		this.viewState.clear();
	}

	/** Cache key for a view; unknown components render as "?". */
	private viewKey(req?: ViewRequirement | null): string {
		const bus = req?.bus ?? this.view.bus ?? "?";
		const bank = req?.bank ?? this.view.bank ?? "?";
		const submix = this.view.submix ?? "?";
		return `${bus}:${bank}:${submix}`;
	}

	private viewMap(key: string): Map<string, OscValue> {
		let m = this.viewState.get(key);
		if (m === undefined) {
			m = new Map();
			this.viewState.set(key, m);
		}
		return m;
	}

	/**
	 * Whether the current view matches the given requirements. Unknown view
	 * counts as a mismatch when a requirement is stated — showing nothing is
	 * better than showing another channel's data.
	 */
	/**
	 * Declares that some action needs data for this view. Each required view is
	 * visited exactly once after the connection comes up — bus and bank asserted,
	 * dump collected into that view's slice — so every dial has its own data
	 * prefilled at startup instead of waiting for its first gesture. Visits are
	 * SERIAL, replacing the old appear-time pin scramble where several actions
	 * raced each other for the slot.
	 */
	requireView(req: ViewRequirement): void {
		if (req.bus === undefined && req.bank === undefined) return;
		const key = `${req.bus ?? "?"}:${req.bank ?? "?"}`;
		if (this.primedViews.has(key)) return;
		this.primedViews.add(key);
		this.primeQueue.push(req);
		this.schedulePrimeVisit();
	}

	private static readonly BUS_ADDRESS = {
		input: "/1/busInput",
		playback: "/1/busPlayback",
		output: "/1/busOutput",
	} as const;

	private schedulePrimeVisit(): void {
		if (this.primeTimer !== null || this.primeQueue.length === 0) return;
		// 400ms per visit: a full page dump takes ~80ms in captures; this gives
		// each view's dump room to land before the next select moves the slot.
		this.primeTimer = setTimeout(() => {
			this.primeTimer = null;
			if (!this.primed) {
				// Nothing has arrived at all yet — let the startup refresh land
				// first, then resume visiting.
				this.schedulePrimeVisit();
				return;
			}
			const req = this.primeQueue.shift();
			if (req !== undefined) {
				if (req.bus !== undefined) this.send(TotalMixConnection.BUS_ADDRESS[req.bus], 1.0);
				if (req.bank !== undefined) this.send("/setBankStart", req.bank);
			}
			this.schedulePrimeVisit();
		}, 400);
		this.primeTimer.unref?.();
	}

	viewMatches(req: { bus?: "input" | "playback" | "output"; bank?: number }): boolean {
		if (req.bus !== undefined && this.view.bus !== req.bus) return false;
		if (req.bank !== undefined && this.view.bank !== req.bank) return false;
		return true;
	}

	sendInt(address: string, value: number): void {
		this.sendBuffer(encodeInt(address, value));
	}

	/**
	 * Queues a continuous value, coalescing repeats to the same address. Use for
	 * dial rotation and fader drags, where only the latest value matters.
	 */
	sendCoalesced(address: string, value: number): void {
		this.pending.set(address, value);

		// Optimistically update the cache so a fast dial reads back its own latest
		// position rather than a stale one while TotalMix catches up.
		(TotalMixConnection.POSITIONAL.test(address) ? this.viewMap(this.viewKey()) : this.globals).set(
			address,
			value,
		);

		if (this.flushTimer !== null) return;

		this.flushTimer = setTimeout(() => {
			this.flushTimer = null;
			const batch = [...this.pending];
			this.pending.clear();
			for (const [addr, v] of batch) {
				this.sendBuffer(encodeFloat(addr, v));
			}
		}, SEND_COALESCE_MS);
	}

	/**
	 * Flips a kOSCScaleToggle parameter. Sends 1.0 and lets TotalMix report the
	 * resulting state — no read-modify-write, so no race with the GUI.
	 */
	toggle(address: string): void {
		this.send(address, 1.0);
	}

	private sendBuffer(buf: Buffer): void {
		const socket = this.socket;
		if (socket === null) {
			streamDeck.logger.warn("OSC send skipped: socket not open");
			return;
		}

		// send() can throw synchronously (e.g. a socket caught mid-close). A throw
		// here would propagate into the key handler and kill the press with no
		// visible symptom, so it must be contained and logged.
		try {
			socket.send(buf, this.options.sendPort, this.options.host, (err) => {
				if (err) streamDeck.logger.error(`OSC send failed: ${err.message}`);
			});
		} catch (err) {
			streamDeck.logger.error(`OSC send threw: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	/**
	 * Asks TotalMix to re-send the parameters of one page.
	 *
	 * Per RME's spec, sending any parameter carrying a page number makes TotalMix
	 * re-send every parameter of that page — and, critically, *selects* that page
	 * for this remote controller slot. A slot mirrors exactly one page at a time.
	 *
	 * So this must touch a single page and stay there. Cycling 1..4 would leave the
	 * slot parked on page 4, and nothing on page 1 (faders, mutes, main volume)
	 * would ever arrive.
	 *
	 * Value 0.0 is inert on a kOSCScaleToggle address — only 1.0 flips it — so this
	 * refreshes without changing anything.
	 */
	/**
	 * One verified kOSCScaleToggle address per page (0.0 is inert on toggles).
	 * globalMute only exists on pages 1 and 3 — an earlier version sent
	 * /2/globalMute, which is not in RME's table and may be dropped entirely,
	 * silently weakening the refresh. Verified against osc-spec.json.
	 */
	private static readonly PAGE_TOUCH: Record<1 | 2 | 3 | 4, string> = {
		1: "/1/globalMute",
		2: "/2/mute",
		3: "/3/globalMute",
		4: "/4/reqEnable",
	};

	requestFullRefresh(): void {
		// RME's spec: the full re-send fires when a parameter carries a NEW page
		// number. If the slot is already on our page, touching it is a no-op — so
		// force a transition: step onto a neighbouring page, then back. Each hop
		// triggers that page's re-send; the second lands us home with fresh state.
		const away = this.page === 1 ? 2 : 1;
		this.send(TotalMixConnection.PAGE_TOUCH[away], 0.0);
		this.send(TotalMixConnection.PAGE_TOUCH[this.page], 0.0);
	}

	/**
	 * Selects which page this connection mirrors. Page 1 is the mixer (faders,
	 * mutes, main out) and is what most actions need.
	 */
	setPage(page: 1 | 2 | 3 | 4): void {
		if (this.page === page) return;
		this.page = page;
		this.requestFullRefresh();
	}

	private startRefreshTimer(): void {
		if (this.refreshTimer !== null) return;

		this.refreshTimer = setInterval(() => {
			const silent = Date.now() - this.lastInbound;

			if (silent > this.timing.staleMs) {
				if (this.connectedFlag) {
					streamDeck.logger.warn(
						`No OSC from TotalMix for ${Math.round(silent / 1000)}s — re-requesting page ${this.page}.`,
					);
				}
				this.setConnected(false);
				// TotalMix may have restarted, or OSC may have been re-enabled.
				// Re-asserting the page is cheap and re-establishes the stream.
				this.requestFullRefresh();
			} else if (!this.primed) {
				// Packets (heartbeats) are arriving but no state has: the initial
				// refresh was lost — most commonly the plugin started before
				// TotalMix finished booting. Keep asking until real data lands;
				// once primed this branch never runs again, so idle stays quiet.
				this.requestFullRefresh();
			}
		}, this.timing.refreshMs);

		// Do not hold the process open on this timer alone.
		this.refreshTimer.unref?.();
	}

	private closeSocket(): void {
		if (this.socket === null) return;
		try {
			this.socket.close();
		} catch {
			/* already closed */
		}
		this.socket = null;
	}

	/** Releases everything. Called on plugin shutdown. */
	dispose(): void {
		if (this.flushTimer !== null) clearTimeout(this.flushTimer);
		if (this.refreshTimer !== null) clearInterval(this.refreshTimer);
		if (this.primeTimer !== null) clearTimeout(this.primeTimer);
		this.primeTimer = null;
		this.flushTimer = null;
		this.refreshTimer = null;
		this.listeners.clear();
		this.connectionListeners.clear();
		this.globals.clear();
		this.viewState.clear();
		this.closeSocket();
	}
}

/**
 * Connection pool, one entry per TotalMix Remote Controller slot.
 *
 * TotalMix mirrors exactly one view (bus + bank + page) per remote controller —
 * that is a hard protocol limit, not ours. But it offers FOUR independent slots.
 * By keying connections on their port pair, actions configured with different
 * ports get genuinely independent views: a gain dial on slot 2 (7002/9002) can
 * sit parked on the input bus while volume dials on slot 1 stay on playback,
 * both with live feedback, neither stealing the other's view.
 *
 * Actions with the same (default) ports share one connection, exactly as before.
 */
const pool = new Map<string, TotalMixConnection>();

export function totalMixFor(options: ConnectionOptions): TotalMixConnection {
	const key = `${options.host}:${options.sendPort}:${options.receivePort}`;
	let conn = pool.get(key);
	if (conn === undefined) {
		conn = new TotalMixConnection();
		pool.set(key, conn);
	}
	// connect() is idempotent per instance; fire-and-forget keeps call sites sync.
	void conn.connect(options);
	return conn;
}

/** Releases every pooled connection. Called on plugin shutdown. */
export function disposeAll(): void {
	for (const conn of pool.values()) {
		conn.dispose();
	}
	pool.clear();
}

/** Default-slot connection, kept for tests and as the pool's slot-1 entry. */
export const totalMix = new TotalMixConnection();
pool.set(`${DEFAULT_OPTIONS.host}:${DEFAULT_OPTIONS.sendPort}:${DEFAULT_OPTIONS.receivePort}`, totalMix);
