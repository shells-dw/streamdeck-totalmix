import streamDeck, {
	action,
	SingletonAction,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	type SendToPluginEvent,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";
import * as g from "../globalosc/addresses.js";
import { buttonKeyImage, type ButtonGlyph } from "../render/strip.js";
import { TM } from "../render/theme.js";
import { globalMixFor } from "../globalosc/connection.js";
import {
	globalConnectionOptions,
	replyGlobalChannelDatasource,
} from "../globalosc/datasource.js";
import { datasourceEvent } from "../totalmix/datasource.js";
import { seedDefaults } from "../totalmix/defaults.js";
import { num } from "../totalmix/settings.js";
import { alertIfDown, forgetAlertState } from "./alert.js";

export type GlobalTriggerSettings = {
	mode?: GlobalTriggerMode;
	/** Snapshot (1-8), layout or preset number (from 1). */
	index?: number | string;
	/** Bus for the per-channel preset loads. */
	bus?: g.GlobalBus | "";
	/** 0-based channel for the per-channel preset loads. */
	channel?: number | string;
	/** Artwork: TotalMix-style button (default) or the classic icon pair. */
	look?: "strip" | "icon";
	host?: string;
	sendPort?: number;
	receivePort?: number;
};

export type GlobalTriggerMode =
	| "snapshot"
	| "layout"
	| "eqPreset"
	| "dynamicsPreset"
	| "roomEqPreset"
	| "reverbPreset"
	| "echoPreset"
	| "undo"
	| "redo"
	| "recall"
	| "durecPlay"
	| "durecPause"
	| "durecStop"
	| "durecRecord"
	| "durecNext"
	| "durecPrevious"
	| "showWindow"
	| "hideWindow";

/** Preset loads that take a bus and channel. */
const CHANNEL_PRESET_MODES: ReadonlySet<GlobalTriggerMode> = new Set([
	"eqPreset",
	"dynamicsPreset",
	"roomEqPreset",
]);

/** /durec/state string that lights each transport key. */
const DUREC_STATE_MATCH: Partial<Record<GlobalTriggerMode, string>> = {
	durecPlay: "Play",
	durecPause: "Pause",
	durecStop: "Stop",
	durecRecord: "Record",
};

/** Snapshot state artwork (DisableAutomaticStates: state follows TotalMix reports). */
const STATE_IMG = { on: "imgs/mixerOn", off: "imgs/mixerOff" } as const;

/** Transport artwork per mode; absent = STATE_IMG. */
const MODE_IMG: Partial<Record<string, { on: string; off: string }>> = {
	durecRecord: { on: "imgs/recOn", off: "imgs/recOff" },
	durecPlay: { on: "imgs/playOn", off: "imgs/playOff" },
	durecPause: { on: "imgs/playOn", off: "imgs/playOff" },
	durecStop: { on: "imgs/stopOn", off: "imgs/stopOff" },
};

/** TotalMix-style face per mode: label or glyph, caption, lit colour. */
const FACE: Record<GlobalTriggerMode, { label?: string; glyph?: ButtonGlyph; caption: string; colour: string }> = {
	snapshot: { caption: "Snapshot", colour: TM.mute },
	layout: { caption: "Layout", colour: TM.mute },
	eqPreset: { label: "EQ", caption: "Preset", colour: TM.fxOn },
	dynamicsPreset: { label: "D", caption: "Preset", colour: TM.fxOn },
	roomEqPreset: { label: "REQ", caption: "Preset", colour: TM.fxOn },
	reverbPreset: { label: "REV", caption: "Preset", colour: TM.fxOn },
	echoPreset: { label: "ECHO", caption: "Preset", colour: TM.fxOn },
	undo: { glyph: "undo", caption: "Undo", colour: TM.mute },
	redo: { glyph: "redo", caption: "Redo", colour: TM.mute },
	recall: { label: "RCL", caption: "Recall", colour: TM.mute },
	durecPlay: { glyph: "play", caption: "DURec", colour: "#2ec84a" },
	durecPause: { glyph: "pause", caption: "DURec", colour: TM.mute },
	durecStop: { glyph: "stop", caption: "DURec", colour: TM.mute },
	durecRecord: { glyph: "record", caption: "DURec", colour: TM.hot },
	durecNext: { glyph: "next", caption: "DURec", colour: TM.mute },
	durecPrevious: { glyph: "previous", caption: "DURec", colour: TM.mute },
	showWindow: { glyph: "window", caption: "Show", colour: TM.mute },
	hideWindow: { glyph: "window", caption: "Hide", colour: TM.mute },
};

/**
 * Global OSC (f) commands (value < 0.5 ignored) plus /showwindow (plain f).
 * Snapshot keys light on /snapshot/load/N >= 2; transport keys on the
 * matching /durec/state string.
 */
@action({ UUID: "de.shells.totalmixgen2.globaltrigger" })
export class GlobalTrigger extends SingletonAction<GlobalTriggerSettings> {
	private readonly cleanup = new Map<string, Array<() => void>>();

	/** Last key image sent per action, so an unchanged face is not re-sent. */
	private readonly keyImages = new Map<string, string>();

	override async onWillAppear(ev: WillAppearEvent<GlobalTriggerSettings>): Promise<void> {
		await seedDefaults(ev.action, ev.payload.settings, "global");
		await this.setup(ev.action, ev.payload.settings);
	}

	override async onDidReceiveSettings(
		ev: DidReceiveSettingsEvent<GlobalTriggerSettings>,
	): Promise<void> {
		await this.setup(ev.action, ev.payload.settings);
	}

	private async setup(
		target: WillAppearEvent<GlobalTriggerSettings>["action"],
		settings: GlobalTriggerSettings,
	): Promise<void> {
		const gm = globalMixFor(globalConnectionOptions(settings));
		const mode = settings.mode ?? "snapshot";

		const unsubs: Array<() => void> = [];
		const strip = settings.look !== "icon";

		const paint = (on: boolean, icon: { on: string; off: string }): void => {
			if (!target.isKey()) return;
			void target.setState(on ? 1 : 0);
			const image = strip ? this.faceImage(mode, settings, on, !gm.connected) : on ? icon.on : icon.off;
			if (this.keyImages.get(target.id) === image) return;
			this.keyImages.set(target.id, image);
			void target.setImage(image);
		};

		if (mode === "snapshot") {
			const address = g.snapshotLoad(this.snapshotNumber(settings));
			// 0 = off, 2 = active, 3 = changed.
			const render = (): void => paint(gm.getNumber(address, 0) >= 2, STATE_IMG);
			unsubs.push(gm.subscribe(address, render), gm.onConnectionChange(render));
			render();
		} else if (DUREC_STATE_MATCH[mode] !== undefined) {
			const img = MODE_IMG[mode] ?? STATE_IMG;
			const render = (): void => paint(gm.getString(g.DUREC_STATE) === DUREC_STATE_MATCH[mode], img);
			unsubs.push(gm.subscribe(g.DUREC_STATE, render), gm.onConnectionChange(render));
			render();
		} else if (strip) {
			// Stateless modes: static face that only reacts to the connection.
			const render = (): void => paint(false, STATE_IMG);
			unsubs.push(gm.onConnectionChange(render));
			render();
		} else if (target.isKey()) {
			// Stateless modes: restore the manifest/user image.
			this.keyImages.delete(target.id);
			void target.setImage();
			void target.setState(0);
		}

		this.releaseFor(target.id);
		this.cleanup.set(target.id, unsubs);
	}

	override onWillDisappear(ev: WillDisappearEvent<GlobalTriggerSettings>): void {
		this.releaseFor(ev.action.id);
		forgetAlertState(ev.action.id);
	}

	override async onSendToPlugin(
		ev: SendToPluginEvent<{ event?: string }, GlobalTriggerSettings>,
	): Promise<void> {
		if (datasourceEvent(ev.payload) !== "getGlobalChannels") return;
		const settings = await ev.action.getSettings();
		const gm = globalMixFor(globalConnectionOptions(settings));
		await replyGlobalChannelDatasource(gm, "getGlobalChannels", this.busOf(settings), false);
	}

	/** Bus for the per-channel preset loads; Room EQ exists on outputs only. */
	private busOf(settings: GlobalTriggerSettings): g.GlobalBus {
		if ((settings.mode ?? "snapshot") === "roomEqPreset") return "output";
		return settings.bus === "input" || settings.bus === "playback" || settings.bus === "output"
			? settings.bus
			: "input";
	}

	private channelOf(settings: GlobalTriggerSettings): number {
		return Math.max(0, num(settings.channel, 0));
	}

	override onKeyDown(ev: KeyDownEvent<GlobalTriggerSettings>): void {
		const settings = ev.payload.settings;
		const gm = globalMixFor(globalConnectionOptions(settings));
		if (alertIfDown(ev.action, gm)) return;
		const mode = settings.mode ?? "snapshot";
		streamDeck.logger.info(`Key press: global trigger ${mode}`);

		switch (mode) {
			case "snapshot":
				gm.trigger(g.snapshotLoad(this.snapshotNumber(settings)), 1.0);
				return;
			case "layout":
				gm.trigger(g.layoutLoad(Math.max(1, num(settings.index, 1))), 1.0);
				return;
			case "eqPreset":
				gm.trigger(
					g.channelEqLoadPreset(this.busOf(settings), this.channelOf(settings)),
					g.presetNumber(num(settings.index, 1)),
				);
				return;
			case "dynamicsPreset":
				gm.trigger(
					g.channelDynamicsLoadPreset(this.busOf(settings), this.channelOf(settings)),
					g.presetNumber(num(settings.index, 1)),
				);
				return;
			case "roomEqPreset":
				gm.trigger(
					g.channelRoomEqLoadPreset(this.busOf(settings), this.channelOf(settings)),
					g.presetNumber(num(settings.index, 1)),
				);
				return;
			case "reverbPreset":
				gm.trigger(g.REVERB_LOAD_PRESET, g.presetNumber(num(settings.index, 1)));
				return;
			case "echoPreset":
				gm.trigger(g.ECHO_LOAD_PRESET, g.presetNumber(num(settings.index, 1)));
				return;
			case "undo":
				gm.trigger(g.UNDO, 1.0);
				return;
			case "redo":
				gm.trigger(g.REDO, 1.0);
				return;
			case "recall":
				gm.trigger(g.CR_RECALL, 1.0);
				return;
			case "durecPlay":
				gm.trigger(g.DUREC_PLAY, 1.0);
				return;
			case "durecPause":
				gm.trigger(g.DUREC_PAUSE, 1.0);
				return;
			case "durecStop":
				// 1.0: stopping a recording needs two presses; > 10 would bypass that.
				gm.trigger(g.DUREC_STOP, 1.0);
				return;
			case "durecRecord":
				gm.trigger(g.DUREC_RECORD, 1.0);
				return;
			case "durecNext":
				gm.trigger(g.DUREC_NEXT, 1.0);
				return;
			case "durecPrevious":
				gm.trigger(g.DUREC_PREVIOUS, 1.0);
				return;
			case "showWindow":
				gm.trigger(g.SHOW_WINDOW, 1.0);
				return;
			case "hideWindow":
				gm.trigger(g.SHOW_WINDOW, 0.0);
				return;
		}
	}

	private snapshotNumber(settings: GlobalTriggerSettings): number {
		return Math.min(Math.max(num(settings.index, 1), 1), 8);
	}

	/** Button face for a mode; numbered modes print their number on the face. */
	private faceImage(mode: GlobalTriggerMode, settings: GlobalTriggerSettings, on: boolean, offline: boolean): string {
		const face = FACE[mode];
		const index = num(settings.index, 1);
		const numbered = mode === "snapshot" || mode === "layout";
		return buttonKeyImage({
			label: face.label ?? (numbered ? String(index) : mode.toUpperCase()),
			glyph: face.glyph,
			caption: numbered || face.caption === "Preset" ? `${face.caption} ${index}` : face.caption,
			on,
			colour: face.colour,
			offline,
		});
	}

	private releaseFor(id: string): void {
		this.keyImages.delete(id);
		const unsubs = this.cleanup.get(id);
		if (unsubs === undefined) return;
		for (const fn of unsubs) fn();
		this.cleanup.delete(id);
	}
}
