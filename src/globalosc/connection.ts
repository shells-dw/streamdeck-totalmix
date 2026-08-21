import dgram from "node:dgram";
import streamDeck from "@elgato/streamdeck";
import { encodeFloat, isHeartbeat, parsePacket, type OscValue } from "../osc/codec.js";
import * as g from "./addresses.js";

/**
 * A long-lived connection to one TotalMix FX Global OSC controller slot.
 *
 * Deliberately a separate class from TotalMixConnection, not a mode of it: the
 * classic protocol is view-relative (bus + bank + page + submix), and most of
 * that class exists to track and pin the view. Global OSC addresses are
 * absolute, so the cache here is a single flat map and none of that machinery
 * applies. Sharing a base class would couple the working classic path to the
 * new one for no shared behavior beyond a UDP socket.
 *
 * Two write paths, matching the protocol's two value semantics:
 *
 * - set(): stateful parameters (mute, dim, faders…). The value IS the state.
 *   The cache is updated optimistically on send, because TotalMix's echo of a
 *   controller's own writes is governed by the "re-send" options, which are off
 *   by default (the table warns enabling them "can trigger ping-pong") — so a
 *   read-modify-write toggle must not depend on hearing its own write back.
 * - trigger(): (f)-typed commands (undo, snapshot/load, DURec transport…).
 *   Values below 0.5 are ignored by TotalMix, and the cache is NOT written:
 *   on /snapshot/load/N the same address carries TotalMix's 0/2/3 state
 *   signalling, which a cached 1.0 would corrupt.
 */

export interface GlobalConnectionOptions {
	/** Host running TotalMix FX. */
	host: string;
	/** Global OSC slot "Port incoming" — where we send. Default 7002. */
	sendPort: number;
	/** Global OSC slot "Port outgoing" — where we listen. Default 9002. */
	receivePort: number;
}

export const DEFAULT_GLOBAL_OPTIONS: GlobalConnectionOptions = {
	host: "127.0.0.1",
	sendPort: 7002,
	receivePort: 9002,
};

export type Listener = (value: OscValue) => void;

export interface GlobalTiming {
	/**
	 * Ms without any inbound packet before the connection is treated as stale.
	 * The table states status is sent at ~1 param per second, so a healthy link
	 * is never silent for long — 5s of silence means TotalMix is gone.
	 */
	staleMs: number;
	/** How often to re-check and re-request when something is off. */
	refreshMs: number;
}

const DEFAULT_TIMING: GlobalTiming = { staleMs: 5000, refreshMs: 2000 };

/** Same coalescing rationale as the classic connection: one send per address per tick. */
const SEND_COALESCE_MS = 25;

export class GlobalConnection {
	private socket: dgram.Socket | null = null;
	private options: GlobalConnectionOptions = DEFAULT_GLOBAL_OPTIONS;

	/** Absolute address -> last known value. No views, so one flat map suffices. */
	private readonly cache = new Map<string, OscValue>();

	private readonly listeners = new Map<string, Set<Listener>>();
	private readonly connectionListeners = new Set<(connected: boolean) => void>();

	private readonly pending = new Map<string, number>();
	private flushTimer: NodeJS.Timeout | null = null;
	private refreshTimer: NodeJS.Timeout | null = null;

	private lastInbound = 0;
	private connectedFlag = false;
	private loggedFirstInbound = false;


	/**
	 * True once real state has arrived. Until then the timer keeps re-sending
	 * /sendall — covering the case where the plugin started before TotalMix (a
	 * request into the void is a lost UDP datagram, nothing more).
	 */
	private primed = false;

	private readonly timing: GlobalTiming;

	constructor(timing: Partial<GlobalTiming> = {}) {
		this.timing = { ...DEFAULT_TIMING, ...timing };
	}

	get connected(): boolean {
		return this.connectedFlag;
	}

	get options_(): Readonly<GlobalConnectionOptions> {
		return this.options;
	}

	/** Opens the socket, or reopens it if the receive port changed. Idempotent. */
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

	private openSocket(): Promise<void> {
		return new Promise((resolve) => {
			const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

			socket.on("message", (buf) => this.handlePacket(buf));

			socket.on("error", (err) => {
				streamDeck.logger.error(`Global OSC socket error: ${err.message}`);
				this.setConnected(false);
				this.closeSocket();
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
			// TotalMix likely restarted; its state is unknown, so re-request even
			// though packets are flowing again.
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
			const previous = this.cache.get(m.address);
			if (previous === m.value) continue;
			// Every APPLIED change is logged — the initial dump prints once as a
			// full inventory (nothing is cached yet), and afterwards each line
			// is a real change TotalMix transmitted, e.g. a GUI fader move.
			streamDeck.logger.info(`Global OSC inbound: ${m.address} = ${String(m.value)}`);
			this.cache.set(m.address, m.value);
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

	/** All cached addresses matching a regex — used by the PI channel datasource. */
	addresses(pattern: RegExp): string[] {
		const out: string[] = [];
		for (const key of this.cache.keys()) {
			if (pattern.test(key)) out.push(key);
		}
		return out;
	}

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
	 * Sets a stateful parameter. Optimistically caches (see class comment) and
	 * wakes subscribers, so a toggle's own light flips immediately even when
	 * TotalMix does not echo the write back.
	 */
	set(address: string, value: number): void {
		streamDeck.logger.info(`Global OSC out (set): ${address} = ${value}`);
		const previous = this.cache.get(address);
		this.cache.set(address, value);
		if (previous !== value) this.notify(address, value);
		this.sendBuffer(encodeFloat(address, Number(value)));
	}

	/**
	 * Fires an (f)-typed command. Never cached: on addresses like
	 * /snapshot/load/N the inbound direction carries TotalMix's own 0/2/3 state
	 * signalling, which our outgoing 1.0 must not overwrite.
	 */
	trigger(address: string, value = 1.0): void {
		streamDeck.logger.info(`Global OSC out (trigger): ${address} = ${value}`);
		this.sendBuffer(encodeFloat(address, Number(value)));
	}

	/**
	 * Reads the cached state of a stateful on/off parameter and sets its
	 * inverse. With nothing cached yet the first press turns it ON — matching
	 * user intent on a fresh button. For the receive-only group addresses
	 * (/mutegroup/N etc.), which TotalMix never reports, the optimistic cache
	 * IS the state, so alternating presses alternate the group.
	 */
	toggleSet(address: string): void {
		const current = this.getNumber(address, 0);
		this.set(address, current >= 0.5 ? 0 : 1);
	}

	/** Coalesced continuous write for dial rotation; optimistically cached. */
	setCoalesced(address: string, value: number): void {
		this.pending.set(address, value);
		this.cache.set(address, value);

		if (this.flushTimer !== null) return;
		this.flushTimer = setTimeout(() => {
			this.flushTimer = null;
			const batch = [...this.pending];
			this.pending.clear();
			for (const [addr, v] of batch) {
				streamDeck.logger.info(`Global OSC out (dial): ${addr} = ${v.toFixed(4)}`);
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

	/**
	 * /sendall 1.0 asks TotalMix to (re-)send every parameter — the Global OSC
	 * equivalent of the classic page dump, minus the page juggling.
	 */
	requestFullRefresh(): void {
		this.trigger(g.SEND_ALL, 1.0);
	}

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

/**
 * Pool, keyed by host and port pair — one connection per Global OSC controller
 * slot, shared by every action configured for it. Entirely separate from the
 * classic pool: a global button on 7002/9002 and a classic dial on 7001/9001
 * hold two independent sockets, which is exactly how TotalMix models its slots.
 */
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
