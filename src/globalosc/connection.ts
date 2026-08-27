import dgram from "node:dgram";
import streamDeck from "@elgato/streamdeck";
import { encodeFloat, isHeartbeat, parsePacket, type OscValue } from "../osc/codec.js";
import * as g from "./addresses.js";
import { rememberDevice } from "../totalmix/devices.js";

/**
 * A long-lived connection to one TotalMix FX Global OSC controller slot.
 *
 * Global OSC addresses are absolute, so the cache is a single flat map. The
 * view tracking of TotalMixConnection (bus, bank, page, submix) has no
 * equivalent here.
 *
 * Two write paths, matching the protocol's two value semantics:
 *
 * - set(): stateful parameters (mute, dim, faders…), where the value is the
 *   state. The cache is updated optimistically on send. TotalMix echoes a
 *   controller's own writes only when the slot's "re-send" options are enabled,
 *   which is not the default, so a read-modify-write toggle cannot depend on
 *   receiving its own write back.
 * - trigger(): (f)-typed commands (undo, snapshot/load, DURec transport…).
 *   Values below 0.5 are ignored by TotalMix, and the cache is not written: on
 *   /snapshot/load/N the same address carries TotalMix's 0/2/3 state
 *   signalling, which a cached 1.0 would overwrite.
 */

export interface GlobalConnectionOptions {
	/** Host running TotalMix FX. */
	host: string;
	/** Global OSC slot "Port incoming" — the destination port. Default 7002. */
	sendPort: number;
	/** Global OSC slot "Port outgoing" — the bound receive port. Default 9002. */
	receivePort: number;
}

/**
 * TotalMix's factory settings for the Global OSC slot. The second port pair;
 * slot 1 (7001/9001) carries the classic protocol, and both can be in use at
 * once.
 */
export const DEFAULT_GLOBAL_OPTIONS: GlobalConnectionOptions = {
	host: "127.0.0.1",
	sendPort: 7002,
	receivePort: 9002,
};

/** Called with the new value whenever a subscribed address changes. */
export type Listener = (value: OscValue) => void;

/** Timing knobs, injectable so tests can run in milliseconds. */
export interface GlobalTiming {
	/**
	 * Ms without any inbound packet before the connection is treated as stale.
	 * Status is sent at about one parameter per second, so a live link is not
	 * silent for this long.
	 */
	staleMs: number;
	/** How often to re-check and re-request when something is off. */
	refreshMs: number;
}

const DEFAULT_TIMING: GlobalTiming = { staleMs: 5000, refreshMs: 2000 };

/** Outbound flush interval: one send per address per tick. */
const SEND_COALESCE_MS = 25;

export class GlobalConnection {
	private socket: dgram.Socket | null = null;
	private options: GlobalConnectionOptions = DEFAULT_GLOBAL_OPTIONS;

	/** Absolute address -> last known value. No views, so one flat map suffices. */
	private readonly cache = new Map<string, OscValue>();

	/** Address -> subscribers. Actions are woken only for what they asked for. */
	private readonly listeners = new Map<string, Set<Listener>>();

	/** Connection up/down subscribers, separate from per-address listeners. */
	private readonly connectionListeners = new Set<(connected: boolean) => void>();

	/** Pending outbound values, flushed on a timer so dials cannot flood the wire. */
	private readonly pending = new Map<string, number>();
	private flushTimer: NodeJS.Timeout | null = null;
	private refreshTimer: NodeJS.Timeout | null = null;

	/** Timestamp of the last inbound packet, the basis of the staleness check. */
	private lastInbound = 0;
	private connectedFlag = false;

	/** Guards the one-shot "first inbound" diagnostic in handlePacket. */
	private loggedFirstInbound = false;

	/**
	 * True once non-heartbeat state has arrived. While false, the refresh timer
	 * re-sends /sendall, covering a request sent before TotalMix was listening.
	 */
	private primed = false;

	private readonly timing: GlobalTiming;

	constructor(timing: Partial<GlobalTiming> = {}) {
		this.timing = { ...DEFAULT_TIMING, ...timing };
	}

	/** True while inbound OSC is arriving; see setConnected for the transitions. */
	get connected(): boolean {
		return this.connectedFlag;
	}

	/**
	 * The resolved host and ports, after the string coercion connect() applies.
	 * Trailing underscore avoids colliding with the private `options` field.
	 */
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

	/**
	 * Binds the receive port. Resolves on "listening", and also on a bind
	 * failure, so connect() settles either way.
	 */
	private openSocket(): Promise<void> {
		return new Promise((resolve) => {
			// No reuseAddr: on UDP it permits two sockets on one port, with only
			// one of them receiving traffic. Without it, a receive port shared
			// with the classic slot raises EADDRINUSE in the error handler below.
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
				// Bind failures arrive on this event rather than as a synchronous
				// throw, so the promise is settled here as well.
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

	/**
	 * Entry point for every inbound datagram: refreshes the liveness clock, then
	 * files each message into the flat cache. A malformed packet parses to no
	 * messages and is dropped.
	 */
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
			// Overrides the flag set above: after a gap longer than staleMs the
			// rest of TotalMix's state is unknown, so a single message does not
			// count as a primed cache. Note the difference from the classic
			// connection, where the two branches are exclusive.
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
			// Applied changes are logged: the initial dump as a one-off
			// inventory, then one line per change TotalMix transmits.
			// /level/… and /status/dsp are excluded — both change many times a
			// second while audio plays, at a volume that would fill the log.
			if (!m.address.startsWith("/level/") && m.address !== g.STATUS_DSP) {
				streamDeck.logger.info(`Global OSC inbound: ${m.address} = ${String(m.value)}`);
			}
			this.cache.set(m.address, m.value);
			// /status/device is the only source of the device name; the classic
			// protocol carries no device identifier.
			if (m.address === g.STATUS_DEVICE && typeof m.value === "string") {
				rememberDevice(m.value, (msg) => streamDeck.logger.warn(msg));
			}
			this.notify(m.address, m.value);
		}
	}

	/**
	 * Wakes an address's subscribers. A throwing listener is logged and skipped
	 * so one misbehaving action cannot stop the others being updated.
	 */
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

	/**
	 * Last known value for an absolute address, or undefined if never received.
	 * Addresses name a hardware channel, so a single cached value applies
	 * everywhere and no view parameter is needed.
	 */
	get(address: string): OscValue | undefined {
		return this.cache.get(address);
	}

	/**
	 * Numeric read. Booleans collapse to 1/0 because TotalMix sends some on/off
	 * parameters as OSC booleans and others as floats for the same concept.
	 */
	getNumber(address: string, fallback = 0): number {
		const v = this.cache.get(address);
		return typeof v === "number" ? v : typeof v === "boolean" ? (v ? 1 : 0) : fallback;
	}

	/**
	 * String read, for the status block and DURec strings. Returns undefined
	 * for a non-string value rather than coercing, leaving the fallback to the
	 * caller.
	 */
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

	/**
	 * Subscribes to an address. Returns an unsubscribe function, to be called
	 * from the action's onWillDisappear; otherwise listeners accumulate as
	 * profiles switch.
	 *
	 * Any cached value is delivered on a microtask, so a button that has just
	 * appeared renders without waiting for the next change.
	 */
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

	/**
	 * Subscribes to connection up/down. Fires immediately with the current
	 * state, so a button appearing on a dead connection renders its placeholder
	 * without waiting for the next transition. Returns an unsubscribe.
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
	 * Sets a stateful parameter. Caches optimistically (see the class comment)
	 * and wakes subscribers, so a toggle's state updates without an echo from
	 * TotalMix.
	 */
	set(address: string, value: number): void {
		streamDeck.logger.info(`Global OSC out (set): ${address} = ${value}`);
		const previous = this.cache.get(address);
		this.cache.set(address, value);
		if (previous !== value) this.notify(address, value);
		this.sendBuffer(encodeFloat(address, Number(value)));
	}

	/**
	 * Fires an (f)-typed command. Not cached: on addresses like
	 * /snapshot/load/N the inbound direction carries TotalMix's 0/2/3 state
	 * signalling, which an outgoing 1.0 would overwrite.
	 */
	trigger(address: string, value = 1.0): void {
		streamDeck.logger.info(`Global OSC out (trigger): ${address} = ${value}`);
		this.sendBuffer(encodeFloat(address, Number(value)));
	}

	/**
	 * Reads the cached state of a stateful on/off parameter and sets its
	 * inverse. With nothing cached, the first press sets it on. For the
	 * receive-only group addresses (/mutegroup/N and siblings), which TotalMix
	 * does not report, the optimistic cache holds the state, so alternating
	 * presses alternate the group.
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

	/**
	 * The single outbound path for this class.
	 *
	 * send() can throw synchronously, e.g. on a socket caught mid-close. The
	 * throw is contained and logged here rather than propagating into the key
	 * handler.
	 */
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
	 * /sendall 1.0 asks TotalMix to re-send every parameter.
	 *
	 * /sendall covers the mix and channel nodes but not the status block: device
	 * name, connection flag, DSP load and the DURec strings sit behind
	 * /sendstate. Once triggered, status is pushed at about one parameter per
	 * second; repeating the trigger recovers from a dropped datagram.
	 */
	requestFullRefresh(): void {
		this.trigger(g.SEND_ALL, 1.0);
		this.trigger(g.SEND_STATE, 1.0);
	}

	/**
	 * Watchdog: re-requests state when the link has gone silent, and repeats the
	 * request while no state has arrived, covering a first /sendall sent before
	 * TotalMix was listening. Once primed and receiving, neither branch runs.
	 */
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
 * Pool, keyed by host and port pair: one connection per Global OSC controller
 * slot, shared by every action configured for it. Separate from the classic
 * pool, so a global action on 7002/9002 and a classic action on 7001/9001 hold
 * independent sockets.
 */
const pool = new Map<string, GlobalConnection>();

/**
 * The connection for a host and port pair, created on first use. Actions call
 * this on every event rather than holding a reference, so a settings change
 * moves them to the right slot without any teardown of their own.
 */
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

/** Releases every pooled Global OSC connection. Called on plugin shutdown. */
export function disposeAllGlobal(): void {
	for (const conn of pool.values()) {
		conn.dispose();
	}
	pool.clear();
}
