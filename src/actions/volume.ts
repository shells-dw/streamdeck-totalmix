import streamDeck, {
	action,
	SingletonAction,
	type DialAction,
	type DialDownEvent,
	type DialRotateEvent,
	type DidReceiveSettingsEvent,
	type FeedbackPayload,
	type KeyDownEvent,
	type SendToPluginEvent,
	type TouchTapEvent,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";
import { asBool } from "../osc/codec.js";
import { DbScale, parseDb } from "../osc/dbscale.js";
import {
	dbToFader,
	faderToBar,
	formatDb,
	formatPan,
	freqToValue,
	isMinusInfinity,
	stepDb,
	valueToFreq,
} from "../osc/curves.js";
import * as addr from "../totalmix/addresses.js";
import { totalMixFor, type TotalMixConnection, type ViewRequirement } from "../totalmix/connection.js";
import { seedDefaults } from "../totalmix/defaults.js";
import { computeNext, formatGain, FX_STEP, PAN_STEP } from "../osc/steps.js";
import { gainRangeDb } from "../totalmix/devices.js";
import { connectionOptions, num } from "../totalmix/settings.js";
import {
	ALL_BUSES,
	channelView,
	focusChannel,
	OUTPUTS_ONLY,
	SOURCES,
} from "../totalmix/focus.js";
import { datasourceEvent, replyStripDatasource } from "../totalmix/datasource.js";
import { alertIfDown, forgetAlertState } from "./alert.js";
import {
	CLASSIC,
	GESTURE_LABELS,
	resolveGesture,
	type ClassicKind,
	type Gesture,
	type GestureSlot,
} from "./gestures.js";
import { washFeedback, type Wash } from "./wash.js";
import { nudgeIcon } from "../totalmix/icons.js";

export type VolumeSettings = {
	/** "main" = mastervolume; "gain" = strip preamp (input bus only); "fx*" = effect parameters. */
	target?: "main" | "strip" | "channel" | "gain" | "pan" | "stripPan" | FxTarget;
	/** 1-based strip within the current bank, when target is "strip" or "stripPan". */
	strip?: number;
	/** Bus to select before acting; empty = follow the slot. */
	bus?: "input" | "playback" | "output" | "";
	/** Bank start (0-based channel index) to select before acting; empty = leave. */
	bankStart?: number | string;
	/** dB moved per dial detent, or per key press. */
	stepDb?: number;
	/** dB per detent or press for the effect parameters TotalMix displays in dB. */
	fxStepDb?: number;
	/** Hz per detent for kOSCScaleFreq parameters. */
	fxHz?: number;
	/** Position count of a selection parameter (device dependent). */
	fxPositions?: number;
	/** Percent of range per detent for unitless kOSCScaleLin01 parameters. */
	fxPercent?: number;
	/** RME device id, for the gain span. Empty or "auto" means detect. */
	device?: string;
	/** Key placement only: whether a press nudges the value up or down. */
	nudge?: "up" | "down";
	/** Dial placement only: what pressing the dial does. Unset means the target's default. */
	press?: Gesture;
	/** Dial placement only: what tapping the touch display does. Unset means the target's default. */
	touch?: Gesture;
	host?: string;
	sendPort?: number;
	receivePort?: number;
};

/** Default dB per detent/press. */
const DEFAULT_STEP_DB = 1.5;

/** Minimum interval between bus/bank pins per action (once per gesture, not per tick). */
const PIN_INTERVAL_MS = 400;

export type FxTarget = keyof typeof FX_TARGETS;

/**
 * Continuous effect parameters. `press` is the section enable a dial press
 * flips; `scope` "channel" = page 2 (needs a channel selected), "global" =
 * page 3 units. `unit` selects the stepping law; readouts use TotalMix's Val
 * string.
 */
const FX_TARGETS = {
	// Per channel (page 2).
	fxReverbSend: { address: addr.CH_REVERB_SEND, press: addr.REVERB_ENABLE, label: "FX Send", scope: "channel", unit: "db" },
	fxReverbReturn: { address: addr.CH_REVERB_RETURN, press: addr.REVERB_ENABLE, label: "FX Return", scope: "channel", unit: "db" },
	// Low cut, per channel (page 2).
	fxLowcutFreq: { address: addr.CH_LOWCUT_FREQ, press: addr.CH_LOWCUT_ENABLE, label: "Low Cut", scope: "channel", unit: "freq" },
	fxLowcutGrade: { address: addr.CH_LOWCUT_GRADE, press: addr.CH_LOWCUT_ENABLE, label: "LC Slope", scope: "channel", unit: "selection" },

	// Parametric EQ (page 2); types on bands 1 and 3 only.
	fxEqType1: { address: addr.CH_EQ_TYPE1, press: addr.CH_EQ_ENABLE, label: "EQ1 Type", scope: "channel", unit: "selection" },
	fxEqGain1: { address: addr.CH_EQ_GAIN1, press: addr.CH_EQ_ENABLE, label: "EQ1 Gain", scope: "channel", unit: "db" },
	fxEqFreq1: { address: addr.CH_EQ_FREQ1, press: addr.CH_EQ_ENABLE, label: "EQ1 Freq", scope: "channel", unit: "freq" },
	fxEqQ1: { address: addr.CH_EQ_Q1, press: addr.CH_EQ_ENABLE, label: "EQ1 Q", scope: "channel", unit: "raw" },
	fxEqGain2: { address: addr.CH_EQ_GAIN2, press: addr.CH_EQ_ENABLE, label: "EQ2 Gain", scope: "channel", unit: "db" },
	fxEqFreq2: { address: addr.CH_EQ_FREQ2, press: addr.CH_EQ_ENABLE, label: "EQ2 Freq", scope: "channel", unit: "freq" },
	fxEqQ2: { address: addr.CH_EQ_Q2, press: addr.CH_EQ_ENABLE, label: "EQ2 Q", scope: "channel", unit: "raw" },
	fxEqType3: { address: addr.CH_EQ_TYPE3, press: addr.CH_EQ_ENABLE, label: "EQ3 Type", scope: "channel", unit: "selection" },
	fxEqGain3: { address: addr.CH_EQ_GAIN3, press: addr.CH_EQ_ENABLE, label: "EQ3 Gain", scope: "channel", unit: "db" },
	fxEqFreq3: { address: addr.CH_EQ_FREQ3, press: addr.CH_EQ_ENABLE, label: "EQ3 Freq", scope: "channel", unit: "freq" },
	fxEqQ3: { address: addr.CH_EQ_Q3, press: addr.CH_EQ_ENABLE, label: "EQ3 Q", scope: "channel", unit: "raw" },

	// Dynamics (page 2); one enable for compressor and expander.
	fxCompThreshold: { address: addr.CH_COMP_THRESHOLD, press: addr.CH_COMP_ENABLE, label: "Comp Thresh", scope: "channel", unit: "db" },
	fxCompRatio: { address: addr.CH_COMP_RATIO, press: addr.CH_COMP_ENABLE, label: "Comp Ratio", scope: "channel", unit: "raw" },
	fxCompAttack: { address: addr.CH_COMP_ATTACK, press: addr.CH_COMP_ENABLE, label: "Attack", scope: "channel", unit: "raw" },
	fxCompRelease: { address: addr.CH_COMP_RELEASE, press: addr.CH_COMP_ENABLE, label: "Release", scope: "channel", unit: "raw" },
	fxCompGain: { address: addr.CH_COMP_GAIN, press: addr.CH_COMP_ENABLE, label: "Makeup Gain", scope: "channel", unit: "db" },
	fxExpThreshold: { address: addr.CH_EXP_THRESHOLD, press: addr.CH_COMP_ENABLE, label: "Exp Thresh", scope: "channel", unit: "db" },
	fxExpRatio: { address: addr.CH_EXP_RATIO, press: addr.CH_COMP_ENABLE, label: "Exp Ratio", scope: "channel", unit: "raw" },

	// Auto Level, per channel (page 2).
	fxAutoLevelMaxGain: { address: addr.CH_AUTOLEVEL_MAXGAIN, press: addr.CH_AUTOLEVEL_ENABLE, label: "AL Max Gain", scope: "channel", unit: "db" },
	fxAutoLevelHeadroom: { address: addr.CH_AUTOLEVEL_HEADROOM, press: addr.CH_AUTOLEVEL_ENABLE, label: "AL Headroom", scope: "channel", unit: "db" },
	fxAutoLevelRise: { address: addr.CH_AUTOLEVEL_RISETIME, press: addr.CH_AUTOLEVEL_ENABLE, label: "AL Rise", scope: "channel", unit: "raw" },

	// Reverb unit (page 3).
	fxReverbVolume: { address: addr.REVERB_VOLUME, press: addr.REVERB_ENABLE, label: "Reverb Vol", scope: "global", unit: "db" },
	fxReverbPredelay: { address: addr.REVERB_PREDELAY, press: addr.REVERB_ENABLE, label: "Predelay", scope: "global", unit: "raw" },
	fxReverbWidth: { address: addr.REVERB_WIDTH, press: addr.REVERB_ENABLE, label: "Rev Width", scope: "global", unit: "raw" },
	fxReverbRoomscale: { address: addr.REVERB_ROOMSCALE, press: addr.REVERB_ENABLE, label: "Room Scale", scope: "global", unit: "raw" },
	fxReverbSmooth: { address: addr.REVERB_SMOOTH, press: addr.REVERB_ENABLE, label: "Smooth", scope: "global", unit: "raw" },
	fxReverbLowcut: { address: addr.REVERB_LOWCUT, press: addr.REVERB_ENABLE, label: "Rev LowCut", scope: "global", unit: "freq" },
	fxReverbHighcut: { address: addr.REVERB_HIGHCUT, press: addr.REVERB_ENABLE, label: "Rev HiCut", scope: "global", unit: "freq" },
	// Space reverb type only.
	fxReverbTime: { address: addr.REVERB_TIME, press: addr.REVERB_ENABLE, label: "Rev Time", scope: "global", unit: "raw" },
	fxReverbHighdamp: { address: addr.REVERB_HIGHDAMP, press: addr.REVERB_ENABLE, label: "High Damp", scope: "global", unit: "freq" },
	// Envelope reverb types only.
	fxReverbAttack: { address: addr.REVERB_ATTACK, press: addr.REVERB_ENABLE, label: "Rev Attack", scope: "global", unit: "raw" },
	fxReverbHold: { address: addr.REVERB_HOLD, press: addr.REVERB_ENABLE, label: "Rev Hold", scope: "global", unit: "raw" },
	fxReverbRelease: { address: addr.REVERB_RELEASE, press: addr.REVERB_ENABLE, label: "Rev Release", scope: "global", unit: "raw" },

	// Echo unit (page 3).
	fxEchoVolume: { address: addr.ECHO_VOLUME, press: addr.ECHO_ENABLE, label: "Echo Vol", scope: "global", unit: "db" },
	fxEchoDelay: { address: addr.ECHO_DELAY, press: addr.ECHO_ENABLE, label: "Echo Delay", scope: "global", unit: "raw" },
	fxEchoFeedback: { address: addr.ECHO_FEEDBACK, press: addr.ECHO_ENABLE, label: "Feedback", scope: "global", unit: "raw" },
	fxEchoWidth: { address: addr.ECHO_WIDTH, press: addr.ECHO_ENABLE, label: "Echo Width", scope: "global", unit: "raw" },
} as const;

/** Step unit of an FX target, or null for non-FX targets. */
const unitOf = (target: string): "db" | "freq" | "selection" | "raw" | null =>
	isFx(target) ? FX_TARGETS[target].unit : null;

const isDbScaled = (target: string): boolean => unitOf(target) === "db";

/** Levels into/out of the FX bus; "engaged" is their own value > 0. */
const FX_SEND_TARGETS: ReadonlySet<string> = new Set(["fxReverbSend", "fxReverbReturn"]);

/** Default dB per detent for dB-scaled FX parameters. */
const DEFAULT_FX_STEP_DB = 1;

/** Default Hz per detent for kOSCScaleFreq parameters (converted through the published curve). */
const DEFAULT_HZ_STEP = 20;

/** kOSCScaleFreq span. */
const MIN_HZ = 20;
const MAX_HZ = 20000;

/** Default position count for selection parameters (kOSCScaleLin01 spread evenly; device dependent). */
const DEFAULT_SELECTION_POSITIONS = 4;

/** Wire step for a dB-scaled parameter until its dB mapping is measured. */
const FX_PROBE_STEP = 0.005;

const isFx = (t: string): t is FxTarget => t in FX_TARGETS;

/** Page-2 targets, which need bus/bank/offset selected. */
const isChannelScoped = (target: string): boolean =>
	target === "channel" || target === "pan" || (isFx(target) && FX_TARGETS[target].scope === "channel");

/** Bus restrictions per the RME table; absent = all buses. */
const TARGET_BUSES: Partial<Record<string, readonly ("input" | "playback" | "output")[]>> = {
	fxReverbSend: SOURCES,
	fxReverbReturn: OUTPUTS_ONLY,
};

const busesFor = (target: string): readonly ("input" | "playback" | "output")[] =>
	TARGET_BUSES[target] ?? ALL_BUSES;

/** Stepping law: only mix faders follow the RME fader curve. */
const kindOf = (target: string): "fader" | "gain" | "fx" | "pan" =>
	isFx(target)
		? "fx"
		: target === "gain"
			? "gain"
			: target === "pan" || target === "stripPan"
				? "pan"
				: "fader";

/** Classic OSC continuous control (fader, pan, gain, FX) for keys and dials. Faders step in dB on the RME curve. */
@action({ UUID: "de.shells.totalmixgen2.volume" })
export class Volume extends SingletonAction<VolumeSettings> {
	/** Last key image sent per action, so an unchanged icon is not re-sent. */
	private readonly keyImages = new Map<string, string>();

	private readonly cleanup = new Map<string, Array<() => void>>();

	/** Last bus/bank pin time per action id. */
	private readonly lastPin = new Map<string, number>();

	/** Last audible level per fader address (restore point for -oo); fed by every render. */
	private readonly lastAudible = new Map<string, number>();

	/** Measured value→dB mappings per address; fed by render(). */
	private readonly dbScales = new Map<string, DbScale>();

	/** Most recent (value, dB) reading per address, used to locate 0 dB. */
	private readonly lastDbReading = new Map<string, { value: number; db: number }>();

	/** Selects bus/bank (page 1) or the channel (page 2) before a write, rate-limited unless forced. */
	private pinIfConfigured(
		tm: TotalMixConnection,
		id: string,
		settings: VolumeSettings,
		force = false,
	): void {
		const target = settings.target ?? "main";
		const positional = target === "strip" || target === "gain" || target === "stripPan";
		if (!positional && !isChannelScoped(target)) return;

		const now = Date.now();
		if (!force && now - (this.lastPin.get(id) ?? 0) < PIN_INTERVAL_MS) return;
		this.lastPin.set(id, now);

		if (!positional) {
			focusChannel(tm, settings, busesFor(target));
			return;
		}

		if (target === "gain") {
			// Gain exists on the input bus only.
			tm.toggle(addr.bus("input"));
		} else if (settings.bus === "input" || settings.bus === "playback" || settings.bus === "output") {
			tm.toggle(addr.bus(settings.bus));
		}
		if (settings.bankStart !== undefined && String(settings.bankStart).trim() !== "") {
			tm.send(addr.SET_BANK_START, num(settings.bankStart, 0));
		}
	}

	override async onWillAppear(ev: WillAppearEvent<VolumeSettings>): Promise<void> {
		await seedDefaults(ev.action, ev.payload.settings, "classic", { stepDb: true, fxSteps: true });
		await this.setup(ev.action, ev.payload.settings);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<VolumeSettings>): Promise<void> {
		await this.setup(ev.action, ev.payload.settings);
	}

	/** (Re)binds one button; idempotent, runs on appear and settings change. */
	private async setup(
		target: WillAppearEvent<VolumeSettings>["action"],
		settings: VolumeSettings,
	): Promise<void> {
		const tm = totalMixFor(connectionOptions(settings));

		const address = this.addressFor(settings);
		const display = addr.displayOf(address);

		const render = (): void => {
			void this.render(tm, target, settings);
		};

		const unsubs = [
			tm.subscribe(address, render),
			tm.subscribe(display, render),
			tm.onConnectionChange(render),
		];

		// Track names arrive in their own order; re-render when they land.
		const tgt = settings.target ?? "main";
		if (tgt === "strip" || tgt === "gain" || tgt === "stripPan") {
			unsubs.push(tm.subscribe(addr.trackName(num(settings.strip, 1)), render));
		} else if (isChannelScoped(tgt)) {
			unsubs.push(tm.subscribe(addr.CH_TRACK_NAME, render));
		}

		// Mute/solo flags and the FX enable drive the wash.
		const fxTarget = settings.target ?? "main";
		const flags = [
			this.muteAddressFor(settings),
			this.soloAddressFor(settings),
			isFx(fxTarget) ? FX_TARGETS[fxTarget].press : null,
		].filter((a): a is string => a !== null);
		for (const flag of flags) unsubs.push(tm.subscribe(flag, render));

		streamDeck.logger.info(
			`Volume dial ${target.id} watching ${this.addressFor(settings)}` +
				`${flags.length > 0 ? ` and ${flags.join(", ")}` : ""}` +
				`, view ${JSON.stringify(this.requiredView(settings))}`,
		);

		const startupReq = this.requiredView(settings);
		if (startupReq !== null) tm.requireView(startupReq);

		tm.declarePage(target.id, addr.pageOf(address));
		// The enable may live on another page (FX send: page 2, enable: page 3).
		const fxTgt = settings.target ?? "main";
		if (isFx(fxTgt)) tm.requirePage(addr.pageOf(FX_TARGETS[fxTgt].press));

		this.releaseFor(target.id);
		this.cleanup.set(target.id, unsubs);

		if (target.isDial()) {
			void target.setTriggerDescription({
				rotate: "Adjust level",
				push: GESTURE_LABELS[this.gestureFor(settings, "press")],
				touch: GESTURE_LABELS[this.gestureFor(settings, "touch")],
			});
		}

		render();
	}

	/** Target class for the gesture rules. */
	private kindOfTarget(settings: VolumeSettings): ClassicKind {
		const target = settings.target ?? "main";
		if (isFx(target)) return "fx";
		return target === "pan" || target === "stripPan" ? "pan" : target;
	}

	/** Resolved gesture for a slot. */
	private gestureFor(settings: VolumeSettings, slot: GestureSlot): Gesture {
		return resolveGesture(
			slot === "press" ? settings.press : settings.touch,
			this.kindOfTarget(settings),
			slot,
			CLASSIC,
		);
	}

	override onWillDisappear(ev: WillDisappearEvent<VolumeSettings>): void {
		this.releaseFor(ev.action.id);
		this.lastPin.delete(ev.action.id);
		forgetAlertState(ev.action.id);
		totalMixFor(connectionOptions(ev.payload.settings)).releasePage(ev.action.id);
	}

	override async onSendToPlugin(ev: SendToPluginEvent<{ event?: string }, VolumeSettings>): Promise<void> {
		streamDeck.logger.info(`PI -> plugin: ${JSON.stringify(ev.payload).slice(0, 160)}`);
		if (datasourceEvent(ev.payload) !== "getStrips") return;
		const settings = await ev.action.getSettings();
		const tm = totalMixFor(connectionOptions(settings));
		await replyStripDatasource(tm, "getStrips", settings, (settings.target ?? "main") === "gain");
	}

	/** Steps the value per detent (coalesced write) and repaints optimistically. */
	override onDialRotate(ev: DialRotateEvent<VolumeSettings>): void {
		const settings = ev.payload.settings;
		const tm = totalMixFor(connectionOptions(settings));
		if (alertIfDown(ev.action, tm)) return;
		const req = this.requiredView(settings);
		// Force the pin when the slot shows another view.
		this.pinIfConfigured(tm, ev.action.id, settings, req !== null && !tm.viewMatches(req));

		const target = settings.target ?? "main";
		const address = this.addressFor(settings);
		// Gain and pan use a fixed step.
		const perTick =
			target === "gain" || kindOf(target) === "pan" ? DEFAULT_STEP_DB : num(settings.stepDb, DEFAULT_STEP_DB);
		const fxFraction = this.fxFractionFor(settings);

		// Read from this dial's own view slice; no data yet blocks the gesture.
		if (tm.get(address, req) === undefined) {
			streamDeck.logger.warn(`Ignoring dial move on ${address}: no data for its view yet`);
			tm.requestFullRefresh();
			return;
		}

		const current = tm.getNumber(address, 0, req);
		const next =
			this.stepByUnit(settings, address, current, ev.payload.ticks) ??
			computeNext(
				kindOf(target),
				current,
				ev.payload.ticks,
				perTick,
				fxFraction,
				gainRangeDb(settings.device),
			);

		tm.sendCoalesced(address, next);

		void this.render(tm, ev.action, settings, next);
	}

	override onDialDown(ev: DialDownEvent<VolumeSettings>): void {
		this.gesture(ev, "press");
	}

	override onTouchTap(ev: TouchTapEvent<VolumeSettings>): void {
		this.gesture(ev, "touch");
	}

	/** Runs a dial gesture and repaints when it moved the fader. */
	private gesture(
		ev: DialDownEvent<VolumeSettings> | TouchTapEvent<VolumeSettings>,
		slot: GestureSlot,
	): void {
		const settings = ev.payload.settings;
		const tm = totalMixFor(connectionOptions(settings));
		if (alertIfDown(ev.action, tm)) return;

		const req = this.requiredView(settings);
		this.pinIfConfigured(tm, ev.action.id, settings, req !== null && !tm.viewMatches(req));

		const next = this.perform(tm, settings, this.gestureFor(settings, slot));
		if (next !== undefined) void this.render(tm, ev.action, settings, next);
	}

	/**
	 * Performs a gesture. Returns the value written to this dial's own address,
	 * or undefined. Page-1 strip switches are kOSCScaleOnOff (explicit 0/1);
	 * page-2 ones are kOSCScaleToggle (1.0 flips).
	 */
	private perform(tm: TotalMixConnection, settings: VolumeSettings, gesture: Gesture): number | undefined {
		const target = settings.target ?? "main";
		const strip = num(settings.strip, 1);

		const flipOnOff = (address: string): undefined => {
			tm.sendOffPage(address, asBool(tm.get(address, this.requiredView(settings)) ?? 0) ? 0 : 1);
			return undefined;
		};

		const onPage2 = isChannelScoped(target);
		const flipChannel = (page2: string, page1: (n: number) => string): undefined => {
			if (onPage2) {
				tm.toggle(page2);
				return undefined;
			}
			return flipOnOff(page1(strip));
		};

		switch (gesture) {
			case "none":
				return undefined;

			case "mute":
				if (target === "main") {
					// No main-out mute in the table: fader to -oo and back.
					return this.toggleSilence(tm, settings);
				}
				return flipChannel(addr.CH_MUTE, addr.mute);

			case "solo":
				return flipChannel(addr.CH_SOLO, addr.solo);

			case "cue":
				return flipChannel(addr.CH_CUE, addr.cue);

			case "phantom":
				return flipChannel(addr.CH_PHANTOM, addr.phantom);

			case "infinity":
				return this.toggleSilence(tm, settings);

			case "unity": {
				const unity = dbToFader(0);
				tm.sendOffPage(this.addressFor(settings), unity);
				return unity;
			}

			case "center":
				tm.sendOffPage(this.addressFor(settings), 0.5);
				return 0.5;

			case "bypass":
				if (isFx(target)) tm.toggle(FX_TARGETS[target].press);
				return undefined;

			case "neutral": {
				const value = this.neutralFor(settings);
				if (value === undefined) return undefined;
				tm.sendOffPage(this.addressFor(settings), value);
				return value;
			}

			case "dim":
				tm.toggle(addr.MAIN_DIM);
				return undefined;
			case "mono":
				tm.toggle(addr.MAIN_MONO);
				return undefined;
			case "talkback":
				tm.toggle(addr.MAIN_TALKBACK);
				return undefined;
			case "speakerB":
				tm.toggle(addr.MAIN_SPEAKER_B);
				return undefined;
			case "extIn":
				tm.toggle(addr.MAIN_EXT_IN);
				return undefined;
			case "muteFx":
				tm.toggle(addr.MAIN_MUTE_FX);
				return undefined;
			case "recall":
				tm.toggle(addr.MAIN_RECALL);
				return undefined;
			case "globalMute":
				tm.toggle(addr.GLOBAL_MUTE);
				return undefined;
			case "globalSolo":
				tm.toggle(addr.GLOBAL_SOLO);
				return undefined;

			case "auto":
				return undefined;
		}
	}

	/**
	 * Neutral value for an FX parameter: 0 dB (from the measured mapping, else
	 * 0.5) for dB units, position 0 for selections, 0.5 otherwise. The table
	 * publishes no factory defaults.
	 */
	private neutralFor(settings: VolumeSettings): number | undefined {
		const target = settings.target ?? "main";
		if (!isFx(target)) return undefined;

		switch (FX_TARGETS[target].unit) {
			case "db": {
				const scale = this.dbScales.get(this.addressFor(settings));
				const slope = scale?.slope;
				if (slope === undefined) return 0.5;
				const known = this.lastDbReading.get(this.addressFor(settings));
				if (known === undefined) return 0.5;
				const unity = known.value - known.db / slope;
				return unity < 0 ? 0 : unity > 1 ? 1 : unity;
			}
			case "selection":
				return 0;
			default:
				return 0.5;
		}
	}

	/** Fader to -oo, or back to the last audible level. Returns the value written, or undefined. */
	private toggleSilence(tm: TotalMixConnection, settings: VolumeSettings): number | undefined {
		const address = this.addressFor(settings);
		const current = tm.getNumber(address, 0, this.requiredView(settings));

		if (!isMinusInfinity(current)) {
			this.lastAudible.set(address, current);
			tm.sendOffPage(address, 0);
			return 0;
		}

		const restore = this.lastAudible.get(address);
		if (restore === undefined || isMinusInfinity(restore)) {
			streamDeck.logger.info(`No stored level for ${address}; leaving it at -oo.`);
			return undefined;
		}

		tm.sendOffPage(address, restore);
		return restore;
	}

	/** Key placement: one step per press in the configured direction. */
	override onKeyDown(ev: KeyDownEvent<VolumeSettings>): void {
		const settings = ev.payload.settings;
		const tm = totalMixFor(connectionOptions(settings));
		if (alertIfDown(ev.action, tm)) return;

		const reqView = this.requiredView(settings);
		this.pinIfConfigured(tm, ev.action.id, settings, reqView !== null && !tm.viewMatches(reqView));

		const target = settings.target ?? "main";
		const address = this.addressFor(settings);
		const ticks = (settings.nudge ?? "up") === "down" ? -1 : 1;
		const dbStep = num(settings.stepDb, DEFAULT_STEP_DB);

		if (tm.get(address, reqView) === undefined) {
			streamDeck.logger.warn(`Ignoring nudge on ${address}: no data for its view yet`);
			tm.requestFullRefresh();
			return;
		}

		const current = tm.getNumber(address, 0, reqView);
		const next =
			this.stepByUnit(settings, address, current, ticks) ??
			computeNext(
				kindOf(target),
				current,
				ticks,
				dbStep,
				kindOf(target) === "pan" ? PAN_STEP : this.fxFractionFor(settings),
				gainRangeDb(settings.device),
			);

		streamDeck.logger.info(`Key press: nudge ${address} ${ticks > 0 ? "+" : "-"}${dbStep}`);
		tm.sendOffPage(address, next);
		void this.render(tm, ev.action, settings, next);
	}

	/** Wire fraction per detent for unitless FX parameters; dB-scaled ones use the probe step until measured. */
	private fxFractionFor(settings: VolumeSettings): number {
		if (isDbScaled(settings.target ?? "main")) return FX_PROBE_STEP;

		const percent = num(settings.fxPercent, FX_STEP * 100);
		return percent > 0 && percent <= 100 ? percent / 100 : FX_STEP;
	}

	/** Next value for a unit-stepped FX parameter (dB, Hz, selection), or undefined to step by wire fraction. */
	private stepByUnit(
		settings: VolumeSettings,
		address: string,
		current: number,
		ticks: number,
	): number | undefined {
		switch (unitOf(settings.target ?? "main")) {
			case "db":
				return this.stepInDb(settings, address, current, ticks);

			case "freq": {
				const per = num(settings.fxHz, DEFAULT_HZ_STEP);
				const hz = valueToFreq(current) + ticks * (per > 0 ? per : DEFAULT_HZ_STEP);
				return freqToValue(Math.min(Math.max(hz, MIN_HZ), MAX_HZ));
			}

			case "selection": {
				// Snapped to the position grid.
				const positions = Math.max(2, Math.round(num(settings.fxPositions, DEFAULT_SELECTION_POSITIONS)));
				const last = positions - 1;
				const index = Math.round(current * last) + ticks;
				return Math.min(Math.max(index, 0), last) / last;
			}

			default:
				return undefined;
		}
	}

	/** dB at `value` from the measured slope and the last reported reading, or undefined while unmeasured. */
	private predictDb(address: string, value: number): number | undefined {
		const slope = this.dbScales.get(address)?.slope;
		const known = this.lastDbReading.get(address);
		if (slope === undefined || known === undefined) return undefined;
		return known.db + slope * (value - known.value);
	}

	/** Next wire value for a dB-scaled FX parameter, or undefined while its mapping is unmeasured. */
	private stepInDb(
		settings: VolumeSettings,
		address: string,
		current: number,
		ticks: number,
	): number | undefined {
		if (!isDbScaled(settings.target ?? "main")) return undefined;
		const scale = this.dbScales.get(address);
		if (scale === undefined) return undefined;

		const perTick = num(settings.fxStepDb, DEFAULT_FX_STEP_DB);
		const step = perTick > 0 ? perTick : DEFAULT_FX_STEP_DB;
		return scale.step(current, ticks * step);
	}

	/** Address for the target; unknown targets fall back to mastervolume. */
	private addressFor(settings: VolumeSettings): string {
		const target = settings.target ?? "main";
		switch (target) {
			case "main":
				return addr.MAIN_VOLUME;
			case "channel":
				return addr.CH_VOLUME;
			case "strip":
				return addr.volume(num(settings.strip, 1));
			case "gain":
				return addr.micGain(num(settings.strip, 1));
			case "pan":
				return addr.CH_PAN;
			case "stripPan":
				return addr.pan(num(settings.strip, 1));
			default:
				return isFx(target) ? FX_TARGETS[target].address : addr.MAIN_VOLUME;
		}
	}

	/** View the settings require, or null (follow the slot). Gain is always input bus. */
	private requiredView(settings: VolumeSettings): ViewRequirement | null {
		const tgt = settings.target ?? "main";
		const bank =
			settings.bankStart !== undefined && String(settings.bankStart).trim() !== ""
				? num(settings.bankStart, 0)
				: undefined;

		if (tgt === "gain") {
			return bank !== undefined ? { bus: "input", bank } : { bus: "input" };
		}
		if (tgt === "strip" || tgt === "stripPan") {
			const bus =
				settings.bus === "input" || settings.bus === "playback" || settings.bus === "output"
					? settings.bus
					: undefined;
			if (bus === undefined && bank === undefined) return null;
			return { ...(bus !== undefined ? { bus } : {}), ...(bank !== undefined ? { bank } : {}) };
		}
		if (isChannelScoped(tgt)) return channelView(settings, busesFor(tgt));
		return null;
	}

	/** Paints from cache. Prefers the "...Val" string; `override` is a just-written value. */
	private async render(
		tm: TotalMixConnection,
		target: WillAppearEvent<VolumeSettings>["action"] | DialAction<VolumeSettings>,
		settings: VolumeSettings,
		override?: number,
	): Promise<void> {
		const address = this.addressFor(settings);
		const tgt = settings.target ?? "main";
		const isGain = tgt === "gain";

		const req = this.requiredView(settings);
		if (override === undefined && tm.get(address, req) === undefined) {
			if (target.isDial()) {
				// Type-specific reverb parameters never report under other types; the enable is still shown.
				await target.setFeedback(
					washFeedback(this.labelFor(tm, settings), "—", 0, this.washFor(tm, settings, 0)),
				);
			} else {
				await target.setTitle("—");
			}
			return;
		}

		const value = override ?? tm.getNumber(address, 0, req);

		if (kindOf(tgt) === "fader" && !isMinusInfinity(value)) this.lastAudible.set(address, value);

		// The value and its "...Val" string arrive as separate messages, and
		// TotalMix does not always re-send the string when the value changes.
		// A string that arrived before the value it labels is discarded, so the
		// readout falls back to one computed from the value itself.
		const displayAddress = addr.displayOf(address);
		const current = tm.sequenceOf(displayAddress, req) >= tm.sequenceOf(address, req);
		const reported = current ? tm.getString(displayAddress, req) : undefined;

		// An override is a value written but not yet reported, so any cached
		// string still describes the level before the gesture.
		const raw = override === undefined ? reported : undefined;

		// Feed the dB mapping from reported readings only, never from overrides.
		if (isDbScaled(tgt) && override === undefined && raw !== undefined) {
			const db = parseDb(raw);
			if (db !== undefined) {
				let scale = this.dbScales.get(address);
				if (scale === undefined) {
					scale = new DbScale();
					this.dbScales.set(address, scale);
				}
				scale.observe(value, db);
				this.lastDbReading.set(address, { value, db });
			}
		}
		// Page-1 pans have no Val string; page-2 pan does.
		const isPan = kindOf(tgt) === "pan";
		// dB-scaled targets have no fixed wire-to-dB curve, so without a string
		// the readout comes from the mapping measured off earlier readings.
		const predicted = raw === undefined && isDbScaled(tgt) ? this.predictDb(address, value) : undefined;
		const label =
			raw !== undefined
				? isGain
					? formatGain(raw)
					: raw
				: predicted !== undefined
					? `${isGain ? Math.round(predicted) : predicted.toFixed(1)} dB`
					: isPan
						? formatPan(value)
						: isGain || isFx(tgt)
							? `${Math.round(value * 100)} %`
							: formatDb(value);
		const name = this.labelFor(tm, settings);

		if (target.isDial()) {
			await target.setFeedback(
				washFeedback(
					name,
					tm.connected ? label : "—",
					faderToBar(value),
					tm.connected ? this.washFor(tm, settings, value) : "none",
				),
			);
			return;
		}

		this.applyNudgeIcon(target, settings.nudge);
		await target.setTitle(tm.connected ? label : "—");
	}

	/**
	 * Key image showing which way a press moves the value.
	 *
	 * Sent once per change: renders run on every inbound OSC message, and the
	 * guidelines cap programmatic calls at ten a second.
	 */
	private applyNudgeIcon(
		target: { id: string; isKey: () => boolean; setImage: (path?: string) => Promise<void> },
		nudge?: "up" | "down",
	): void {
		if (!target.isKey()) return;
		const icon = nudgeIcon(nudge);
		if (this.keyImages.get(target.id) === icon) return;
		this.keyImages.set(target.id, icon);
		void target.setImage(icon);
	}


	/** Header: cached channel name from this action's own view, else a positional label. */
	private labelFor(tm: TotalMixConnection, settings: VolumeSettings): string {
		const req = this.requiredView(settings);
		const target = settings.target ?? "main";
		switch (target) {
			case "main":
				return "Main";
			case "channel":
				return tm.getString(addr.CH_TRACK_NAME, req) ?? "Channel";
			case "pan":
				return tm.getString(addr.CH_TRACK_NAME, req) ?? "Pan";
			case "strip":
			case "stripPan":
				return (
					tm.getString(addr.trackName(num(settings.strip, 1)), req) ??
					`Strip ${num(settings.strip, 1)}`
				);
			case "gain":
				return (
					tm.getString(addr.trackName(num(settings.strip, 1)), req) ??
					`Gain ${num(settings.strip, 1)}`
				);
			default: {
				if (!isFx(target)) return "Main";
				const fx = FX_TARGETS[target];
				if (fx.scope !== "channel") return fx.label;
				const name = tm.getString(addr.CH_TRACK_NAME, req);
				return name === undefined ? fx.label : `${name} · ${fx.label}`;
			}
		}
	}

	/** Wash: solo > mute (flag or fader at -oo; not for gain/pan) > none; FX: section enabled. */
	private washFor(tm: TotalMixConnection, settings: VolumeSettings, value: number): Wash {
		const target = settings.target ?? "main";
		if (isFx(target)) {
			const engaged = FX_SEND_TARGETS.has(target) ? value > 0 : this.fxEnabled(tm, settings);
			return engaged ? "fxOn" : "none";
		}

		const view = this.requiredView(settings);
		const isOn = (address: string | null): boolean =>
			address !== null && asBool(tm.get(address, view) ?? 0);

		if (isOn(this.soloAddressFor(settings))) return "solo";
		if (isOn(this.muteAddressFor(settings))) return "mute";

		const silencedByFader = target !== "gain" && kindOf(target) !== "pan" && isMinusInfinity(value);
		return silencedByFader ? "mute" : "none";
	}

	/** Whether the target's section enable is on; page-2 enables are read through the channel slice. */
	private fxEnabled(tm: TotalMixConnection, settings: VolumeSettings): boolean {
		const target = settings.target ?? "main";
		if (!isFx(target)) return false;
		const enable = FX_TARGETS[target].press;
		const req = addr.pageOf(enable) === 2 ? this.requiredView(settings) : null;
		return asBool(tm.get(enable, req) ?? 0);
	}

	/** Solo flag for the target, or null (outputs, main, FX). Solo/PFL is inputs and playbacks only per the table. */
	private soloAddressFor(settings: VolumeSettings): string | null {
		if (this.busOf(settings) === "output") return null;

		switch (settings.target ?? "main") {
			case "channel":
			case "pan":
				return addr.CH_SOLO;
			case "strip":
			case "gain":
			case "stripPan":
				return addr.solo(num(settings.strip, 1));
			default:
				return null;
		}
	}

	/** Bus the button acts on, or undefined when following the slot. */
	private busOf(settings: VolumeSettings): "input" | "playback" | "output" | undefined {
		const target = settings.target ?? "main";
		if (target === "gain") return "input";
		if (isChannelScoped(target)) return channelView(settings, busesFor(target))?.bus;
		return settings.bus === "input" || settings.bus === "playback" || settings.bus === "output"
			? settings.bus
			: undefined;
	}

	/** Mute flag for the target, or null (main, FX). */
	private muteAddressFor(settings: VolumeSettings): string | null {
		switch (settings.target ?? "main") {
			case "channel":
				return addr.CH_MUTE;
			case "pan":
				return addr.CH_MUTE;
			case "strip":
			case "gain":
			case "stripPan":
				return addr.mute(num(settings.strip, 1));
			default:
				return null;
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

export { computeNext, formatGain };
