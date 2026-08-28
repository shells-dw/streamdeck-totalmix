import dgram from "node:dgram";
import streamDeck from "@elgato/streamdeck";
import { encodeFloat, isHeartbeat, parsePacket, type OscValue } from "../osc/codec.js";
import * as g from "./addresses.js";
import { rememberDevice } from "../totalmix/devices.js";

/**
 * One long-lived UDP connection to a TotalMix FX Global OSC controller slot.
 * Addresses are absolute, so the cache is a single flat map.
 *
 * set(): stateful parameters; the cache is updated optimistically because
 * TotalMix echoes a controller's own writes only with the slot's re-send
 * options enabled. trigger(): (f)-typed commands; not cached, since e.g.
 * /snapshot/load/N carries TotalMix's 0/2/3 state on the same address.
 */

export interface GlobalConnectionOptions {
	host: string;
	/** TotalMix "Port incoming". */
	sendPort: number;
	/** TotalMix "Port outgoing", bound locally. */
	receivePort: number;
}

/** TotalMix factory settings for Remote Controller 2. */
export const DEFAULT_GLOBAL_OPTIONS: GlobalConnectionOptions = {
	host: "127.0.0.1",
	sendPort: 7002,
	receivePort: 9002,
};

export type Listener = (value: OscValue) => void;

export interface GlobalTiming {
	/** Ms without inbound packets before the connection counts as stale (status arrives ~1/s). */
	staleMs: number;
	/** Watchdog interval. */
	refreshMs: number;
}

const DEFAULT_TIMING: GlobalTiming = { staleMs: 5000, refreshMs: 2000 };

const SEND_COALESCE_MS = 25;

/** Window after a write during which inbound values for that address are ignored. */
const WRITE_SETTLE_MS = 400;

export class GlobalConnection {
	private socket: dgram.Socket | null = null;
	private options: GlobalConnectionOptions = DEFAULT_GLOBAL_OPTIONS;

	private readonly cache = new Map<string, OscValue>();
	private readonly listeners = new Map<string, Set<Listener>>();
	private readonly connectionListeners = new Set<(connected: boolean) => void>();

	private readonly pending = new Map<string, number>();
	private readonly recentWrites = new Map<string, number>();
	private flushTimer: NodeJS.Timeout | null = null;
	private refreshTimer: NodeJS.Timeout | null = null;

	private lastInbound = 0;
	private connectedFlag = false;
	private loggedFirstInbound = false;

	/** True once non-heartbeat state has arrived; while false the watchdog repeats /sendall. */
	private primed = false;

	private readonly timing: GlobalTiming;

	constructor(timing: Partial<GlobalTiming> = {}) {
		this.timing = { ...DEFAULT_TIMING, ...timing };
	}

	get connected(): boolean {
		return this.connectedFlag;
	}

	/** Resolved options after coercion in connect(). */
	get options_(): Readonly<GlobalConnectionOptions> {
		return this.options;
	}

	/** Opens the socket, reopening only when the receive port changed. Idempotent. */
	async connect(options: Partial<GlobalConnectionOptions> = {}): Promise<void> {
		const next = {
			host: options.host !== undefined ? String(options.host) : this.options.host,
			sendPort: options.sendPort !== undefined ? Number(options.sendPort) : this.options.sendPort,
			receivePort:
				options.receivePort !== undefined ? Number(options.receivePort) : this.options.receivePort,
		};

		if (!Number.isFinite(next.sendPort) || !Number.isFinite(next.receivePort)) {
			streamDeck.logger.error(
				`Global OSC: ignoring invalid ports (send=${String(options.sendPort)}, receive=${String(options.receivePort)})`,
			);
			return;
		}

		const portChanged = this.socket !== null && next.receivePort !== this.options.receivePort;
		this.options = next;

		if (this.socket !== null && !portChanged) return;
		if (portChanged) this.closeSocket();

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
						? `Global OSC: udp/${this.options.receivePort} is already in use — ` +
							`check that the classic and Global OSC slots use different receive ports.`
						: `Global OSC socket error: ${err.message}`,
				);
				this.setConnected(false);
				this.closeSocket();
				resolve();
			});

			socket.on("listening", () => {
				streamDeck.logger.info(
					`Global OSC: listening on udp/${this.options.receivePort}, ` +
						`sending to ${this.options.host}:${this.options.sendPort}`,
				);
				resolve();
			});

			try {
				socket.bind(this.options.receivePort);
				this.socket = socket;
			} catch (err) {
				streamDeck.logger.error(`Global OSC: could not bind udp/${this.options.receivePort}: ${err}`);
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

		if (hasData) {
			this.primed = true;
		}
		if (resumedAfterGap) {
			// After a gap longer than staleMs the remaining state is unknown; re-request.
			this.primed = false;
			this.requestFullRefresh();
		}

		if (!this.loggedFirstInbound) {
			this.loggedFirstInbound = true;
			const sample = messages.slice(0, 8).map((m) => m.address).join(", ");
			streamDeck.logger.info(
				`Global OSC: first inbound, ${messages.length} message(s). Sample: ${sample}`,
			);
		}

		this.lastInbound = now;
		this.setConnected(true);

		for (const m of messages) {
			if (isHeartbeat(m)) continue;

			const wroteAt = this.recentWrites.get(m.address);
			if (wroteAt !== undefined) {
				if (Date.now() - wroteAt < WRITE_SETTLE_MS) continue;
				this.recentWrites.delete(m.address);
			}

			const previous = this.cache.get(m.address);
			if (previous === m.value) continue;
			// /level/... and /status/dsp change many times per second; not logged.
			if (!m.address.startsWith("/level/") && m.address !== g.STATUS_DSP) {
				streamDeck.logger.debug(`Global OSC inbound: ${m.address} = ${String(m.value)}`);
			}
			this.cache.set(m.address, m.value);
			if (m.address === g.STATUS_DEVICE && typeof m.value === "string") {
				rememberDevice(m.value, (msg) => streamDeck.logger.warn(msg));
			}
			this.notify(m.address, m.value);
		}
	}

	private notify(address: string, value: OscValue): void {
		const subs = this.listeners.get(address);
		if (subs === undefined) return;
		for (const fn of subs) {
			try {
				fn(value);
			} catch (err) {
				streamDeck.logger.error(`Global OSC listener for ${address} threw: ${err}`);
			}
		}
	}

	get(address: string): OscValue | undefined {
		return this.cache.get(address);
	}

	getNumber(address: string, fallback = 0): number {
		const v = this.cache.get(address);
		return typeof v === "number" ? v : typeof v === "boolean" ? (v ? 1 : 0) : fallback;
	}

	getString(address: string): string | undefined {
		const v = this.cache.get(address);
		return typeof v === "string" ? v : undefined;
	}

	/** Cached addresses matching a pattern (used by the PI channel datasource). */
	addresses(pattern: RegExp): string[] {
		const out: string[] = [];
		for (const key of this.cache.keys()) {
			if (pattern.test(key)) out.push(key);
		}
		return out;
	}

	/** Subscribes; delivers the cached value on a microtask. Returns the unsubscribe. */
	subscribe(address: string, listener: Listener): () => void {
		let subs = this.listeners.get(address);
		if (subs === undefined) {
			subs = new Set();
			this.listeners.set(address, subs);
		}
		subs.add(listener);

		const cached = this.cache.get(address);
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

	/** Sets a stateful parameter; caches optimistically and wakes subscribers. */
	set(address: string, value: number): void {
		streamDeck.logger.info(`Global OSC out (set): ${address} = ${value}`);
		this.recentWrites.set(address, Date.now());
		const previous = this.cache.get(address);
		this.cache.set(address, value);
		if (previous !== value) this.notify(address, value);
		this.sendBuffer(encodeFloat(address, Number(value)));
	}

	/** Sends an (f)-typed command; not cached. */
	trigger(address: string, value = 1.0): void {
		streamDeck.logger.info(`Global OSC out (trigger): ${address} = ${value}`);
		this.sendBuffer(encodeFloat(address, Number(value)));
	}

	/** Sets the inverse of the cached state (first press with no cache sets on). */
	toggleSet(address: string): void {
		const current = this.getNumber(address, 0);
		this.set(address, current >= 0.5 ? 0 : 1);
	}

	/** Coalesced continuous write; cached optimistically. */
	setCoalesced(address: string, value: number): void {
		this.pending.set(address, value);
		this.cache.set(address, value);
		this.recentWrites.set(address, Date.now());

		if (this.flushTimer !== null) return;
		this.flushTimer = setTimeout(() => {
			this.flushTimer = null;
			const batch = [...this.pending];
			this.pending.clear();
			for (const [addr, v] of batch) {
				streamDeck.logger.debug(`Global OSC out (dial): ${addr} = ${v.toFixed(4)}`);
				this.sendBuffer(encodeFloat(addr, v));
			}
		}, SEND_COALESCE_MS);
	}

	private sendBuffer(buf: Buffer): void {
		const socket = this.socket;
		if (socket === null) {
			streamDeck.logger.warn("Global OSC send skipped: socket not open");
			return;
		}
		// send() can throw synchronously on a socket mid-close.
		try {
			socket.send(buf, this.options.sendPort, this.options.host, (err) => {
				if (err) streamDeck.logger.error(`Global OSC send failed: ${err.message}`);
			});
		} catch (err) {
			streamDeck.logger.error(
				`Global OSC send threw: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	/** /sendall for all parameters plus /sendstate for the status block and DURec strings. */
	requestFullRefresh(): void {
		this.trigger(g.SEND_ALL, 1.0);
		this.trigger(g.SEND_STATE, 1.0);
	}

	/** Watchdog: re-requests when stale or while no state has arrived. */
	private startRefreshTimer(): void {
		if (this.refreshTimer !== null) return;

		this.refreshTimer = setInterval(() => {
			const silent = Date.now() - this.lastInbound;

			if (silent > this.timing.staleMs) {
				if (this.connectedFlag) {
					streamDeck.logger.warn(
						`Global OSC: nothing from TotalMix for ${Math.round(silent / 1000)}s — re-requesting.`,
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
		if (this.refreshTimer !== null) clearInterval(this.refreshTimer);
		this.flushTimer = null;
		this.refreshTimer = null;
		this.listeners.clear();
		this.connectionListeners.clear();
		this.cache.clear();
		this.closeSocket();
	}
}

/** One connection per host + port pair, separate from the classic pool. */
const pool = new Map<string, GlobalConnection>();

export function globalMixFor(options: GlobalConnectionOptions): GlobalConnection {
	const key = `${options.host}:${options.sendPort}:${options.receivePort}`;
	let conn = pool.get(key);
	if (conn === undefined) {
		conn = new GlobalConnection();
		pool.set(key, conn);
	}
	void conn.connect(options);
	return conn;
}

export function disposeAllGlobal(): void {
	for (const conn of pool.values()) {
		conn.dispose();
	}
	pool.clear();
}
