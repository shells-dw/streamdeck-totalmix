import streamDeck, {
	action,
	SingletonAction,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	type SendToPluginEvent,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";
import { asBool } from "../osc/codec.js";
import * as g from "../globalosc/addresses.js";
import { globalMixFor, type GlobalConnection } from "../globalosc/connection.js";
import {
	globalConnectionOptions,
	replyGlobalChannelDatasource,
} from "../globalosc/datasource.js";
import { datasourceEvent } from "../totalmix/datasource.js";
import { seedDefaults } from "../totalmix/defaults.js";
import { num } from "../totalmix/settings.js";
import { iconFor } from "../totalmix/icons.js";
import type { ToggleParameter } from "./toggle.js";
import { alertIfDown, forgetAlertState } from "./alert.js";
import { buttonKeyImage } from "../render/strip.js";
import { TM } from "../render/theme.js";

export type GlobalToggleSettings = {
	parameter?: GlobalToggleParameter;
	/** Bus for per-channel parameters. */
	bus?: g.GlobalBus | "";
	/** 0-based channel for per-channel parameters. */
	channel?: number | string;
	/** Group number (1-4) for the group parameters. */
	index?: number;
	/** Artwork: TotalMix-style button (default) or the classic icon pair. */
	look?: "strip" | "icon";
	host?: string;
	sendPort?: number;
	receivePort?: number;
};

export type GlobalToggleParameter =
	// Per-channel (bus + channel)
	| "chMute"
	| "chPhase"
	| "chPhantom"
	| "chInstrument"
	| "chPad"
	| "chAutoset"
	| "chMsProc"
	| "chLoopback"
	| "chPfl"
	| "chStereo"
	| "chRecord"
	| "chLowcut"
	| "chEq"
	| "chDynamics"
	| "chAutolevel"
	| "chRoomEq"
	// Control room
	| "dim"
	| "mono"
	| "talkback"
	| "externalIn"
	| "speakerB"
	| "muteFx"
	| "linkAb"
	// Global
	| "globalMute"
	| "globalSolo"
	// Effects
	| "reverb"
	| "echo"
	// Groups (receive only; no state feedback)
	| "muteGroup"
	| "soloGroup"
	| "faderGroup";

/** Parameters bound to one bus regardless of the settings dropdown. */
const FORCED_BUS: Partial<Record<GlobalToggleParameter, g.GlobalBus>> = {
	chPhantom: "input",
	chInstrument: "input",
	chPad: "input",
	chAutoset: "input",
	chRoomEq: "output",
};

/** L/R-split per the table (right = channel + 1). */
const LR_PARAMETERS: ReadonlySet<GlobalToggleParameter> = new Set(["chPhase"]);

/** Classic-action icon for each parameter. */
const ICON_ALIAS: Record<GlobalToggleParameter, ToggleParameter> = {
	chMute: "stripMute",
	chPhase: "channelPhase",
	chPhantom: "stripPhantom",
	chInstrument: "channelInstrument",
	chPad: "channelPad",
	chAutoset: "channelAutoset",
	chMsProc: "channelMsProc",
	chLoopback: "channelLoopback",
	chPfl: "stripSolo",
	chStereo: "channelStereo",
	chRecord: "channelRecord",
	chLowcut: "channelLowcut",
	chEq: "channelEq",
	chDynamics: "channelComp",
	chAutolevel: "channelAutoLevel",
	chRoomEq: "roomEq",
	dim: "mainDim",
	mono: "mainMono",
	talkback: "mainTalkback",
	externalIn: "mainExtIn",
	speakerB: "mainSpeakerB",
	muteFx: "mainMuteFx",
	linkAb: "mainSpeakerB",
	globalMute: "globalMute",
	globalSolo: "globalSolo",
	reverb: "reverb",
	echo: "echo",
	muteGroup: "muteGroup",
	soloGroup: "soloGroup",
	faderGroup: "faderGroup",
};

/** Face caption and lit colour for the TotalMix-style button. */
const FACE: Record<GlobalToggleParameter, { label: string; colour: string }> = {
	chMute: { label: "M", colour: TM.mute },
	chPhase: { label: "Ø", colour: TM.fxOn },
	chPhantom: { label: "48V", colour: TM.hot },
	chInstrument: { label: "INST", colour: TM.mute },
	chPad: { label: "PAD", colour: TM.mute },
	chAutoset: { label: "ASET", colour: TM.mute },
	chMsProc: { label: "MS", colour: TM.mute },
	chLoopback: { label: "LOOP", colour: TM.mute },
	chPfl: { label: "S", colour: TM.solo },
	chStereo: { label: "ST", colour: TM.mute },
	chRecord: { label: "REC", colour: TM.hot },
	chLowcut: { label: "LC", colour: TM.fxOn },
	chEq: { label: "EQ", colour: TM.fxOn },
	chDynamics: { label: "D", colour: TM.fxOn },
	chAutolevel: { label: "AL", colour: TM.fxOn },
	chRoomEq: { label: "REQ", colour: TM.fxOn },
	dim: { label: "DIM", colour: TM.mute },
	mono: { label: "MONO", colour: TM.mute },
	talkback: { label: "TALK", colour: TM.solo },
	externalIn: { label: "EXT", colour: TM.mute },
	speakerB: { label: "SPK B", colour: TM.mute },
	muteFx: { label: "MUTE FX", colour: TM.mute },
	linkAb: { label: "LINK", colour: TM.mute },
	globalMute: { label: "M", colour: TM.mute },
	globalSolo: { label: "S", colour: TM.solo },
	reverb: { label: "REV", colour: TM.fxOn },
	echo: { label: "ECHO", colour: TM.fxOn },
	muteGroup: { label: "M", colour: TM.mute },
	soloGroup: { label: "S", colour: TM.solo },
	faderGroup: { label: "F", colour: TM.mute },
};

/**
 * Global OSC on/off control. Every parameter is stateful (the value is the
 * state), so a press sends the inverse of the cached state. Group addresses
 * are never reported by TotalMix; their state is the optimistic cache.
 */
@action({ UUID: "de.shells.totalmixgen2.globaltoggle" })
export class GlobalToggle extends SingletonAction<GlobalToggleSettings> {
	private readonly cleanup = new Map<string, Array<() => void>>();

	/** Last key image sent per action, so an unchanged face is not re-sent. */
	private readonly keyImages = new Map<string, string>();

	override async onWillAppear(ev: WillAppearEvent<GlobalToggleSettings>): Promise<void> {
		await seedDefaults(ev.action, ev.payload.settings, "global");
		await this.setup(ev.action, ev.payload.settings);
	}

	override async onDidReceiveSettings(
		ev: DidReceiveSettingsEvent<GlobalToggleSettings>,
	): Promise<void> {
		await this.setup(ev.action, ev.payload.settings);
	}

	private async setup(
		target: WillAppearEvent<GlobalToggleSettings>["action"],
		settings: GlobalToggleSettings,
	): Promise<void> {
		const gm = globalMixFor(globalConnectionOptions(settings));
		const address = this.addressFor(settings);
		const parameter = settings.parameter ?? "dim";
		const icons = iconFor(ICON_ALIAS[parameter]);
		const strip = settings.look !== "icon";
		const captionAddress = this.captionAddress(settings);

		const render = (): void => {
			const on = asBool(gm.get(address) ?? 0);
			if (!target.isKey()) {
				void target.setFeedback({ value: on ? "On" : "Off" });
				return;
			}
			void target.setState(on ? 1 : 0);
			if (!strip) {
				this.setKeyImage(target, on ? icons.on : icons.off);
				return;
			}
			const face = FACE[parameter];
			this.setKeyImage(
				target,
				buttonKeyImage({
					label: face.label,
					caption: this.captionFor(settings, gm),
					on,
					colour: face.colour,
					offline: !gm.connected,
				}),
			);
		};

		this.releaseFor(target.id);
		const unsubs = [gm.subscribe(address, render), gm.onConnectionChange(render)];
		if (strip && captionAddress !== undefined) unsubs.push(gm.subscribe(captionAddress, render));
		this.cleanup.set(target.id, unsubs);

		render();
	}

	override onWillDisappear(ev: WillDisappearEvent<GlobalToggleSettings>): void {
		this.releaseFor(ev.action.id);
		forgetAlertState(ev.action.id);
	}

	override async onSendToPlugin(
		ev: SendToPluginEvent<{ event?: string }, GlobalToggleSettings>,
	): Promise<void> {
		streamDeck.logger.info(`PI -> plugin: ${JSON.stringify(ev.payload).slice(0, 160)}`);
		if (datasourceEvent(ev.payload) !== "getGlobalChannels") return;
		const settings = await ev.action.getSettings();
		const gm = globalMixFor(globalConnectionOptions(settings));
		const parameter = settings.parameter ?? "dim";
		await replyGlobalChannelDatasource(
			gm,
			"getGlobalChannels",
			this.busOf(settings),
			LR_PARAMETERS.has(parameter),
		);
	}

	override onKeyDown(ev: KeyDownEvent<GlobalToggleSettings>): void {
		const gm = globalMixFor(globalConnectionOptions(ev.payload.settings));
		if (alertIfDown(ev.action, gm)) return;
		const address = this.addressFor(ev.payload.settings);
		streamDeck.logger.info(`Key press: set-toggle ${address}`);
		gm.toggleSet(address);
	}

	/** Sends a key image once per change. */
	private setKeyImage(
		target: { id: string; setImage: (image?: string) => Promise<void> },
		image: string,
	): void {
		if (this.keyImages.get(target.id) === image) return;
		this.keyImages.set(target.id, image);
		void target.setImage(image);
	}

	/** Name address that feeds the caption for per-channel parameters. */
	private captionAddress(settings: GlobalToggleSettings): string | undefined {
		const parameter = settings.parameter ?? "dim";
		if (!parameter.startsWith("ch")) return undefined;
		return g.channelName(this.busOf(settings), num(settings.channel, 0));
	}

	/** Caption under the face: channel name, group number, or nothing. */
	private captionFor(settings: GlobalToggleSettings, gm: GlobalConnection): string {
		const parameter = settings.parameter ?? "dim";
		if (parameter.startsWith("ch")) {
			const ch = num(settings.channel, 0);
			return gm.getString(g.channelName(this.busOf(settings), ch)) ?? `Ch ${ch + 1}`;
		}
		switch (parameter) {
			case "muteGroup":
			case "soloGroup":
			case "faderGroup":
				return `Group ${num(settings.index, 1)}`;
			case "globalMute":
			case "globalSolo":
				return "All";
			default:
				return "";
		}
	}

	private busOf(settings: GlobalToggleSettings): g.GlobalBus {
		const forced = FORCED_BUS[settings.parameter ?? "dim"];
		if (forced !== undefined) return forced;
		return settings.bus === "input" || settings.bus === "playback" || settings.bus === "output"
			? settings.bus
			: "input";
	}

	private addressFor(settings: GlobalToggleSettings): string {
		const parameter = settings.parameter ?? "dim";
		const ch = num(settings.channel, 0);
		const index = num(settings.index, 1);
		const bus = this.busOf(settings);

		switch (parameter) {
			case "chMute":
				return g.channel(bus, ch, "mute");
			case "chPhase":
				return g.channel(bus, ch, "phase");
			case "chPhantom":
				return g.channel(bus, ch, "48v");
			case "chInstrument":
				return g.channel(bus, ch, "instrument");
			case "chPad":
				return g.channel(bus, ch, "pad");
			case "chAutoset":
				return g.channel(bus, ch, "autoset");
			case "chMsProc":
				return g.channel(bus, ch, "msproc");
			case "chLoopback":
				return g.channel(bus, ch, "loopback");
			case "chPfl":
				return g.channel(bus, ch, "pfl");
			case "chStereo":
				return g.channel(bus, ch, "stereo");
			case "chRecord":
				return g.channel(bus, ch, "record");
			case "chLowcut":
				return g.channel(bus, ch, "lowcut/enable");
			case "chEq":
				return g.channel(bus, ch, "eq/enable");
			case "chDynamics":
				return g.channel(bus, ch, "dynamics/enable");
			case "chAutolevel":
				return g.channel(bus, ch, "autolevel/enable");
			case "chRoomEq":
				return g.channelRoomEqEnable(bus, ch);
			case "dim":
				return g.CR_DIM;
			case "mono":
				return g.CR_MAIN_MONO;
			case "talkback":
				return g.CR_TALKBACK;
			case "externalIn":
				return g.CR_EXTERNAL_IN;
			case "speakerB":
				return g.CR_SPEAKER_B;
			case "muteFx":
				return g.CR_MUTE_FX;
			case "linkAb":
				return g.CR_LINK_AB;
			case "globalMute":
				return g.GLOBAL_MUTE;
			case "globalSolo":
				return g.GLOBAL_SOLO;
			case "reverb":
				return g.REVERB_ENABLE;
			case "echo":
				return g.ECHO_ENABLE;
			case "muteGroup":
				return g.muteGroup(index);
			case "soloGroup":
				return g.soloGroup(index);
			case "faderGroup":
				return g.faderGroup(index);
		}
	}

	private releaseFor(id: string): void {
		this.keyImages.delete(id);
		const unsubs = this.cleanup.get(id);
		if (unsubs === undefined) return;
		for (const fn of unsubs) fn();
		this.cleanup.delete(id);
	}
}
