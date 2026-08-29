import { MAX_DB, MIN_DB } from "../osc/curves.js";
import * as g from "./addresses.js";
import { detectedRefLevels } from "../totalmix/devices.js";

/**
 * Global OSC effect, EQ, dynamics and Auto Level parameters and their step
 * units. Values are transmitted in their own unit (the table gives none
 * explicitly): "db", "hz", "index" (list position) or "native".
 */
export type FxUnit = "db" | "hz" | "index" | "native";

/** Where a parameter lives: on one channel, or on a unit shared by the device. */
export type FxScope = "channel" | "reverb" | "echo";

/** Buses a channel-scoped parameter exists on; absent = all three. */
export type FxBuses = readonly g.GlobalBus[];

export interface FxParameter {
	/** Address tail after the channel, or after /reverb or /echo. */
	readonly param: string;
	readonly scope: FxScope;
	readonly unit: FxUnit;
	/** Shown above the value on a dial. */
	readonly label: string;
	/** Section whose enable lights the dial (channel-scoped parameters). */
	readonly section?: "eq" | "lowcut" | "dynamics" | "autolevel" | "fx" | "roomeq";
	/** Buses the parameter exists on; omitted = all three. */
	readonly buses?: FxBuses;
	/** True for parameters the table marks L/R: the right half of a pair is addressed at channel + 1. */
	readonly lr?: boolean;
	/** Default step per detent, in the parameter's unit. */
	readonly step: number;
	/**
	 * Value a "park at neutral" gesture writes, in the parameter's unit.
	 * Omitted where none is defined: the table publishes no factory settings,
	 * so this is filled in only for Room EQ, whose panel opens on fixed values.
	 */
	readonly neutral?: number;
	/** Inclusive bounds in the parameter's unit; omitted where the range is unknown. */
	readonly min?: number;
	readonly max?: number;
	/**
	 * List-box entries for an index parameter, in protocol order from 0.
	 *
	 * Global OSC transmits the position only, unlike the classic protocol which
	 * sends the name beside it, so the names live here. The table calls index
	 * contents device dependent, hence positions outside this list still render
	 * as their number.
	 */
	readonly positions?: readonly string[];
}

/** TotalMix band 1 and 3 filter types, in list order. */
const EQ_BAND_TYPES = ["Bell", "Shelving", "High Pass", "Low Pass"] as const;

/** Room EQ band 1, 8 and 9 filter types, in list order (classic table: Bell, Shelf, High Pass, Low Pass). */
const ROOM_EQ_BAND_TYPES = ["Bell", "Shelving", "High Pass", "Low Pass"] as const;

const OUTPUTS: FxBuses = ["output"];
const ANALOG: FxBuses = ["input", "output"];
const SOURCES: FxBuses = ["input", "playback"];

/** Low cut slopes in list order. */
const LOWCUT_SLOPES = ["6 dB/oct", "12 dB/oct", "18 dB/oct", "24 dB/oct"] as const;

/** Crossfeed list: off, then strengths 1–5. */
const CROSSFEED = ["Off", "1", "2", "3", "4", "5"] as const;

/** Reverb algorithms in TotalMix's list order. */
const REVERB_TYPES = [
	"Small Room", "Medium Room", "Large Room", "Walls", "Shorty", "Attack", "Swagger",
	"Old School", "Echoistic", "8plus9", "Grand Wide", "Thicker", "Envelope", "Gated", "Space",
] as const;

/** Echo algorithms in TotalMix's list order. */
const ECHO_TYPES = ["Stereo Echo", "Stereo Cross", "Pong Echo"] as const;


/** Frequency bounds; other units are clamped by TotalMix. */
export const MIN_HZ = 20;
export const MAX_HZ = 20000;

export const GLOBAL_FX: Readonly<Record<string, FxParameter>> = {
	// Per channel: FX send and return.
	// Send and return are faders, so they span the same dB range as every other
	// fader in the mixer. The protocol table states no range; MIN_DB/MAX_DB come
	// from the published fader curve the classic protocol uses.
	fxSend: { param: "fxsend", scope: "channel", unit: "db", label: "FX Send", section: "fx", step: 1, min: MIN_DB, max: MAX_DB },
	fxReturn: { param: "fxreturn", scope: "channel", unit: "db", label: "FX Return", section: "fx", step: 1, min: MIN_DB, max: MAX_DB },

	// Per channel: parametric EQ (types on bands 1 and 3 only).
	eqBand1Type: { param: "eq/band1type", scope: "channel", unit: "index", label: "EQ1 Type", section: "eq", step: 1, positions: EQ_BAND_TYPES },
	eqBand1Gain: { param: "eq/band1gain", scope: "channel", unit: "db", label: "EQ1 Gain", section: "eq", step: 1 },
	eqBand1Freq: { param: "eq/band1freq", scope: "channel", unit: "hz", label: "EQ1 Freq", section: "eq", step: 20 },
	eqBand1Q: { param: "eq/band1q", scope: "channel", unit: "native", label: "EQ1 Q", section: "eq", step: 0.1 },
	eqBand2Gain: { param: "eq/band2gain", scope: "channel", unit: "db", label: "EQ2 Gain", section: "eq", step: 1 },
	eqBand2Freq: { param: "eq/band2freq", scope: "channel", unit: "hz", label: "EQ2 Freq", section: "eq", step: 20 },
	eqBand2Q: { param: "eq/band2q", scope: "channel", unit: "native", label: "EQ2 Q", section: "eq", step: 0.1 },
	eqBand3Type: { param: "eq/band3type", scope: "channel", unit: "index", label: "EQ3 Type", section: "eq", step: 1, positions: EQ_BAND_TYPES },
	eqBand3Gain: { param: "eq/band3gain", scope: "channel", unit: "db", label: "EQ3 Gain", section: "eq", step: 1 },
	eqBand3Freq: { param: "eq/band3freq", scope: "channel", unit: "hz", label: "EQ3 Freq", section: "eq", step: 20 },
	eqBand3Q: { param: "eq/band3q", scope: "channel", unit: "native", label: "EQ3 Q", section: "eq", step: 0.1 },

	// Per channel: low cut.
	lowcutFreq: { param: "lowcut/freq", scope: "channel", unit: "hz", label: "Low Cut", section: "lowcut", step: 20 },
	lowcutSlope: { param: "lowcut/slope", scope: "channel", unit: "index", label: "LC Slope", section: "lowcut", step: 1, positions: LOWCUT_SLOPES },

	// Per channel: dynamics (shared enable and make-up gain).
	dynGain: { param: "dynamics/gain", scope: "channel", unit: "db", label: "Makeup Gain", section: "dynamics", step: 1 },
	dynAttack: { param: "dynamics/attack", scope: "channel", unit: "native", label: "Attack", section: "dynamics", step: 1 },
	dynRelease: { param: "dynamics/release", scope: "channel", unit: "native", label: "Release", section: "dynamics", step: 10 },
	dynCompThreshold: { param: "dynamics/compthres", scope: "channel", unit: "db", label: "Comp Thresh", section: "dynamics", step: 1 },
	dynCompRatio: { param: "dynamics/compratio", scope: "channel", unit: "native", label: "Comp Ratio", section: "dynamics", step: 0.1 },
	dynExpThreshold: { param: "dynamics/expthres", scope: "channel", unit: "db", label: "Exp Thresh", section: "dynamics", step: 1 },
	dynExpRatio: { param: "dynamics/expratio", scope: "channel", unit: "native", label: "Exp Ratio", section: "dynamics", step: 0.1 },

	// Per channel: Auto Level.
	autoMaxGain: { param: "autolevel/maxgain", scope: "channel", unit: "db", label: "AL Max Gain", section: "autolevel", step: 1 },
	autoHeadroom: { param: "autolevel/headroom", scope: "channel", unit: "db", label: "AL Headroom", section: "autolevel", step: 1 },
	autoRiseTime: { param: "autolevel/risetime", scope: "channel", unit: "native", label: "AL Rise", section: "autolevel", step: 0.1 },

	// Per channel; delay is L/R-split (right = channel + 1).
	// Stereo width is a source-channel setting; delay sits on the hardware outputs.
	width: { param: "width", scope: "channel", unit: "native", label: "Width", step: 0.05, buses: SOURCES },
	// Headphone crossfeed sits on the hardware outputs only.
	crossfeed: { param: "crossfeed", scope: "channel", unit: "index", label: "Crossfeed", step: 1, positions: CROSSFEED, buses: OUTPUTS },
	delay: { param: "delay", scope: "channel", unit: "native", label: "Delay", step: 1, lr: true, buses: OUTPUTS },
	// Analog stages only: line inputs and outputs. Positions come from the
	// detected device (devices.ts refLevels), per bus.
	refLevel: { param: "reflevel", scope: "channel", unit: "index", label: "Ref Level", step: 1, buses: ANALOG },

	// Room EQ (outputs only, L/R-split). "gain" on an output carrying Room EQ is
	// its volume correction per the table; the delay is the channel delay above.
	roomEqVolumeCorr: { param: "gain", scope: "channel", unit: "db", label: "REQ Vol Corr", section: "roomeq", step: 1, neutral: 0, buses: OUTPUTS, lr: true },
	roomEqDelay: { param: "delay", scope: "channel", unit: "native", label: "REQ Delay", section: "roomeq", step: 1, neutral: 0, buses: OUTPUTS, lr: true },
	// Bands 1-9; filter type is selectable on bands 1, 8 and 9 only.
	roomEqBand1Type: { param: "roomeq/band1type", scope: "channel", unit: "index", label: "REQ1 Type", section: "roomeq", step: 1, neutral: 0, positions: ROOM_EQ_BAND_TYPES, buses: OUTPUTS, lr: true },
	roomEqBand1Gain: { param: "roomeq/band1gain", scope: "channel", unit: "db", label: "REQ1 Gain", section: "roomeq", step: 1, neutral: 0, buses: OUTPUTS, lr: true },
	roomEqBand1Freq: { param: "roomeq/band1freq", scope: "channel", unit: "hz", label: "REQ1 Freq", section: "roomeq", step: 20, neutral: 50, buses: OUTPUTS, lr: true },
	roomEqBand1Q: { param: "roomeq/band1q", scope: "channel", unit: "native", label: "REQ1 Q", section: "roomeq", step: 0.1, neutral: 5, buses: OUTPUTS, lr: true },
	roomEqBand2Gain: { param: "roomeq/band2gain", scope: "channel", unit: "db", label: "REQ2 Gain", section: "roomeq", step: 1, neutral: 0, buses: OUTPUTS, lr: true },
	roomEqBand2Freq: { param: "roomeq/band2freq", scope: "channel", unit: "hz", label: "REQ2 Freq", section: "roomeq", step: 20, neutral: 100, buses: OUTPUTS, lr: true },
	roomEqBand2Q: { param: "roomeq/band2q", scope: "channel", unit: "native", label: "REQ2 Q", section: "roomeq", step: 0.1, neutral: 5, buses: OUTPUTS, lr: true },
	roomEqBand3Gain: { param: "roomeq/band3gain", scope: "channel", unit: "db", label: "REQ3 Gain", section: "roomeq", step: 1, neutral: 0, buses: OUTPUTS, lr: true },
	roomEqBand3Freq: { param: "roomeq/band3freq", scope: "channel", unit: "hz", label: "REQ3 Freq", section: "roomeq", step: 20, neutral: 150, buses: OUTPUTS, lr: true },
	roomEqBand3Q: { param: "roomeq/band3q", scope: "channel", unit: "native", label: "REQ3 Q", section: "roomeq", step: 0.1, neutral: 5, buses: OUTPUTS, lr: true },
	roomEqBand4Gain: { param: "roomeq/band4gain", scope: "channel", unit: "db", label: "REQ4 Gain", section: "roomeq", step: 1, neutral: 0, buses: OUTPUTS, lr: true },
	roomEqBand4Freq: { param: "roomeq/band4freq", scope: "channel", unit: "hz", label: "REQ4 Freq", section: "roomeq", step: 20, neutral: 200, buses: OUTPUTS, lr: true },
	roomEqBand4Q: { param: "roomeq/band4q", scope: "channel", unit: "native", label: "REQ4 Q", section: "roomeq", step: 0.1, neutral: 5, buses: OUTPUTS, lr: true },
	roomEqBand5Gain: { param: "roomeq/band5gain", scope: "channel", unit: "db", label: "REQ5 Gain", section: "roomeq", step: 1, neutral: 0, buses: OUTPUTS, lr: true },
	roomEqBand5Freq: { param: "roomeq/band5freq", scope: "channel", unit: "hz", label: "REQ5 Freq", section: "roomeq", step: 20, neutral: 250, buses: OUTPUTS, lr: true },
	roomEqBand5Q: { param: "roomeq/band5q", scope: "channel", unit: "native", label: "REQ5 Q", section: "roomeq", step: 0.1, neutral: 5, buses: OUTPUTS, lr: true },
	roomEqBand6Gain: { param: "roomeq/band6gain", scope: "channel", unit: "db", label: "REQ6 Gain", section: "roomeq", step: 1, neutral: 0, buses: OUTPUTS, lr: true },
	roomEqBand6Freq: { param: "roomeq/band6freq", scope: "channel", unit: "hz", label: "REQ6 Freq", section: "roomeq", step: 20, neutral: 300, buses: OUTPUTS, lr: true },
	roomEqBand6Q: { param: "roomeq/band6q", scope: "channel", unit: "native", label: "REQ6 Q", section: "roomeq", step: 0.1, neutral: 5, buses: OUTPUTS, lr: true },
	roomEqBand7Gain: { param: "roomeq/band7gain", scope: "channel", unit: "db", label: "REQ7 Gain", section: "roomeq", step: 1, neutral: 0, buses: OUTPUTS, lr: true },
	roomEqBand7Freq: { param: "roomeq/band7freq", scope: "channel", unit: "hz", label: "REQ7 Freq", section: "roomeq", step: 20, neutral: 400, buses: OUTPUTS, lr: true },
	roomEqBand7Q: { param: "roomeq/band7q", scope: "channel", unit: "native", label: "REQ7 Q", section: "roomeq", step: 0.1, neutral: 5, buses: OUTPUTS, lr: true },
	roomEqBand8Type: { param: "roomeq/band8type", scope: "channel", unit: "index", label: "REQ8 Type", section: "roomeq", step: 1, neutral: 0, positions: ROOM_EQ_BAND_TYPES, buses: OUTPUTS, lr: true },
	roomEqBand8Gain: { param: "roomeq/band8gain", scope: "channel", unit: "db", label: "REQ8 Gain", section: "roomeq", step: 1, neutral: 0, buses: OUTPUTS, lr: true },
	roomEqBand8Freq: { param: "roomeq/band8freq", scope: "channel", unit: "hz", label: "REQ8 Freq", section: "roomeq", step: 20, neutral: 600, buses: OUTPUTS, lr: true },
	roomEqBand8Q: { param: "roomeq/band8q", scope: "channel", unit: "native", label: "REQ8 Q", section: "roomeq", step: 0.1, neutral: 5, buses: OUTPUTS, lr: true },
	roomEqBand9Type: { param: "roomeq/band9type", scope: "channel", unit: "index", label: "REQ9 Type", section: "roomeq", step: 1, neutral: 0, positions: ROOM_EQ_BAND_TYPES, buses: OUTPUTS, lr: true },
	roomEqBand9Gain: { param: "roomeq/band9gain", scope: "channel", unit: "db", label: "REQ9 Gain", section: "roomeq", step: 1, neutral: 0, buses: OUTPUTS, lr: true },
	roomEqBand9Freq: { param: "roomeq/band9freq", scope: "channel", unit: "hz", label: "REQ9 Freq", section: "roomeq", step: 20, neutral: 800, buses: OUTPUTS, lr: true },
	roomEqBand9Q: { param: "roomeq/band9q", scope: "channel", unit: "native", label: "REQ9 Q", section: "roomeq", step: 0.1, neutral: 5, buses: OUTPUTS, lr: true },

	// The reverb unit.
	reverbType: { param: "type", scope: "reverb", unit: "index", label: "Rev Type", step: 1, positions: REVERB_TYPES },
	reverbVolume: { param: "volume", scope: "reverb", unit: "db", label: "Reverb Vol", step: 1 },
	reverbPredelay: { param: "predelay", scope: "reverb", unit: "native", label: "Predelay", step: 1 },
	reverbLowcut: { param: "lowcut", scope: "reverb", unit: "hz", label: "Rev LowCut", step: 20 },
	reverbHighcut: { param: "highcut", scope: "reverb", unit: "hz", label: "Rev HiCut", step: 20 },
	reverbRoomscale: { param: "roomscale", scope: "reverb", unit: "native", label: "Room Scale", step: 0.05 },
	reverbSmooth: { param: "smooth", scope: "reverb", unit: "native", label: "Smooth", step: 1 },
	reverbWidth: { param: "width", scope: "reverb", unit: "native", label: "Rev Width", step: 0.05 },
	// Space reverb type only.
	reverbTime: { param: "time", scope: "reverb", unit: "native", label: "Rev Time", step: 0.1 },
	reverbHighdamp: { param: "highdamp", scope: "reverb", unit: "hz", label: "High Damp", step: 20 },
	// Envelope reverb types only.
	reverbAttack: { param: "attack", scope: "reverb", unit: "native", label: "Rev Attack", step: 1 },
	reverbHold: { param: "hold", scope: "reverb", unit: "native", label: "Rev Hold", step: 1 },
	reverbRelease: { param: "release", scope: "reverb", unit: "native", label: "Rev Release", step: 1 },

	// The echo unit.
	echoType: { param: "type", scope: "echo", unit: "index", label: "Echo Type", step: 1, positions: ECHO_TYPES },
	echoVolume: { param: "volume", scope: "echo", unit: "db", label: "Echo Vol", step: 1 },
	echoDelay: { param: "delay", scope: "echo", unit: "native", label: "Echo Delay", step: 1 },
	echoFeedback: { param: "feedback", scope: "echo", unit: "native", label: "Feedback", step: 1 },
	echoHighcut: { param: "highcut", scope: "echo", unit: "hz", label: "Echo HiCut", step: 20 },
	echoWidth: { param: "width", scope: "echo", unit: "native", label: "Echo Width", step: 0.05 },
} as const;

export type FxKey = keyof typeof GLOBAL_FX;

export const isFxKey = (key: string): key is FxKey => key in GLOBAL_FX;

/** Parameters marked L/R in the table: the right half of a stereo pair is addressed at channel + 1. */
export const isLrSplit = (key: FxKey): boolean => GLOBAL_FX[key]!.lr === true;

/**
 * Value the neutral gestures write, or undefined when the parameter has none.
 * Room EQ carries the panel's own opening values; other dB and selection
 * parameters resolve to 0 dB and the first position.
 */
export function fxNeutral(key: FxKey): number | undefined {
	const p = GLOBAL_FX[key]!;
	if (p.neutral !== undefined) return p.neutral;
	return p.unit === "db" || p.unit === "index" ? 0 : undefined;
}

/** Buses a parameter exists on; unit parameters and unrestricted channel parameters return all three. */
export const fxBuses = (key: FxKey): FxBuses => GLOBAL_FX[key]!.buses ?? ["input", "playback", "output"];

/** The address a parameter is written to and read from. */
export function fxAddress(key: FxKey, bus: g.GlobalBus, ch: number): string {
	const p = GLOBAL_FX[key]!;
	switch (p.scope) {
		case "reverb":
			return g.reverb(p.param);
		case "echo":
			return g.echo(p.param);
		default:
			return g.channel(bus, ch, p.param);
	}
}

/** Enable address for the parameter's section, or undefined when it has none. */
export function fxEnableAddress(key: FxKey, bus: g.GlobalBus, ch: number): string | undefined {
	const p = GLOBAL_FX[key]!;
	if (p.scope === "reverb") return g.REVERB_ENABLE;
	if (p.scope === "echo") return g.ECHO_ENABLE;

	switch (p.section) {
		case "eq":
			return g.channelEqEnable(bus, ch);
		case "lowcut":
			return g.channelLowcutEnable(bus, ch);
		case "dynamics":
			return g.channelDynamicsEnable(bus, ch);
		case "autolevel":
			return g.channelAutolevelEnable(bus, ch);
		case "roomeq":
			return g.channelRoomEqEnable(bus, ch);
		// The send and return feed the effect bus, so both units drive them; the
		// caller decides, since either being on makes them audible.
		case "fx":
			return g.REVERB_ENABLE;
		default:
			return undefined;
	}
}

/**
 * Next value in the parameter's unit. Index: whole numbers >= 0; hz: clamped to
 * the audio band; anything carrying min/max is clamped to it, and the rest is
 * left to TotalMix.
 *
 * Clamping matters because the value written is also the value shown until
 * TotalMix reports back, and a parameter already at its limit reports nothing
 * new. Without a bound the readout runs past the limit and stays there.
 */
export function fxStep(key: FxKey, current: number, ticks: number, step: number, bus?: g.GlobalBus): number {
	const p = GLOBAL_FX[key]!;
	const moved = current + ticks * step;

	switch (p.unit) {
		case "index": {
			const top = maxPosition(key, bus);
			const moved = Math.max(0, Math.round(current) + ticks);
			return top === undefined ? moved : Math.min(moved, top);
		}
		case "hz":
			return Math.min(Math.max(moved, MIN_HZ), MAX_HZ);
		default:
			return clampTo(p, moved);
	}
}

/** Applies a parameter's own bounds, when it declares them. */
function clampTo(p: FxParameter, value: number): number {
	const low = p.min !== undefined ? Math.max(value, p.min) : value;
	return p.max !== undefined ? Math.min(low, p.max) : low;
}

/**
 * True when a reported dB value means "off" rather than a level.
 *
 * The protocol sends under-range levels down to -300 dB to signal off; only
 * values at or below the fader minimum qualify.
 */
export const isOffDb = (key: FxKey, value: number): boolean =>
	GLOBAL_FX[key]!.unit === "db" && value <= MIN_DB;

/** Property-inspector setting holding a parameter's step. */
export type FxStepSetting =
	| "stepDb"
	| "stepHz"
	| "stepPositions"
	| "stepFine"
	| "stepTenth"
	| "stepWhole"
	| "stepTen";

/**
 * Which slider carries this parameter's step.
 *
 * One per unit, and one per default magnitude within "native", because a range
 * control's bounds and default are static markup: a single control cannot span
 * 0.05 units for a width and 10 ms for a release while defaulting correctly for
 * both. The inspector shows exactly one of them at a time.
 */
export function stepSettingOf(key: FxKey): FxStepSetting {
	const p = GLOBAL_FX[key]!;
	switch (p.unit) {
		case "db":
			return "stepDb";
		case "hz":
			return "stepHz";
		case "index":
			return "stepPositions";
		default:
			return p.step <= 0.05
				? "stepFine"
				: p.step <= 0.1
					? "stepTenth"
					: p.step <= 1
						? "stepWhole"
						: "stepTen";
	}
}

/** Highest selectable position, or undefined when the list is unknown. */
/**
 * List entries for an index parameter. Static lists come from the table;
 * reference level follows the detected device and bus.
 */
export function positionsOf(key: FxKey, bus?: g.GlobalBus): readonly string[] | undefined {
	if (key === "refLevel") {
		return bus === "input" || bus === "output" ? detectedRefLevels(bus) : undefined;
	}
	return GLOBAL_FX[key]!.positions;
}

export const maxPosition = (key: FxKey, bus?: g.GlobalBus): number | undefined => {
	const names = positionsOf(key, bus);
	return names === undefined ? undefined : names.length - 1;
};

/** Name of an index parameter's position, or undefined when outside a known list. */
export function positionName(key: FxKey, value: number, bus?: g.GlobalBus): string | undefined {
	const names = positionsOf(key, bus);
	if (names === undefined) return undefined;
	return names[Math.round(value)];
}
