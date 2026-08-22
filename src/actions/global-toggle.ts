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
import { globalMixFor } from "../globalosc/connection.js";
import {
	globalConnectionOptions,
	replyGlobalChannelDatasource,
} from "../globalosc/datasource.js";
import { datasourceEvent } from "../totalmix/datasource.js";
import { num } from "../totalmix/settings.js";
import { iconFor } from "../totalmix/icons.js";
import type { ToggleParameter } from "./toggle.js";

export type GlobalToggleSettings = {
	parameter?: GlobalToggleParameter;
	/** Bus for per-channel parameters. */
	bus?: g.GlobalBus | "";
	/** 0-based channel for per-channel parameters. */
	channel?: number | string;
	/** Group number (1-4) for the group parameters. */
	index?: number;
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
	// Groups (receive-only in this protocol: no state feedback from TotalMix)
	| "muteGroup"
	| "soloGroup"
	| "faderGroup";

/** Parameters that live on a fixed bus regardless of the settings dropdown. */
const FORCED_BUS: Partial<Record<GlobalToggleParameter, g.GlobalBus>> = {
	// Preamp hardware exists on inputs only.
	chPhantom: "input",
	chInstrument: "input",
	chPad: "input",
	chAutoset: "input",
	// Room EQ exists on outputs only.
	chRoomEq: "output",
};

/** L/R-split per the table: on stereo pairs, right = channel + 1. */
const LR_PARAMETERS: ReadonlySet<GlobalToggleParameter> = new Set(["chPhase"]);

const GROUP_PARAMETERS: ReadonlySet<GlobalToggleParameter> = new Set([
	"muteGroup",
	"soloGroup",
	"faderGroup",
]);

/** Reuse the classic action's artwork; parameters map onto the same glyphs. */
const ICON_ALIAS: Record<GlobalToggleParameter, ToggleParameter> = {
	chMute: "stripMute",
	chPhase: "trim",
	chPhantom: "stripPhantom",
	chInstrument: "trim",
	chPad: "trim",
	chAutoset: "trim",
	chMsProc: "trim",
	chLoopback: "trim",
	chPfl: "stripSolo",
	chStereo: "trim",
	chRecord: "trim",
	chLowcut: "channelLowcut",
	chEq: "channelEq",
	chDynamics: "channelComp",
	chAutolevel: "channelComp",
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

/**
 * On/off control over the Global OSC protocol.
 *
 * Every parameter here is stateful-set (the value IS the state; there is no
 * kOSCScaleToggle "send 1 to flip" in this protocol), so a press reads the
 * cached state and sends the inverse. The connection caches its own writes
 * optimistically, which also covers the group addresses TotalMix never reports:
 * for those the button's own presses ARE the state, noted in the PI.
 */
@action({ UUID: "de.shellsdw.totalmix2.globaltoggle" })
export class GlobalToggle extends SingletonAction<GlobalToggleSettings> {
	private readonly cleanup = new Map<string, Array<() => void>>();

	override async onWillAppear(ev: WillAppearEvent<GlobalToggleSettings>): Promise<void> {
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
		const icons = iconFor(ICON_ALIAS[settings.parameter ?? "dim"]);

		const render = (): void => {
			const on = asBool(gm.get(address) ?? 0);
			if (target.isKey()) {
				void target.setImage(on ? icons.on : icons.off);
				void target.setState(on ? 1 : 0);
			} else {
				void target.setFeedback({ value: on ? "On" : "Off" });
			}
		};

		this.releaseFor(target.id);
		this.cleanup.set(target.id, [gm.subscribe(address, render), gm.onConnectionChange(render)]);

		render();
	}

	override onWillDisappear(ev: WillDisappearEvent<GlobalToggleSettings>): void {
		this.releaseFor(ev.action.id);
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
		const address = this.addressFor(ev.payload.settings);
		streamDeck.logger.info(`Key press: set-toggle ${address}`);
		gm.toggleSet(address);
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
				return g.channel(bus, ch, "roomeq/enable");
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

	/** Exposed for tests. */
	static isGroupParameter(p: GlobalToggleParameter): boolean {
		return GROUP_PARAMETERS.has(p);
	}

	private releaseFor(id: string): void {
		const unsubs = this.cleanup.get(id);
		if (unsubs === undefined) return;
		for (const fn of unsubs) fn();
		this.cleanup.delete(id);
	}
}
