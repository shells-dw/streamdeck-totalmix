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
import { alertIfDown, forgetAlertState } from "./alert.js";
import { washFeedback } from "./wash.js";
import { displayKeyImage, displayTouchImage, type DisplayView } from "../render/display.js";
import { PeakHold } from "./peak-hold.js";

export type GlobalDisplaySettings = {
	mode?: GlobalDisplayMode;
	/** Bus for the level meter mode. */
	bus?: g.GlobalBus | "";
	/** 0-based channel for the level meter mode. */
	channel?: number | string;
	/** Artwork: TotalMix-style panel (default) or the plain title. */
	look?: "strip" | "icon";
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

/** Repaint throttle for the level mode. */
const LEVEL_RENDER_MS = 100;

/** Meter bar span: -60 dB at empty, 0 dBFS at full. */
const METER_FLOOR_DB = -60;

/** Peak hold time and decay rate for the strip meter. */
const HOLD_MS = 1500;
const HOLD_DECAY_DB_PER_S = 12;

/** Touch-display layouts per look. */
const LAYOUT = { strip: "layouts/strip.json", icon: "layouts/volume.json" } as const;

/** Read-only display of /level, /status and /durec time/state. A press requests a full refresh. */
@action({ UUID: "de.shells.totalmixgen2.globaldisplay" })
export class GlobalDisplay extends SingletonAction<GlobalDisplaySettings> {
	private readonly cleanup = new Map<string, Array<() => void>>();

	/** Per-action render throttle (level mode). */
	private readonly lastRender = new Map<string, number>();
	private readonly renderTimers = new Map<string, NodeJS.Timeout>();

	private readonly peakHold = new PeakHold(HOLD_MS, HOLD_DECAY_DB_PER_S, LEVEL_RENDER_MS);

	/** Last image sent per action, so unchanged art is not re-sent. */
	private readonly images = new Map<string, string>();

	/** Active layout per dial, so setFeedbackLayout runs only on change. */
	private readonly layouts = new Map<string, string>();

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
			// Throttled with a trailing paint.
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

		const strip = settings.look !== "icon";
		if (target.isKey() && !strip) void target.setImage("imgs/blank");
		if (target.isDial()) {
			const layout = LAYOUT[strip ? "strip" : "icon"];
			if (this.layouts.get(target.id) !== layout) {
				this.layouts.set(target.id, layout);
				this.images.delete(target.id);
				await target.setFeedbackLayout(layout);
			}
		}

		const unsubs = [gm.subscribe(address, render), gm.onConnectionChange(render)];
		if (mode === "level") {
			unsubs.push(gm.subscribe(g.channelName(this.busOf(settings), num(settings.channel, 0)), render));
		}
		// The clock shows the transport state beside the time.
		if (mode === "durecTime") unsubs.push(gm.subscribe(g.DUREC_STATE, render));

		this.releaseFor(target.id);
		this.cleanup.set(target.id, unsubs);

		render();
	}

	override onWillDisappear(ev: WillDisappearEvent<GlobalDisplaySettings>): void {
		this.releaseFor(ev.action.id);
		this.layouts.delete(ev.action.id);
		forgetAlertState(ev.action.id);
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
		if (alertIfDown(ev.action, globalMixFor(globalConnectionOptions(ev.payload.settings)))) return;
		this.refresh(ev.payload.settings);
	}

	override onDialDown(ev: DialDownEvent<GlobalDisplaySettings>): void {
		if (alertIfDown(ev.action, globalMixFor(globalConnectionOptions(ev.payload.settings)))) return;
		this.refresh(ev.payload.settings);
	}

	private refresh(settings: GlobalDisplaySettings): void {
		globalMixFor(globalConnectionOptions(settings)).requestFullRefresh();
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

	/** Cached value formatted for the mode; undefined when nothing was received. */
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
				const text = dB <= METER_FLOOR_DB ? "-oo" : `${dB.toFixed(1)} dB`;
				const bar = Math.round(
					Math.min(1, Math.max(0, (dB - METER_FLOOR_DB) / -METER_FLOOR_DB)) * 100,
				);
				return { text, bar };
			}
			case "statusConnection":
				return { text: gm.getNumber(address, 0) >= 0.5 ? "Connected" : "No device" };
			case "statusDsp": {
				// Unit undocumented; shown as sent.
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
		const text = formatted?.text ?? "—";

		if (settings.look !== "icon") {
			await this.renderStrip(gm, target, settings, address);
			return;
		}

		if (target.isDial()) {
			// Shares the volume layout; colours must be written explicitly.
			await target.setFeedback(
				washFeedback(this.labelFor(gm, settings), text, formatted?.bar ?? 0, "none"),
			);
			return;
		}

		await target.setTitle(wrapTitle(text));
	}

	/** TotalMix-style panel for the mode; unchanged images are not re-sent. */
	private async renderStrip(
		gm: GlobalConnection,
		target: WillAppearEvent<GlobalDisplaySettings>["action"] | DialAction<GlobalDisplaySettings>,
		settings: GlobalDisplaySettings,
		address: string,
	): Promise<void> {
		const offline = !gm.connected;
		const name = this.labelFor(gm, settings);
		const raw = gm.get(address);
		let view: DisplayView;

		switch (settings.mode ?? "level") {
			case "level": {
				const peakDb = typeof raw === "number" ? raw : undefined;
				const holdDb = this.peakHold.value(target.id, peakDb, () => void this.render(gm, target, settings));
				view = { kind: "meter", name, peakDb, holdDb };
				break;
			}
			case "statusDevice":
				view = { kind: "text", name, value: typeof raw === "string" ? raw : "—" };
				break;
			case "statusConnection": {
				const on = typeof raw === "number" && raw >= 0.5;
				view = { kind: "status", name, value: raw === undefined ? "—" : on ? "Connected" : "No device", on };
				break;
			}
			case "statusDsp": {
				// Unit undocumented: a value up to 1 is read as a fraction, above as a percentage.
				const v = typeof raw === "number" ? raw : undefined;
				view = {
					kind: "gauge",
					name,
					value: v === undefined ? "—" : `${Math.round(v <= 1 ? v * 100 : v)} %`,
					fraction: v === undefined ? undefined : v <= 1 ? v : v / 100,
				};
				break;
			}
			case "durecTime":
				view = { kind: "clock", name, time: typeof raw === "string" ? raw : "—", state: gm.getString(g.DUREC_STATE) };
				break;
			case "durecState":
				view = { kind: "transport", name, state: typeof raw === "string" ? raw : undefined };
				break;
		}

		const image = target.isDial() ? displayTouchImage({ view, offline }) : displayKeyImage({ view, offline });
		if (this.images.get(target.id) === image) return;
		this.images.set(target.id, image);
		if (target.isDial()) {
			await target.setFeedback({ canvas: image });
			return;
		}
		await target.setTitle("");
		await target.setImage(image);
	}

	private releaseFor(id: string): void {
		this.images.delete(id);
		this.peakHold.forget(id);
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
