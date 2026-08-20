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

/** Seconds without any inbound packet before the connection is treated as stale. */
const STALE_AFTER_MS = 5000;

/** How often to re-assert the page selection when nothing is arriving. */
const REFRESH_INTERVAL_MS = 2000;

/**
 * Outbound rate limit. Dial rotation fires far faster than TotalMix needs to be
 * told; coalescing to one send per address per tick keeps the wire quiet without
 * any perceptible lag.
 */
const SEND_COALESCE_MS = 25;

export class TotalMixConnection {
	private socket: dgram.Socket | null = null;
	private options: ConnectionOptions = DEFAULT_OPTIONS;

	/** Last known value for every address TotalMix has sent. */
	private readonly state = new Map<string, OscValue>();

	/** Address -> subscribers. Actions are woken only for what they asked for. */
	private readonly listeners = new Map<string, Set<Listener>>();

	/** Pending outbound values, flushed on a timer so dials cannot flood the wire. */
	private readonly pending = new Map<string, number>();
	private flushTimer: NodeJS.Timeout | null = null;

	private refreshTimer: NodeJS.Timeout | null = null;
	private lastInbound = 0;
	private connectedFlag = false;
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

		this.lastInbound = Date.now();
		this.setConnected(true);

		for (const m of messages) {
			this.applyMessage(m);
		}
	}

	private applyMessage(m: OscMessage): void {
		if (isHeartbeat(m)) return;

		const previous = this.state.get(m.address);
		if (previous === m.value) return; // unchanged; do not wake subscribers

		this.state.set(m.address, m.value);

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
	get(address: string): OscValue | undefined {
		return this.state.get(address);
	}

	getNumber(address: string, fallback = 0): number {
		const v = this.state.get(address);
		return typeof v === "number" ? v : typeof v === "boolean" ? (v ? 1 : 0) : fallback;
	}

	getString(address: string): string | undefined {
		const v = this.state.get(address);
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
		const cached = this.state.get(address);
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
		this.sendBuffer(encodeFloat(address, Number(value)));
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
		this.state.set(address, value);

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

			if (silent > STALE_AFTER_MS) {
				if (this.connectedFlag) {
					streamDeck.logger.warn(
						`No OSC from TotalMix for ${Math.round(silent / 1000)}s — re-requesting page ${this.page}.`,
					);
				}
				this.setConnected(false);
				// TotalMix may have restarted, or OSC may have been re-enabled.
				// Re-asserting the page is cheap and re-establishes the stream.
				this.requestFullRefresh();
			}
		}, REFRESH_INTERVAL_MS);

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
		this.flushTimer = null;
		this.refreshTimer = null;
		this.listeners.clear();
		this.connectionListeners.clear();
		this.state.clear();
		this.closeSocket();
	}
}

/** Shared connection. Every action uses this one socket. */
export const totalMix = new TotalMixConnection();
