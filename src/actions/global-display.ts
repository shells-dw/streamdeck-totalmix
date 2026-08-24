import streamDeck, {
	action,
	SingletonAction,
	type DialAction,
	type DialDownEvent,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	type SendToPluginEvent,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";
import * as g from "../globalosc/addresses.js";
import { globalMixFor, type GlobalConnection } from "../globalosc/connection.js";
import {
	globalConnectionOptions,
	replyGlobalChannelDatasource,
} from "../globalosc/datasource.js";
import { datasourceEvent } from "../totalmix/datasource.js";
import { seedDefaults } from "../totalmix/defaults.js";
import { num } from "../totalmix/settings.js";
import { wrapTitle } from "../globalosc/wrap.js";

export type GlobalDisplaySettings = {
	mode?: GlobalDisplayMode;
	/** Bus for the level meter mode. */
	bus?: g.GlobalBus | "";
	/** 0-based channel for the level meter mode. */
	channel?: number | string;
	host?: string;
	sendPort?: number;
	receivePort?: number;
};

export type GlobalDisplayMode =
	| "level"
	| "statusDevice"
	| "statusConnection"
	| "statusDsp"
	| "durecTime"
	| "durecState";

/**
 * Peak meters can update many times a second even with TotalMix's send-side
 * change detection; the Stream Deck does not need repainting faster than this.
 */
const LEVEL_RENDER_MS = 100;

/** Meter bar span: -60 dB at empty, 0 dBFS at full. */
const METER_FLOOR_DB = -60;

/**
 * Read-only display of what the Global OSC protocol publishes but nothing
 * controls: peak level meters (/level/…, dB, only changing values sent), the
 * status block (/status/device | connection | dsp, sent ~1/s), and the DURec
 * time and state strings.
 *
 * A press (key or dial) requests /sendstate — the table's refresh trigger for
 * "all status messages incl. DURec" — plus a full refresh, so a stale display
 * can always be nudged by hand.
 */
@action({ UUID: "de.shellsdw.totalmix2.globaldisplay" })
export class GlobalDisplay extends SingletonAction<GlobalDisplaySettings> {
	private readonly cleanup = new Map<string, Array<() => void>>();

	/** Per-action render throttle for the fast-moving level mode. */
	private readonly lastRender = new Map<string, number>();
	private readonly renderTimers = new Map<string, NodeJS.Timeout>();

	override async onWillAppear(ev: WillAppearEvent<GlobalDisplaySettings>): Promise<void> {
		await seedDefaults(ev.action, ev.payload.settings, "global");
		await this.setup(ev.action, ev.payload.settings);
	}

	override async onDidReceiveSettings(
		ev: DidReceiveSettingsEvent<GlobalDisplaySettings>,
	): Promise<void> {
		await this.setup(ev.action, ev.payload.settings);
	}

	private async setup(
		target: WillAppearEvent<GlobalDisplaySettings>["action"],
		settings: GlobalDisplaySettings,
	): Promise<void> {
		const gm = globalMixFor(globalConnectionOptions(settings));
		const mode = settings.mode ?? "level";
		const address = this.addressFor(settings);

		const render = (): void => {
			if (mode !== "level") {
				void this.render(gm, target, settings);
				return;
			}
			// Throttled path: paint at most every LEVEL_RENDER_MS, with one
			// trailing paint so the meter always settles on the latest value.
			const now = Date.now();
			const last = this.lastRender.get(target.id) ?? 0;
			if (now - last >= LEVEL_RENDER_MS) {
				this.lastRender.set(target.id, now);
				void this.render(gm, target, settings);
				return;
			}
			if (this.renderTimers.has(target.id)) return;
			this.renderTimers.set(
				target.id,
				setTimeout(() => {
					this.renderTimers.delete(target.id);
					this.lastRender.set(target.id, Date.now());
					void this.render(gm, target, settings);
				}, LEVEL_RENDER_MS - (now - last)),
			);
		};

		// Keys draw the value as the title; a blank background makes it readable
		// instead of painting it over the plugin logo.
		if (target.isKey()) void target.setImage("imgs/blank");

		const unsubs = [gm.subscribe(address, render), gm.onConnectionChange(render)];
		if (mode === "level") {
			// The channel's name makes the meter identifiable on a dial.
			unsubs.push(gm.subscribe(g.channelName(this.busOf(settings), num(settings.channel, 0)), render));
		}

		this.releaseFor(target.id);
		this.cleanup.set(target.id, unsubs);

		render();
	}

	override onWillDisappear(ev: WillDisappearEvent<GlobalDisplaySettings>): void {
		this.releaseFor(ev.action.id);
	}

	override async onSendToPlugin(
		ev: SendToPluginEvent<{ event?: string }, GlobalDisplaySettings>,
	): Promise<void> {
		streamDeck.logger.info(`PI -> plugin: ${JSON.stringify(ev.payload).slice(0, 160)}`);
		if (datasourceEvent(ev.payload) !== "getGlobalChannels") return;
		const settings = await ev.action.getSettings();
		const gm = globalMixFor(globalConnectionOptions(settings));
		await replyGlobalChannelDatasource(gm, "getGlobalChannels", this.busOf(settings), false);
	}

	override onKeyDown(ev: KeyDownEvent<GlobalDisplaySettings>): void {
		this.refresh(ev.payload.settings);
	}

	override onDialDown(ev: DialDownEvent<GlobalDisplaySettings>): void {
		this.refresh(ev.payload.settings);
	}

	private refresh(settings: GlobalDisplaySettings): void {
		const gm = globalMixFor(globalConnectionOptions(settings));
		gm.trigger(g.SEND_STATE, 1.0);
		gm.requestFullRefresh();
	}

	private busOf(settings: GlobalDisplaySettings): g.GlobalBus {
		return settings.bus === "input" || settings.bus === "playback" || settings.bus === "output"
			? settings.bus
			: "input";
	}

	private addressFor(settings: GlobalDisplaySettings): string {
		switch (settings.mode ?? "level") {
			case "level":
				return g.level(g.levelBusOf(this.busOf(settings)), num(settings.channel, 0));
			case "statusDevice":
				return g.STATUS_DEVICE;
			case "statusConnection":
				return g.STATUS_CONNECTION;
			case "statusDsp":
				return g.STATUS_DSP;
			case "durecTime":
				return g.DUREC_TIME;
			case "durecState":
				return g.DUREC_STATE;
		}
	}

	private labelFor(gm: GlobalConnection, settings: GlobalDisplaySettings): string {
		switch (settings.mode ?? "level") {
			case "level": {
				const ch = num(settings.channel, 0);
				return gm.getString(g.channelName(this.busOf(settings), ch)) ?? `Level ${ch + 1}`;
			}
			case "statusDevice":
				return "Device";
			case "statusConnection":
				return "Connection";
			case "statusDsp":
				return "DSP";
			case "durecTime":
				return "DURec";
			case "durecState":
				return "DURec";
		}
	}

	/** Formats the cached value for this mode; undefined = nothing received. */
	private format(
		gm: GlobalConnection,
		settings: GlobalDisplaySettings,
		address: string,
	): { text: string; bar?: number } | undefined {
		const mode = settings.mode ?? "level";
		const cached = gm.get(address);
		if (cached === undefined) return undefined;

		switch (mode) {
			case "level": {
				const dB = gm.getNumber(address, METER_FLOOR_DB);
				// Deep under-range is TotalMix's "silence"; render as the meter's
				// empty state rather than an absurd number.
				const text = dB <= METER_FLOOR_DB ? "-oo" : `${dB.toFixed(1)} dB`;
				const bar = Math.round(
					Math.min(1, Math.max(0, (dB - METER_FLOOR_DB) / -METER_FLOOR_DB)) * 100,
				);
				return { text, bar };
			}
			case "statusConnection":
				return { text: gm.getNumber(address, 0) >= 0.5 ? "Connected" : "No device" };
			case "statusDsp": {
				// Unit is not documented; show the number exactly as sent.
				const v = gm.get(address);
				return { text: typeof v === "number" ? `${v}` : String(v) };
			}
			case "statusDevice":
			case "durecTime":
			case "durecState": {
				const s = gm.getString(address);
				return s === undefined ? undefined : { text: s };
			}
		}
	}

	private async render(
		gm: GlobalConnection,
		target: WillAppearEvent<GlobalDisplaySettings>["action"] | DialAction<GlobalDisplaySettings>,
		settings: GlobalDisplaySettings,
	): Promise<void> {
		const address = this.addressFor(settings);
		const formatted = this.format(gm, settings, address);
		// Unlike a control, a readout stays useful while the link is quiet:
		// TotalMix only transmits CHANGES, so long silence is normal and the
		// last-known value is the truth. Only an empty cache shows the dash.
		const text = formatted?.text ?? "—";

		if (target.isDial()) {
			await target.setFeedback({
				title: this.labelFor(gm, settings),
				value: text,
				indicator: { value: formatted?.bar ?? 0 },
			});
			return;
		}

		// Keys cut long texts (device names!) at the edge; wrap them instead.
		await target.setTitle(wrapTitle(text));
	}

	private releaseFor(id: string): void {
		const unsubs = this.cleanup.get(id);
		if (unsubs === undefined) return;
		for (const fn of unsubs) fn();
		this.cleanup.delete(id);
		const timer = this.renderTimers.get(id);
		if (timer !== undefined) clearTimeout(timer);
		this.renderTimers.delete(id);
		this.lastRender.delete(id);
	}
}
