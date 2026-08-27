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
import { pageOf } from "./addresses.js";

/**
 * A single long-lived connection to one TotalMix FX instance.
 *
 * The socket stays bound for the lifetime of the plugin, every inbound message
 * updates a cache, and actions subscribe to the addresses they read.
 */

export interface ConnectionOptions {
	/** Host running TotalMix FX. */
	host: string;
	/** TotalMix "Port incoming" — the destination port. Default 7001. */
	sendPort: number;
	/** TotalMix "Port outgoing" — the bound receive port. Default 9001. */
	receivePort: number;
}

/** TotalMix's factory settings for Remote Controller slot 1. */
export const DEFAULT_OPTIONS: ConnectionOptions = {
	host: "127.0.0.1",
	sendPort: 7001,
	receivePort: 9001,
};

/** Called with the new value whenever a subscribed address changes. */
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

/** Outbound flush interval: one send per address per tick. */
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
	 * Positional state, retained per view. /1/volume3 under (playback, bank 0,
	 * submix Main) and under (input, bank 0, submix Main) are different faders;
	 * both values are kept, each under its own key. A view change adds a slice
	 * rather than replacing one, so a read for a non-current view still
	 * resolves.
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

	/** Pending return to the slot's own page after an off-page command. */
	private restoreTimer: NodeJS.Timeout | null = null;

	private refreshTimer: NodeJS.Timeout | null = null;
	private lastInbound = 0;
	private connectedFlag = false;

	/**
	 * True once at least one non-heartbeat message has arrived. TotalMix sends
	 * heartbeats regardless of whether a refresh request was received, so
	 * inbound traffic alone does not imply a populated cache. While false, the
	 * refresh timer re-requests the page dump.
	 */
	private primed = false;

	/** Views actions have declared they need, each primed once at startup. */
	private readonly primeQueue: ViewRequirement[] = [];
	private readonly primedViews = new Set<string>();

	/**
	 * Every view an action has required, kept for the connection's lifetime.
	 *
	 * Page-1 addressing is control-element oriented with dynamic mapping to
	 * channels depending on bank assignment, not fixed per channel: /1/mute/1/1
	 * means strip 1 of the currently selected bus and bank. A slot selects one
	 * view at a time, so a refresh carries values for that view only.
	 */
	private readonly knownViews: ViewRequirement[] = [];
	private primeTimer: NodeJS.Timeout | null = null;

	private readonly timing: ConnectionTiming;

	constructor(timing: Partial<ConnectionTiming> = {}) {
		this.timing = { ...DEFAULT_TIMING, ...timing };
	}

	/**
	 * The page this slot mirrors. Page 1 (the mixer) is what nearly everything
	 * needs; off-page commands hop away and come back rather than changing this.
	 */
	private page: 1 | 2 | 3 | 4 = 1;

	/** Guards the one-shot "first inbound" diagnostic in handlePacket. */
	private loggedFirstInbound = false;

	/**
	 * Guards the one-shot re-request issued once the slot's view becomes known.
	 * Cleared whenever the per-view cache is dropped, so a TotalMix restart or a
	 * reconnect goes through the same sequence again.
	 */
	private revealedView = false;
	private revealTimer: NodeJS.Timeout | null = null;

	/**
	 * Addresses seen at least once, for the per-address arrival diagnostic.
	 *
	 * TotalMix streams only the parameters of the page and view its slot is
	 * mirroring, so "a button does not follow the mixer" has two very different
	 * causes: the address never arrives, or it arrives and is filed under a view
	 * the action does not read. Logging first arrival separates them.
	 */
	private readonly seenAddresses = new Set<string>();

	/** Connection up/down subscribers, separate from per-address listeners. */
	private readonly connectionListeners = new Set<(connected: boolean) => void>();

	/** True while inbound OSC is arriving; see setConnected for the transitions. */
	get connected(): boolean {
		return this.connectedFlag;
	}

	/**
	 * The resolved host and ports, after the string coercion connect() applies.
	 * Trailing underscore avoids colliding with the private `options` field.
	 */
	get options_(): Readonly<ConnectionOptions> {
		return this.options;
	}

	/**
	 * Opens the socket, or reopens it if the receive port changed. Idempotent;
	 * called by every action on appear.
	 */
	async connect(options: Partial<ConnectionOptions> = {}): Promise<void> {
		// Property inspector settings arrive as strings; coerced here so a
		// string port does not register as a port change.
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

	/**
	 * Binds the receive port. Resolves on "listening", and also on a bind
	 * failure, so connect() settles either way.
	 */
	private openSocket(): Promise<void> {
		return new Promise((resolve) => {
			// No reuseAddr: on UDP it permits two sockets on one port, with only
			// one of them receiving traffic. Without it, a taken port raises
			// EADDRINUSE in the error handler below.
			const socket = dgram.createSocket({ type: "udp4" });

			socket.on("message", (buf) => this.handlePacket(buf));

			socket.on("error", (err) => {
				const inUse = (err as NodeJS.ErrnoException).code === "EADDRINUSE";
				streamDeck.logger.error(
					inUse
						? `OSC: udp/${this.options.receivePort} is already in use — ` +
							`check that no other program (or the Global OSC slot) listens on this port.`
						: `OSC socket error: ${err.message}`,
				);
				// Do not rethrow: an unhandled error here would take the plugin down.
				this.setConnected(false);
				this.closeSocket();
				// Bind failures arrive on this event rather than as a synchronous
				// throw, so the promise is settled here as well.
				resolve();
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

	/**
	 * Entry point for every inbound datagram: refreshes the liveness clock, then
	 * applies each message. A malformed packet parses to no messages and is
	 * dropped without altering the connection state.
	 */
	private handlePacket(buf: Buffer): void {
		const messages = parsePacket(buf);
		if (messages.length === 0) return;

		const now = Date.now();
		// Inbound resuming after a gap longer than staleMs indicates a TotalMix
		// restart: the slot's page and state are unknown, so the cache is
		// re-primed even though packets are arriving.
		const resumedAfterGap = this.lastInbound !== 0 && now - this.lastInbound > this.timing.staleMs;
		const hasData = messages.some((m) => !isHeartbeat(m));

		if (hasData) {
			this.primed = true;
		} else if (resumedAfterGap) {
			this.primed = false;
			this.requestFullRefresh();
		}

		// One-shot diagnostic: records that inbound OSC arrived and which page
		// TotalMix is mirroring.
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

	/**
	 * Re-requests the page once the slot's bus and submix are first known.
	 *
	 * The first dump after connecting is the one that reveals them, and a
	 * positional value is filed under the view current at the moment it arrives.
	 * Anything in that dump preceding the busX and labelSubmix messages is
	 * therefore filed under the placeholder "?" view, which no action reads once
	 * the real view is known — so those buttons sit blank until something moves
	 * the slot and provokes a fresh dump, which is why a press or a turn appeared
	 * to be required before a button would track the mixer.
	 *
	 * The second dump costs two datagrams and lands entirely under the real view,
	 * because by then it is known regardless of message order. Filing wakes the
	 * subscribers, so every button repaints from it without any of them knowing
	 * this happened.
	 */
	private onViewMaybeRevealed(): void {
		if (this.revealedView) return;
		if (this.view.bus === undefined && this.view.submix === undefined) return;

		this.revealedView = true;
		if (this.revealTimer !== null) clearTimeout(this.revealTimer);

		// Deferred so the dump that revealed the view finishes first: a refresh
		// sent mid-dump would move the slot while values were still arriving.
		this.revealTimer = setTimeout(() => {
			this.revealTimer = null;
			streamDeck.logger.info(
				`View known (${this.viewKey()}); re-requesting page ${this.page} so values file under it.`,
			);
			this.requestFullRefresh();
		}, TotalMixConnection.REVEAL_REFRESH_MS);
		this.revealTimer.unref?.();
	}

	/** Long enough for a page dump (about 80 ms) to finish before the slot moves. */
	private static readonly REVEAL_REFRESH_MS = 400;

	/**
	 * Addresses worth a log line on first arrival even when nothing is listening:
	 * the mute and solo flags that drive a dial's wash, and anything on page 2.
	 * A page-2 address arriving at all is itself notable, since the slot mirrors
	 * page 1 and TotalMix sends only the mirrored page.
	 */
	private static readonly DIAGNOSTIC = /^\/(?:1\/(?:mute|solo)\/1\/\d+|2\/)/;

	/**
	 * Logs the first time each address is seen, at info so it survives the default
	 * log level.
	 *
	 * Bounded two ways: once per address, and only for addresses something is
	 * subscribed to or that DIAGNOSTIC names. A button that does not follow the
	 * mixer has two very different causes — the address never arrives, or it
	 * arrives and is filed under a view the action does not read — and the view
	 * key and listener count here separate them.
	 */
	private logFirstArrival(m: OscMessage, positional: boolean): void {
		if (this.seenAddresses.has(m.address)) return;

		const listeners = this.listeners.get(m.address)?.size ?? 0;
		if (listeners === 0 && !TotalMixConnection.DIAGNOSTIC.test(m.address)) return;

		this.seenAddresses.add(m.address);
		streamDeck.logger.info(
			`First arrival: ${m.address} = ${String(m.value)}, ` +
				`${positional ? `view ${this.viewKey()}` : "global"}, ${listeners} listener(s)`,
		);
	}

	/**
	 * Files one message into the right cache and wakes its subscribers.
	 *
	 * Order matters: the view-tracking addresses (labelSubmix, busX) are read
	 * first, so a dump that begins by announcing its view has the rest of its
	 * messages stored under that view rather than the previous one.
	 */
	private applyMessage(m: OscMessage): void {
		if (isHeartbeat(m)) return;

		// TotalMix reports the active bus as busX = 1.0, and the active submix as
		// /1/labelSubmix. Both are view dimensions: selecting another submix
		// re-sends every volumeN as that submix's send level, so the same
		// positional addresses carry different values per submix.
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

		this.onViewMaybeRevealed();

		const positional = TotalMixConnection.POSITIONAL.test(m.address);
		const store = positional ? this.viewMap(this.viewKey()) : this.globals;

		const previous = store.get(m.address);
		if (previous === m.value) return; // unchanged; do not wake subscribers

		this.logFirstArrival(m, positional);

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

	/**
	 * Current cached value for an address, or undefined if never received.
	 *
	 * For positional addresses `req` picks which view's retained slice to read.
	 * Passing it lets an action see its own bus's data while the slot is parked
	 * elsewhere; omitting it reads whatever view is current, which is only
	 * correct for addresses that mean the same thing everywhere.
	 */
	get(address: string, req?: ViewRequirement | null): OscValue | undefined {
		if (TotalMixConnection.POSITIONAL.test(address)) {
			return this.viewState.get(this.viewKey(req))?.get(address);
		}
		return this.globals.get(address);
	}

	/**
	 * Numeric read. Booleans collapse to 1/0 because TotalMix sends some on/off
	 * parameters as OSC booleans and others as floats for the same concept.
	 */
	getNumber(address: string, fallback = 0, req?: ViewRequirement | null): number {
		const v = this.get(address, req);
		return typeof v === "number" ? v : typeof v === "boolean" ? (v ? 1 : 0) : fallback;
	}

	/**
	 * String read, for labels and the "...Val" display strings. Returns
	 * undefined rather than coercing, so callers can fall back deliberately.
	 */
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

	/**
	 * Subscribes to connection up/down. Fires immediately with the current state
	 * so a button appearing on a dead connection renders its placeholder at once
	 * instead of waiting for the next transition. Returns an unsubscribe.
	 */
	onConnectionChange(listener: (connected: boolean) => void): () => void {
		this.connectionListeners.add(listener);
		listener(this.connectedFlag);
		return () => this.connectionListeners.delete(listener);
	}

	/** Notifies on transitions only, so idle traffic does not re-render every key. */
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
		// Every discrete command is logged, so a key press leaves a trace.
		streamDeck.logger.debug(`OSC out: ${address} = ${value}`);
		this.trackViewChange(address, value);
		this.sendBuffer(encodeFloat(address, Number(value)));
	}

	/**
	 * Sends a command belonging to another page, then returns the slot to its own
	 * page.
	 *
	 * Any parameter carrying a page number selects that page for the slot, so an
	 * off-page command leaves the connection mirroring that page and stops
	 * updates for every address on the slot's own page.
	 *
	 * The return is deferred so the command is processed before the page moves,
	 * and so a burst of sends (a dial spun through an FX parameter) costs one
	 * page dump rather than one per detent.
	 */
	sendOffPage(address: string, value: number): void {
		const page = pageOf(address);
		this.send(address, value);

		if (page === this.page) return;

		if (this.restoreTimer !== null) clearTimeout(this.restoreTimer);
		this.restoreTimer = setTimeout(() => {
			this.restoreTimer = null;
			streamDeck.logger.debug(`Returning slot to page ${this.page} after a page-${page} command.`);
			// A snapshot recall changes the mixer without emitting individual
			// parameter updates, so values are re-requested. A full refresh
			// forces the page transition that triggers the re-send.
			this.requestFullRefresh();
			// The refresh returns only the selected bus; a snapshot changes all.
			this.revisitViews();
		}, TotalMixConnection.PAGE_RESTORE_MS);
	}

	/**
	 * Tracks outbound commands that move the shared view, so positional cache
	 * entries are read back under the view they were captured in.
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
				// Relative moves by an unknown amount: the resulting "?"-bank
				// slice would merge two real banks, so it is dropped.
				this.view.bank = undefined;
				this.viewState.delete(this.viewKey());
				return;
			case "/setSubmix":
				// The resulting dump carries labelSubmix, which re-keys the slice.
				return;
		}
	}

	/**
	 * Addresses whose meaning depends on the current view, and which therefore
	 * belong in a per-view slice rather than the global map.
	 *
	 * These are the page-1 strip parameters: /1/volume3 is "the third fader of
	 * whatever bus and bank the slot is showing", not a fixed channel. Two
	 * families appear, matching RME's own two address shapes — indexed
	 * (volume3, trackname3, and their "Val" display twins) and matrix-style
	 * (mute/1/3, where the middle number is the row).
	 *
	 * Everything not matched here — mastervolume, mainDim, group states — means
	 * the same thing in every view and is stored globally. The pattern is
	 * anchored at both ends and matches whole addresses only.
	 */
	private static readonly POSITIONAL =
		/^\/1\/(?:(?:volume|pan|micgain|trackname)\d+(?:Val)?|(?:mute|solo|phantom|cue|select)\/1\/\d+)$/;

	/** Drops all per-view state, for use after a TotalMix restart. */
	private invalidateBankView(): void {
		this.viewState.clear();
		// The next dump has to reveal the view again, and be followed again.
		this.revealedView = false;
	}

	/**
	 * Cache key for a view: bus, bank and submix, the three dimensions that
	 * change what a positional address refers to.
	 *
	 * Components of `req` override the current view, which is how a read reaches
	 * another view's slice. Unknown components render as "?" and key their own
	 * slice, keeping data captured before the view was known separate from a
	 * real view's slice.
	 */
	private viewKey(req?: ViewRequirement | null): string {
		const bus = req?.bus ?? this.view.bus ?? "?";
		const bank = req?.bank ?? this.view.bank ?? "?";
		const submix = this.view.submix ?? "?";
		return `${bus}:${bank}:${submix}`;
	}

	/** The slice for a view key, created on first write. */
	private viewMap(key: string): Map<string, OscValue> {
		let m = this.viewState.get(key);
		if (m === undefined) {
			m = new Map();
			this.viewState.set(key, m);
		}
		return m;
	}

	/**
	 * Declares that an action needs data for this view. Each required view is
	 * visited once after the connection comes up: bus and bank are asserted and
	 * the resulting dump is collected into that view's slice, so an action holds
	 * its own data before its first gesture. Visits run serially.
	 */
	requireView(req: ViewRequirement): void {
		if (req.bus === undefined && req.bank === undefined) return;
		const key = `${req.bus ?? "?"}:${req.bank ?? "?"}`;
		if (this.primedViews.has(key)) return;
		this.primedViews.add(key);
		this.knownViews.push(req);
		this.primeQueue.push(req);
		this.schedulePrimeVisit();
	}

	/** Bus name to the page-1 address that selects it, for the prime walk. */
	private static readonly BUS_ADDRESS = {
		input: "/1/busInput",
		playback: "/1/busPlayback",
		output: "/1/busOutput",
	} as const;

	/**
	 * Queues every known view for a visit, refreshing each view's cached slice.
	 * Visits are spaced by the prime interval, as at startup.
	 */
	private revisitViews(): void {
		if (this.knownViews.length === 0) return;
		for (const req of this.knownViews) this.primeQueue.push(req);
		this.schedulePrimeVisit();
	}

	/**
	 * Runs the prime queue one view at a time, rescheduling itself until it
	 * drains. Each visit moves the shared slot, so visits must not overlap: a
	 * second select landing during the first visit's dump would file those
	 * values under the wrong view.
	 *
	 * The single timer also serves as the "walk in progress" flag, so callers
	 * can queue work and call this unconditionally.
	 */
	private schedulePrimeVisit(): void {
		if (this.primeTimer !== null || this.primeQueue.length === 0) return;
		// 400 ms per visit: a full page dump takes about 80 ms, so each dump
		// completes before the next select moves the slot.
		this.primeTimer = setTimeout(() => {
			this.primeTimer = null;
			if (!this.primed) {
				// No state has arrived yet; the startup refresh is still
				// outstanding, so the walk waits and reschedules.
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

	/**
	 * Whether the current view matches the given requirements. An unknown view
	 * counts as a mismatch when a requirement is stated.
	 *
	 * Callers use this to decide whether a write needs the view pinned first;
	 * reads should instead pass the requirement to get()/getNumber(), which
	 * reach that view's retained slice without moving the slot.
	 */
	viewMatches(req: { bus?: "input" | "playback" | "output"; bank?: number }): boolean {
		if (req.bus !== undefined && this.view.bus !== req.bus) return false;
		if (req.bank !== undefined && this.view.bank !== req.bank) return false;
		return true;
	}

	/**
	 * Sends an integer-typed argument. Only the few parameters RME types as "i"
	 * need this; everything else on the wire is a float, including values that
	 * read as whole numbers.
	 */
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
		this.restoreTimer = null;
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
		// Snapshots, groups and FX enables reach TotalMix through here and are
		// page-2/3 addresses, so this must go through the page-restoring path.
		// For page-1 addresses sendOffPage adds one comparison.
		this.sendOffPage(address, 1.0);
	}

	private sendBuffer(buf: Buffer): void {
		const socket = this.socket;
		if (socket === null) {
			streamDeck.logger.warn("OSC send skipped: socket not open");
			return;
		}

		// send() can throw synchronously, e.g. on a socket caught mid-close. The
		// throw is contained and logged here rather than propagating into the
		// key handler.
		try {
			socket.send(buf, this.options.sendPort, this.options.host, (err) => {
				if (err) streamDeck.logger.error(`OSC send failed: ${err.message}`);
			});
		} catch (err) {
			streamDeck.logger.error(`OSC send threw: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	/** Delay before returning to the slot's own page, sized to absorb a dial burst. */
	private static readonly PAGE_RESTORE_MS = 250;

	/**
	 * One kOSCScaleToggle address per page; 0.0 is inert on a toggle. globalMute
	 * exists on pages 1 and 3 only, so pages 2 and 4 use their own addresses.
	 * All four are present in osc-spec.json.
	 */
	private static readonly PAGE_TOUCH: Record<1 | 2 | 3 | 4, string> = {
		1: "/1/globalMute",
		2: "/2/mute",
		3: "/3/globalMute",
		4: "/4/reqEnable",
	};

	/**
	 * Asks TotalMix to re-send the parameters of one page.
	 *
	 * Per RME's spec, sending any parameter carrying a page number makes TotalMix
	 * re-send every parameter of that page and selects that page for the slot. A
	 * slot mirrors one page at a time, so the refresh must end on the slot's own
	 * page.
	 *
	 * Value 0.0 is inert on a kOSCScaleToggle address — only 1.0 flips it — so
	 * the refresh changes no state.
	 */
	requestFullRefresh(): void {
		// The re-send fires only when a parameter carries a new page number, so
		// touching the current page is a no-op. Two sends force a transition:
		// one onto a neighbouring page, one back. Each triggers that page's
		// re-send, and the second leaves the slot on its own page.
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
				// Covers a TotalMix restart or OSC being re-enabled: re-asserting
				// the page re-establishes the stream.
				this.requestFullRefresh();
			} else if (!this.primed) {
				// Heartbeats are arriving but no state has, so the initial
				// refresh request was lost. The request repeats until state
				// arrives; once primed, this branch stops running.
				this.requestFullRefresh();
			}
		}, this.timing.refreshMs);

		// Do not hold the process open on this timer alone.
		this.refreshTimer.unref?.();
	}

	/**
	 * Closes and forgets the socket. Tolerates an already-closed socket, which
	 * happens when the error handler and an explicit close race.
	 */
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
		if (this.restoreTimer !== null) clearTimeout(this.restoreTimer);
		if (this.refreshTimer !== null) clearInterval(this.refreshTimer);
		if (this.primeTimer !== null) clearTimeout(this.primeTimer);
		if (this.revealTimer !== null) clearTimeout(this.revealTimer);
		this.revealTimer = null;
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
 * TotalMix mirrors one view (bus + bank + page) per remote controller slot and
 * offers four slots. Connections are keyed on their port pair, so actions
 * configured for different slots hold independent views; actions sharing a port
 * pair share one connection.
 */
const pool = new Map<string, TotalMixConnection>();

/**
 * The connection for a host and port pair, created on first use. Actions call
 * this on every event rather than holding a reference, so a settings change
 * moves them to the right slot without any teardown of their own.
 */
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
