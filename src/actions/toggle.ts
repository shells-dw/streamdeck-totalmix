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
import * as addr from "../totalmix/addresses.js";
import { iconFor } from "../totalmix/icons.js";
import { totalMixFor, type TotalMixConnection } from "../totalmix/connection.js";
import { seedDefaults } from "../totalmix/defaults.js";
import { connectionOptions, num } from "../totalmix/settings.js";
import {
	ALL_BUSES,
	channelView,
	focusChannel,
	INPUTS_ONLY,
	OUTPUTS_ONLY,
	pinnedBank,
	pinnedBus,
	SOURCES,
} from "../totalmix/focus.js";
import { datasourceEvent, replyStripDatasource } from "../totalmix/datasource.js";
import { alertIfDown, forgetAlertState } from "./alert.js";

export type ToggleSettings = {
	/** Which parameter to flip. */
	parameter?: ToggleParameter;
	/** 1-based fader position in the bank; also the page-2/4 channel offset. */
	strip?: number;
	/** Group or snapshot number (1-4 / 1-8), for those parameters. */
	index?: number;
	/** Bus to select before acting; empty = follow the slot. */
	bus?: "input" | "playback" | "output" | "";
	/** Bank start (0-based channel index) to select before acting; empty = leave. */
	bankStart?: number | string;
	host?: string;
	sendPort?: number;
	receivePort?: number;
};

export type ToggleParameter =
	| "mainDim"
	| "mainMono"
	| "mainMuteFx"
	| "mainSpeakerB"
	| "mainTalkback"
	| "mainExtIn"
	| "mainRecall"
	| "globalMute"
	| "globalSolo"
	| "trim"
	| "stripMute"
	| "stripSolo"
	| "stripPhantom"
	| "stripCue"
	| "channelMute"
	| "channelSolo"
	| "channelPhantom"
	| "channelEq"
	| "channelLowcut"
	| "channelComp"
	| "channelAutoLevel"
	| "channelStereo"
	| "channelPhase"
	| "channelPhaseRight"
	| "channelLoopback"
	| "channelTalkbackSel"
	| "channelNoTrim"
	| "channelInstrument"
	| "channelPad"
	| "channelMsProc"
	| "channelAutoset"
	| "channelRecord"
	| "recordStart"
	| "recordPlayPause"
	| "recordStop"
	| "muteGroup"
	| "soloGroup"
	| "faderGroup"
	| "snapshot"
	| "reverb"
	| "echo"
	| "roomEq";

/** Page-1 per-strip parameters are kOSCScaleOnOff: the value is the state, so the inverse of the cached state is sent. Everything else is kOSCScaleToggle: 1.0 flips. */
const ONOFF_PARAMETERS: ReadonlySet<ToggleParameter> = new Set([
	"stripMute",
	"stripSolo",
	"stripPhantom",
	"stripCue",
]);

/** Page-2 parameters; the channel is selected with bus, bank start and offset before writing. */
const CHANNEL_PARAMETERS: ReadonlySet<ToggleParameter> = new Set([
	"channelMute",
	"channelSolo",
	"channelPhantom",
	"channelEq",
	"channelLowcut",
	"channelComp",
	"channelAutoLevel",
	"channelStereo",
	"channelPhase",
	"channelPhaseRight",
	"channelLoopback",
	"channelTalkbackSel",
	"channelNoTrim",
	"channelInstrument",
	"channelPad",
	"channelMsProc",
	"channelAutoset",
	"channelRecord",
]);

/** Room EQ is on page 4, which selects the Output bus as a side effect. */
const isRoomEq = (p: ToggleParameter): boolean => p === "roomEq";


const isChannelParam = (p: ToggleParameter): boolean => CHANNEL_PARAMETERS.has(p) || isRoomEq(p);

/** Bus restrictions per the RME table; absent = all buses. */
const PARAMETER_BUSES: Partial<Record<ToggleParameter, readonly ("input" | "playback" | "output")[]>> = {
	stripSolo: SOURCES,
	stripPhantom: INPUTS_ONLY,
	stripCue: OUTPUTS_ONLY,
	channelSolo: SOURCES,
	channelPhantom: INPUTS_ONLY,
	channelInstrument: INPUTS_ONLY,
	channelPad: INPUTS_ONLY,
	channelAutoset: INPUTS_ONLY,
	channelMsProc: INPUTS_ONLY,
	channelLoopback: OUTPUTS_ONLY,
	channelTalkbackSel: OUTPUTS_ONLY,
	channelNoTrim: OUTPUTS_ONLY,
	roomEq: OUTPUTS_ONLY,
};

const busesFor = (p: ToggleParameter): readonly ("input" | "playback" | "output")[] =>
	PARAMETER_BUSES[p] ?? ALL_BUSES;

@action({ UUID: "de.shells.totalmixgen2.toggle" })
export class Toggle extends SingletonAction<ToggleSettings> {
	private readonly cleanup = new Map<string, Array<() => void>>();

	override async onWillAppear(ev: WillAppearEvent<ToggleSettings>): Promise<void> {
		await seedDefaults(ev.action, ev.payload.settings, "classic");
		await this.setup(ev.action, ev.payload.settings);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<ToggleSettings>): Promise<void> {
		await this.setup(ev.action, ev.payload.settings);
	}

	private async setup(
		target: WillAppearEvent<ToggleSettings>["action"],
		settings: ToggleSettings,
	): Promise<void> {
		const tm = totalMixFor(connectionOptions(settings));

		const address = this.addressFor(settings);

		const icons = iconFor(settings.parameter ?? "mainDim");

		// Pinned buttons read their own view slice.
		const bus = pinnedBus(settings);
		const bank = pinnedBank(settings);
		const parameter = settings.parameter ?? "mainDim";
		const isStripParam = String(parameter).startsWith("strip");
		const req = isStripParam
			? {
					...(bus !== undefined ? { bus } : {}),
					...(bank !== undefined ? { bank } : {}),
				}
			: isChannelParam(parameter)
				? channelView(settings, busesFor(parameter))
				: null;

		if (req !== null && (req.bus !== undefined || req.bank !== undefined)) {
			tm.requireView(req);
		}

		// Non-resident pages are collected only when declared.
		tm.declarePage(target.id, addr.pageOf(address));

		const render = (): void => {
			const on = asBool(tm.get(address, req) ?? 0);

			if (target.isKey()) {
				void target.setImage(on ? icons.on : icons.off);
				void target.setState(on ? 1 : 0);
			} else {
				void target.setFeedback({ value: on ? "On" : "Off" });
			}
		};

		this.releaseFor(target.id);
		this.cleanup.set(target.id, [
			tm.subscribe(address, render),
			tm.onConnectionChange(render),
		]);

		render();
	}

	override onWillDisappear(ev: WillDisappearEvent<ToggleSettings>): void {
		this.releaseFor(ev.action.id);
		forgetAlertState(ev.action.id);
		totalMixFor(connectionOptions(ev.payload.settings)).releasePage(ev.action.id);
	}

	override async onSendToPlugin(ev: SendToPluginEvent<{ event?: string }, ToggleSettings>): Promise<void> {
		streamDeck.logger.info(`PI -> plugin: ${JSON.stringify(ev.payload).slice(0, 160)}`);
		if (datasourceEvent(ev.payload) !== "getStrips") return;
		const settings = await ev.action.getSettings();
		const tm = totalMixFor(connectionOptions(settings));
		await replyStripDatasource(tm, "getStrips", settings, false);
	}

	override onKeyDown(ev: KeyDownEvent<ToggleSettings>): void {
		const s = ev.payload.settings;
		const tm = totalMixFor(connectionOptions(s));
		if (alertIfDown(ev.action, tm)) return;
		const parameter = s.parameter ?? "mainDim";
		const address = this.addressFor(s);

		if (ONOFF_PARAMETERS.has(parameter)) {
			// Pin bus/bank first; messages are processed in order.
			const bus = pinnedBus(s);
			const bank = pinnedBank(s);
			if (bus !== undefined) tm.toggle(addr.bus(bus));
			if (bank !== undefined) tm.send(addr.SET_BANK_START, bank);

			// kOSCScaleOnOff: send the inverse of the cached state; no cache = set on.
			const req = {
				...(bus !== undefined ? { bus } : {}),
				...(bank !== undefined ? { bank } : {}),
			};
			const next = asBool(tm.get(address, req) ?? 0) ? 0 : 1;
			streamDeck.logger.info(`Key press: set ${address} = ${next}`);
			tm.sendOffPage(address, next);
			return;
		}

		if (isChannelParam(parameter)) {
			focusChannel(tm, s, busesFor(parameter), isRoomEq(parameter) ? 4 : 2);
		}

		streamDeck.logger.info(`Key press: toggle ${address}`);
		tm.toggle(address);
	}

	private addressFor(settings: ToggleSettings): string {
		const strip = num(settings.strip, 1);
		const index = num(settings.index, 1);

		switch (settings.parameter ?? "mainDim") {
			case "mainDim":
				return addr.MAIN_DIM;
			case "mainMono":
				return addr.MAIN_MONO;
			case "mainMuteFx":
				return addr.MAIN_MUTE_FX;
			case "mainSpeakerB":
				return addr.MAIN_SPEAKER_B;
			case "mainTalkback":
				return addr.MAIN_TALKBACK;
			case "mainExtIn":
				return addr.MAIN_EXT_IN;
			case "mainRecall":
				return addr.MAIN_RECALL;
			case "globalMute":
				return addr.GLOBAL_MUTE;
			case "globalSolo":
				return addr.GLOBAL_SOLO;
			case "trim":
				return addr.TRIM;
			case "stripMute":
				return addr.mute(strip);
			case "stripSolo":
				return addr.solo(strip);
			case "stripPhantom":
				return addr.phantom(strip);
			case "stripCue":
				return addr.cue(strip);
			case "channelMute":
				return addr.CH_MUTE;
			case "channelSolo":
				return addr.CH_SOLO;
			case "channelPhantom":
				return addr.CH_PHANTOM;
			case "channelEq":
				return addr.CH_EQ_ENABLE;
			case "channelLowcut":
				return addr.CH_LOWCUT_ENABLE;
			case "channelComp":
				return addr.CH_COMP_ENABLE;
			case "channelAutoLevel":
				return addr.CH_AUTOLEVEL_ENABLE;
			case "channelStereo":
				return addr.CH_STEREO;
			case "channelPhase":
				return addr.CH_PHASE;
			case "channelPhaseRight":
				return addr.CH_PHASE_RIGHT;
			case "channelLoopback":
				return addr.CH_LOOPBACK;
			case "channelTalkbackSel":
				return addr.CH_TALKBACK_SEL;
			case "channelNoTrim":
				return addr.CH_NO_TRIM;
			case "channelInstrument":
				return addr.CH_INSTRUMENT;
			case "channelPad":
				return addr.CH_PAD;
			case "channelMsProc":
				return addr.CH_MS_PROC;
			case "channelAutoset":
				return addr.CH_AUTOSET;
			case "channelRecord":
				return addr.CH_RECORD_ENABLE;
			case "recordStart":
				return addr.RECORD_START;
			case "recordPlayPause":
				return addr.RECORD_PLAY_PAUSE;
			case "recordStop":
				return addr.RECORD_STOP;
			case "muteGroup":
				return addr.muteGroup(index);
			case "soloGroup":
				return addr.soloGroup(index);
			case "faderGroup":
				return addr.faderGroup(index);
			case "snapshot":
				return addr.snapshot(index);
			case "reverb":
				return addr.REVERB_ENABLE;
			case "echo":
				return addr.ECHO_ENABLE;
			case "roomEq":
				return addr.ROOM_EQ_ENABLE;
		}
	}

	private releaseFor(id: string): void {
		const unsubs = this.cleanup.get(id);
		if (unsubs === undefined) return;
		for (const fn of unsubs) fn();
		this.cleanup.delete(id);
	}
}
