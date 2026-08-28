import dgram from "node:dgram";
import streamDeck from "@elgato/streamdeck";
import {
	encodeAddress,
	encodeFloat,
	isHeartbeat,
	parsePacket,
	type OscMessage,
	type OscValue,
} from "../osc/codec.js";
import { pageOf } from "./addresses.js";

/**
 * One long-lived UDP connection to a TotalMix FX Remote Controller slot
 * (classic OSC). The socket stays bound; inbound messages update a cache;
 * actions subscribe to the addresses they read.
 *
 * A slot mirrors one page and one view (bus, bank start, submix) at a time
 * and TotalMix streams only that page. Page-1 strip addresses are positional,
 * so their values are cached per view; page-2/4 addresses per channel.
 */

export interface ConnectionOptions {
	host: string;
	/** TotalMix "Port incoming". */
	sendPort: number;
	/** TotalMix "Port outgoing", bound locally. */
	receivePort: number;
}

/** TotalMix factory settings for Remote Controller 1. */
export const DEFAULT_OPTIONS: ConnectionOptions = {
	host: "127.0.0.1",
	sendPort: 7001,
	receivePort: 9001,
};

export type Listener = (value: OscValue) => void;

/** View an action's data belongs to. `offset` scopes page-2/4 addresses. */
export interface ViewRequirement {
	bus?: "input" | "playback" | "output";
	bank?: number;
	/** Channel offset from the bank start, counted in faders (/setOffsetInBank). */
	offset?: number;
}

export interface ConnectionTiming {
	/** Ms without inbound packets before the connection counts as stale. */
	staleMs: number;
	/** Watchdog interval. */
	refreshMs: number;
}

const DEFAULT_TIMING: ConnectionTiming = { staleMs: 5000, refreshMs: 2000 };

/** Outbound coalescing window for continuous values. */
const SEND_COALESCE_MS = 25;

/** Interval for re-collecting non-resident pages and channels. */
const MIRROR_INTERVAL_MS = 2000;

/** Time the slot stays on a visited page so its dump (~60-80 ms) can arrive. */
const PAGE_DWELL_MS = 250;

/** Window after a write during which inbound values for that address are ignored. */
const WRITE_SETTLE_MS = 400;

/** Quiet period after any write before the mirror rotation resumes. */
const MIRROR_QUIET_MS = 700;

/** Interval between prime/sweep visits. */
const PRIME_VISIT_MS = 400;

/** Delay before returning to the resident page after an off-page write. */
const PAGE_RESTORE_MS = 250;

/** Delay after the view becomes known before the page is re-requested. */
const REVEAL_REFRESH_MS = 400;

/** Commands that change every bus at once and require every view to be re-collected. */
const RECALLS_EVERYTHING = /^\/3\/snapshots\/|^\/loadQuickWorkspace$/;

const BUS_SUFFIX = { input: "Input", playback: "Playback", output: "Output" } as const;

const BUS_ADDRESS = {
	input: "/1/busInput",
	playback: "/1/busPlayback",
	output: "/1/busOutput",
} as const;

/** Page-1 addresses whose meaning depends on bus, bank and submix. */
const POSITIONAL =
	/^\/1\/(?:(?:volume|pan|micgain|trackname)\d+(?:Val)?|level\d+(?:Left|Right)(?:Val)?|(?:mute|solo|phantom|cue|select)\/1\/\d+)$/;

/** Page-2/4 addresses, which refer to the channel those pages show. */
const CHANNEL_SCOPED = /^\/[24]\//;

/** Addresses logged on first arrival even without subscribers. */
const DIAGNOSTIC = /^\/(?:1\/(?:mute|solo)\/1\/\d+|2\/)/;

export class TotalMixConnection {
	private socket: dgram.Socket | null = null;
	private options: ConnectionOptions = DEFAULT_OPTIONS;

	/** Non-positional state (mastervolume, mainDim, groups, page 3). */
	private readonly globals = new Map<string, OscValue>();

	/** Positional and channel-scoped state, keyed by view/channel key. */
	private readonly viewState = new Map<string, Map<string, OscValue>>();

	/**
	 * Arrival order per cached entry, keyed by slice and address.
	 *
	 * A parameter and its "...Val" string are separate messages and TotalMix
	 * does not always send both, so a cached string can describe an older value
	 * than the number beside it. Comparing counters tells the two apart.
	 */
	private readonly sequences = new Map<string, number>();

	/** Monotonic counter; every applied message takes the next value. */
	private sequence = 0;

	/** View the slot currently shows; undefined components are unknown. */
	private view: {
		bus?: "input" | "playback" | "output";
		bank?: number;
		submix?: string;
		offset?: number;
	} = {};

	private readonly listeners = new Map<string, Set<Listener>>();
	private readonly connectionListeners = new Set<(connected: boolean) => void>();

	private readonly pending = new Map<string, number>();
	private readonly recentWrites = new Map<string, number>();
	private flushTimer: NodeJS.Timeout | null = null;
	private restoreTimer: NodeJS.Timeout | null = null;
	private refreshTimer: NodeJS.Timeout | null = null;
	private primeTimer: NodeJS.Timeout | null = null;
	private mirrorTimer: NodeJS.Timeout | null = null;
	private revealTimer: NodeJS.Timeout | null = null;

	private lastInbound = 0;
	private lastWriteAt = 0;
	private connectedFlag = false;

	/** True once a non-heartbeat message has arrived. */
	private primed = false;

	/** Views to visit, one per prime tick. */
	private readonly primeQueue: ViewRequirement[] = [];
	private readonly primedViews = new Set<string>();

	/** Every view an action has required. */
	private readonly knownViews: ViewRequirement[] = [];

	/** Non-resident pages actions read; swept periodically. */
	private readonly requiredPages = new Set<1 | 2 | 3 | 4>();

	/** Pages still to be swept, one per prime tick. */
	private pageQueue: (1 | 2 | 3 | 4)[] = [];

	/** Page each button reads, keyed by action id; decides the resident page. */
	private readonly declaredPages = new Map<string, 1 | 2 | 3 | 4>();

	/** Page this slot mirrors between off-page commands. */
	private page: 1 | 2 | 3 | 4 = 1;

	private loggedFirstInbound = false;

	/** Guards the one-shot re-request after the slot's view becomes known. */
	private revealedView = false;

	private readonly seenAddresses = new Set<string>();

	private readonly timing: ConnectionTiming;

	constructor(timing: Partial<ConnectionTiming> = {}) {
		this.timing = { ...DEFAULT_TIMING, ...timing };
	}

	get connected(): boolean {
		return this.connectedFlag;
	}

	/** Resolved options after coercion in connect(). */
	get options_(): Readonly<ConnectionOptions> {
		return this.options;
	}

	/** Opens the socket, reopening only when the receive port changed. Idempotent. */
	async connect(options: Partial<ConnectionOptions> = {}): Promise<void> {
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

	/** Binds the receive port. Resolves on "listening" or on a bind error. */
	private openSocket(): Promise<void> {
		return new Promise((resolve) => {
			// No reuseAddr: a taken port must surface as EADDRINUSE.
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
				this.setConnected(false);
				this.closeSocket();
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

	private handlePacket(buf: Buffer): void {
		const messages = parsePacket(buf);
		if (messages.length === 0) return;

		const now = Date.now();
		const resumedAfterGap = this.lastInbound !== 0 && now - this.lastInbound > this.timing.staleMs;
		const hasData = messages.some((m) => !isHeartbeat(m));

		if (resumedAfterGap) {
			// Gap longer than staleMs: TotalMix restarted, slot page and view unknown.
			this.primed = false;
			this.invalidateViews();
			this.pageQueue = [...this.requiredPages];
			this.requestFullRefresh();
			this.schedulePrimeVisit();
		}
		if (hasData) this.primed = true;

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
	 * Re-requests the page once bus or submix are first known, so values that
	 * arrived under the placeholder "?" view are re-filed under the real one.
	 */
	private onViewMaybeRevealed(): void {
		if (this.revealedView) return;
		if (this.view.bus === undefined && this.view.submix === undefined) return;

		this.revealedView = true;
		if (this.revealTimer !== null) clearTimeout(this.revealTimer);

		// Deferred so the dump that revealed the view finishes first.
		this.revealTimer = setTimeout(() => {
			this.revealTimer = null;
			streamDeck.logger.info(
				`View known (${this.viewKey()}); re-requesting page ${this.page} so values file under it.`,
			);
			this.requestFullRefresh();
		}, REVEAL_REFRESH_MS);
		this.revealTimer.unref?.();
	}

	/** Logs the first arrival of subscribed or DIAGNOSTIC addresses with their cache slice. */
	private logFirstArrival(m: OscMessage, key: string | null): void {
		if (this.seenAddresses.has(m.address)) return;

		const listeners = this.listeners.get(m.address)?.size ?? 0;
		if (listeners === 0 && !DIAGNOSTIC.test(m.address)) return;

		this.seenAddresses.add(m.address);
		streamDeck.logger.info(
			`First arrival: ${m.address} = ${String(m.value)}, ` +
				`${key === null ? "global" : `slice ${key}`}, ${listeners} listener(s)`,
		);
	}

	/** Files one message into its cache slice and wakes subscribers. View-tracking addresses are read first. */
	private applyMessage(m: OscMessage): void {
		if (isHeartbeat(m)) return;

		if (m.address === "/1/labelSubmix" && typeof m.value === "string") {
			this.view.submix = m.value;
		}

		// TotalMix reports the active bus (busX = 1.0) on pages 1 and 2.
		const busReport = /^\/[12]\/bus(Input|Playback|Output)$/.exec(m.address);
		if (busReport !== null) {
			const bus = busReport[1] === "Input" ? "input" : busReport[1] === "Playback" ? "playback" : "output";
			const active = typeof m.value === "number" ? m.value >= 0.5 : m.value === true;
			if (active) this.view.bus = bus;
		}

		this.onViewMaybeRevealed();

		const key = this.cacheKeyFor(m.address);
		const store = key === null ? this.globals : this.viewMap(key);

		// Ignore inbound values for a recently written address (in-flight dump carries the old value).
		const wroteAt = this.recentWrites.get(m.address);
		if (wroteAt !== undefined) {
			if (Date.now() - wroteAt < WRITE_SETTLE_MS) return;
			this.recentWrites.delete(m.address);
		}

		const previous = store.get(m.address);
		if (previous === m.value) return;

		this.logFirstArrival(m, key);

		store.set(m.address, m.value);
		this.sequences.set(TotalMixConnection.seqKey(key, m.address), ++this.sequence);

		const subs = this.listeners.get(m.address);
		if (subs === undefined) return;

		for (const fn of subs) {
			try {
				fn(m.value);
			} catch (err) {
				streamDeck.logger.error(`Listener for ${m.address} threw: ${err}`);
			}
		}
	}

	/** Composite key pairing a cache slice with an address. */
	private static seqKey(key: string | null, address: string): string {
		return `${key ?? ""}\u0000${address}`;
	}

	/**
	 * Arrival order of a cached entry, 0 when never received.
	 *
	 * Only comparisons between two addresses in the same cache are meaningful;
	 * the absolute figure carries no information.
	 */
	sequenceOf(address: string, req?: ViewRequirement | null): number {
		return this.sequences.get(TotalMixConnection.seqKey(this.cacheKeyFor(address, req), address)) ?? 0;
	}

	/** Cached value; `req` selects the view slice for positional/channel-scoped addresses. */
	get(address: string, req?: ViewRequirement | null): OscValue | undefined {
		const key = this.cacheKeyFor(address, req);
		if (key === null) return this.globals.get(address);
		return this.viewState.get(key)?.get(address);
	}

	getNumber(address: string, fallback = 0, req?: ViewRequirement | null): number {
		const v = this.get(address, req);
		return typeof v === "number" ? v : typeof v === "boolean" ? (v ? 1 : 0) : fallback;
	}

	getString(address: string, req?: ViewRequirement | null): string | undefined {
		const v = this.get(address, req);
		return typeof v === "string" ? v : undefined;
	}

	/** Subscribes; delivers the current-view cached value on a microtask. Returns the unsubscribe. */
	subscribe(address: string, listener: Listener): () => void {
		let subs = this.listeners.get(address);
		if (subs === undefined) {
			subs = new Set();
			this.listeners.set(address, subs);
		}
		subs.add(listener);

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

	/** Subscribes to connection transitions; fires immediately with the current state. */
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

	/** Sends one float immediately (discrete commands). */
	send(address: string, value: number): void {
		streamDeck.logger.debug(`OSC out: ${address} = ${value}`);
		const now = Date.now();
		this.recentWrites.set(address, now);
		this.lastWriteAt = now;
		this.trackViewChange(address, value);
		this.sendBuffer(encodeFloat(address, Number(value)));
	}

	/** Sends, then schedules the return to the resident page if the address is on another page. */
	sendOffPage(address: string, value: number): void {
		this.send(address, value);
		this.scheduleRestore(pageOf(address), RECALLS_EVERYTHING.test(address));
	}

	/** Deferred, restartable return to the resident page; a burst of writes costs one page dump. */
	private scheduleRestore(page: 1 | 2 | 3 | 4, revisitEverything = false): void {
		if (page === this.page) return;

		if (this.restoreTimer !== null) clearTimeout(this.restoreTimer);
		this.restoreTimer = setTimeout(() => {
			this.restoreTimer = null;
			streamDeck.logger.debug(`Returning slot to page ${this.page} after a page-${page} command.`);
			this.requestFullRefresh();
			// A snapshot/workspace recall changes every bus without emitting parameters.
			if (revisitEverything) this.revisitViews();
		}, PAGE_RESTORE_MS);
		this.restoreTimer.unref?.();
	}

	/** Tracks outbound commands that move the view. */
	private trackViewChange(address: string, value: number): void {
		switch (address) {
			case "/1/busInput":
			case "/2/busInput":
				this.view.bus = "input";
				return;
			case "/1/busPlayback":
			case "/2/busPlayback":
				this.view.bus = "playback";
				return;
			case "/1/busOutput":
			case "/2/busOutput":
				this.view.bus = "output";
				return;
			case "/setBankStart":
				this.view.bank = value;
				return;
			case "/setOffsetInBank":
				this.view.offset = value;
				return;
			case "/1/bank+":
			case "/1/bank-":
			case "/1/track+":
			case "/1/track-":
			case "/2/track+":
			case "/2/track-":
			case "/4/track+":
			case "/4/track-":
				// Relative move by an unknown amount: drop the resulting "?" slice.
				this.view.bank = undefined;
				this.view.offset = undefined;
				this.viewState.delete(this.viewKey());
				return;
			case "/setSubmix":
				// The resulting dump carries labelSubmix, which re-keys the slice.
				return;
		}
	}

	/** Cache slice key for an address, or null for the global map. */
	private cacheKeyFor(address: string, req?: ViewRequirement | null): string | null {
		if (CHANNEL_SCOPED.test(address)) return this.channelKey(req);
		if (POSITIONAL.test(address)) return this.viewKey(req);
		return null;
	}

	/** Page-2/4 channel key: bus, bank start, offset. Submix is not a component. */
	private channelKey(req?: ViewRequirement | null): string {
		const bus = req?.bus ?? this.view.bus ?? "?";
		const bank = req?.bank ?? this.view.bank ?? "?";
		const offset = req?.offset ?? this.view.offset ?? "?";
		return `ch|${bus}|${bank}|${offset}`;
	}

	/** Drops all view/channel slices; the next dump reveals the view again. */
	private invalidateViews(): void {
		this.viewState.clear();
		// Counters are only compared against each other, so dropping them all
		// restores the pre-arrival state rather than leaving stale orderings.
		this.sequences.clear();
		this.view = {};
		this.revealedView = false;
	}

	/** Page-1 view key: bus, bank, submix. Unknown components render as "?". */
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

	/** Declares a non-resident page an action reads; it is swept once and then in rotation. */
	requirePage(page: 1 | 2 | 3 | 4): void {
		if (page === this.page || this.requiredPages.has(page)) return;
		this.requiredPages.add(page);
		this.pageQueue.push(page);
		this.schedulePrimeVisit();
		this.settleMirrorTimer();
	}

	/** Records the page one button reads (keyed by action id) and re-decides the resident page. */
	declarePage(id: string, page: 1 | 2 | 3 | 4): void {
		if (this.declaredPages.get(id) === page) {
			this.requirePage(page);
			return;
		}
		this.declaredPages.set(id, page);
		this.settleResidentPage();
		this.requirePage(page);
	}

	releasePage(id: string): void {
		if (!this.declaredPages.delete(id)) return;
		this.settleResidentPage();
	}

	/** Starts the mirror rotation when any button reads a non-resident page; stops it otherwise. */
	private settleMirrorTimer(): void {
		const needed = [...this.declaredPages.values()].some((p) => p !== this.page);

		if (!needed) {
			if (this.mirrorTimer !== null) {
				clearInterval(this.mirrorTimer);
				this.mirrorTimer = null;
			}
			return;
		}

		if (this.mirrorTimer !== null) return;
		this.mirrorTimer = setInterval(() => {
			if (!this.primed || !this.connectedFlag) return;
			if (Date.now() - this.lastWriteAt < MIRROR_QUIET_MS) return;
			for (const page of this.requiredPages) {
				if (!this.pageQueue.includes(page)) this.pageQueue.push(page);
			}
			// Page-2 dumps report one channel, so each named channel is visited too.
			for (const req of this.knownViews) {
				if (req.offset !== undefined && !this.primeQueue.includes(req)) this.primeQueue.push(req);
			}
			this.schedulePrimeVisit();
		}, MIRROR_INTERVAL_MS);
		this.mirrorTimer.unref?.();
	}

	/** Makes the most-read page resident; ties go to the lower page number. */
	private settleResidentPage(): void {
		const counts = new Map<1 | 2 | 3 | 4, number>();
		for (const page of this.declaredPages.values()) {
			counts.set(page, (counts.get(page) ?? 0) + 1);
		}

		let resident: 1 | 2 | 3 | 4 = 1;
		let best = 0;
		for (const page of [1, 2, 3, 4] as const) {
			const n = counts.get(page) ?? 0;
			if (n > best) {
				best = n;
				resident = page;
			}
		}

		for (const page of [...this.requiredPages]) {
			if (page !== resident && ![...this.declaredPages.values()].includes(page)) {
				this.requiredPages.delete(page);
			}
		}
		this.pageQueue = this.pageQueue.filter((p) => this.requiredPages.has(p) && p !== resident);

		if (resident === this.page) {
			this.settleMirrorTimer();
			return;
		}

		streamDeck.logger.info(
			`Slot now mirrors page ${resident}: ${best} of ${this.declaredPages.size} button(s) read it.`,
		);
		this.requiredPages.delete(resident);
		this.setPage(resident);
		this.settleMirrorTimer();
	}

	/** Moves the slot onto a page, dwells for its dump, returns. Page 4 also selects the Output bus, so the previous bus is restored. */
	private sweepPage(page: 1 | 2 | 3 | 4): void {
		this.touchPage(page);
		this.dwellThenReturn(page === 4 ? this.view.bus : undefined);
	}

	private dwellThenReturn(restoreBus: "input" | "playback" | "output" | undefined): void {
		const back = setTimeout(() => {
			this.touchPage(this.page);
			if (restoreBus !== undefined) {
				this.send(BUS_ADDRESS[restoreBus], 1.0);
				this.view.bus = restoreBus;
			}
		}, PAGE_DWELL_MS);
		back.unref?.();
	}

	/** Declares a view an action needs; visited once after the connection is primed. */
	requireView(req: ViewRequirement): void {
		if (req.bus === undefined && req.bank === undefined && req.offset === undefined) return;
		const key = `${req.bus ?? "?"}:${req.bank ?? "?"}:${req.offset ?? "?"}`;
		if (this.primedViews.has(key)) return;
		this.primedViews.add(key);
		this.knownViews.push(req);
		this.primeQueue.push(req);
		this.schedulePrimeVisit();
	}

	/** Queues every known view for a visit. */
	private revisitViews(): void {
		for (const req of this.knownViews) {
			if (!this.primeQueue.includes(req)) this.primeQueue.push(req);
		}
		this.schedulePrimeVisit();
	}

	/** Drains pageQueue then primeQueue, one visit per PRIME_VISIT_MS, never overlapping. */
	private schedulePrimeVisit(): void {
		if (this.primeTimer !== null || (this.primeQueue.length === 0 && this.pageQueue.length === 0)) {
			return;
		}
		this.primeTimer = setTimeout(() => {
			this.primeTimer = null;
			if (!this.primed) {
				this.schedulePrimeVisit();
				return;
			}
			const page = this.pageQueue.shift();
			if (page !== undefined) {
				this.sweepPage(page);
				this.schedulePrimeVisit();
				return;
			}

			const req = this.primeQueue.shift();
			if (req !== undefined) {
				// A view with an offset belongs to a page-2 button; the page-2 bus
				// selector selects the bus and moves the slot onto page 2.
				const onPage2 = req.offset !== undefined;
				if (req.bus !== undefined) {
					this.send(onPage2 ? `/2/bus${BUS_SUFFIX[req.bus]}` : BUS_ADDRESS[req.bus], 1.0);
				}
				if (req.bank !== undefined) this.send("/setBankStart", req.bank);
				if (req.offset !== undefined) this.send("/setOffsetInBank", req.offset);
				if (onPage2) this.dwellThenReturn(undefined);
			}
			this.schedulePrimeVisit();
		}, PRIME_VISIT_MS);
		this.primeTimer.unref?.();
	}

	/** Whether the current view satisfies `req`; unknown components count as a mismatch. */
	viewMatches(req: ViewRequirement): boolean {
		if (req.bus !== undefined && this.view.bus !== req.bus) return false;
		if (req.bank !== undefined && this.view.bank !== req.bank) return false;
		if (req.offset !== undefined && this.view.offset !== req.offset) return false;
		return true;
	}

	/** Queues a continuous value (latest wins per address), caches it optimistically, flushes every SEND_COALESCE_MS. */
	sendCoalesced(address: string, value: number): void {
		this.pending.set(address, value);
		const now = Date.now();
		this.recentWrites.set(address, now);
		this.lastWriteAt = now;

		const key = this.cacheKeyFor(address);
		(key === null ? this.globals : this.viewMap(key)).set(address, value);

		this.scheduleRestore(pageOf(address));

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

	/** Flips a kOSCScaleToggle parameter (1.0), via the page-restoring path. */
	toggle(address: string): void {
		this.sendOffPage(address, 1.0);
	}

	private sendBuffer(buf: Buffer): void {
		const socket = this.socket;
		if (socket === null) {
			streamDeck.logger.warn("OSC send skipped: socket not open");
			return;
		}

		// send() can throw synchronously on a socket mid-close.
		try {
			socket.send(buf, this.options.sendPort, this.options.host, (err) => {
				if (err) streamDeck.logger.error(`OSC send failed: ${err.message}`);
			});
		} catch (err) {
			streamDeck.logger.error(`OSC send threw: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	/** Selects a page by sending the bare page address ("/3"), which carries no parameter state. */
	private touchPage(page: 1 | 2 | 3 | 4): void {
		streamDeck.logger.debug(`OSC out: /${page} (select page)`);
		this.sendBuffer(encodeAddress(`/${page}`));
	}

	/** Forces a re-send of the resident page: touch a neighbouring page, then the resident one. */
	requestFullRefresh(): void {
		const away = this.page === 1 ? 2 : 1;
		this.touchPage(away);
		this.touchPage(this.page);
	}

	setPage(page: 1 | 2 | 3 | 4): void {
		if (this.page === page) return;
		this.page = page;
		this.requestFullRefresh();
	}

	/** Watchdog: re-requests the page when stale or while no state has arrived. */
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
				this.requestFullRefresh();
			} else if (!this.primed) {
				this.requestFullRefresh();
			}
		}, this.timing.refreshMs);

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

	dispose(): void {
		if (this.flushTimer !== null) clearTimeout(this.flushTimer);
		if (this.restoreTimer !== null) clearTimeout(this.restoreTimer);
		if (this.refreshTimer !== null) clearInterval(this.refreshTimer);
		if (this.primeTimer !== null) clearTimeout(this.primeTimer);
		if (this.mirrorTimer !== null) clearInterval(this.mirrorTimer);
		if (this.revealTimer !== null) clearTimeout(this.revealTimer);
		this.flushTimer = null;
		this.restoreTimer = null;
		this.refreshTimer = null;
		this.primeTimer = null;
		this.mirrorTimer = null;
		this.revealTimer = null;
		this.listeners.clear();
		this.connectionListeners.clear();
		this.globals.clear();
		this.viewState.clear();
		this.declaredPages.clear();
		this.closeSocket();
	}
}

/** One connection per host + port pair (Remote Controller slot). */
const pool = new Map<string, TotalMixConnection>();

export function totalMixFor(options: ConnectionOptions): TotalMixConnection {
	const key = `${options.host}:${options.sendPort}:${options.receivePort}`;
	let conn = pool.get(key);
	if (conn === undefined) {
		conn = new TotalMixConnection();
		pool.set(key, conn);
	}
	void conn.connect(options);
	return conn;
}

export function disposeAll(): void {
	for (const conn of pool.values()) {
		conn.dispose();
	}
	pool.clear();
}

/** Default-slot connection, pooled as the slot-1 entry. */
export const totalMix = new TotalMixConnection();
pool.set(`${DEFAULT_OPTIONS.host}:${DEFAULT_OPTIONS.sendPort}:${DEFAULT_OPTIONS.receivePort}`, totalMix);
