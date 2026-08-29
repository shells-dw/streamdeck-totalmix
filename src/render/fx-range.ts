/**
 * Knob geometry for the Global FX parameters: where the arc starts, how far
 * it fills for a value, and which colour it takes. Bounds are display bounds
 * only; the value written to TotalMix is never clamped here.
 */

import { dbToFader, freqToValue } from "../osc/curves.js";
import { GLOBAL_FX, positionsOf, type FxKey } from "../globalosc/fx.js";
import type { GlobalBus } from "../globalosc/addresses.js";
import { TM } from "./theme.js";

interface Bounds {
	min: number;
	max: number;
	/** Arc grows from the centre stop instead of the left stop. */
	bipolar?: boolean;
}

/** Bounds for parameters whose unit gives no range of its own. */
const BOUNDS: Partial<Record<FxKey, Bounds>> = {
	eqBand1Gain: { min: -20, max: 20, bipolar: true },
	eqBand2Gain: { min: -20, max: 20, bipolar: true },
	eqBand3Gain: { min: -20, max: 20, bipolar: true },
	eqBand1Q: { min: 0.4, max: 9.9 },
	eqBand2Q: { min: 0.4, max: 9.9 },
	eqBand3Q: { min: 0.4, max: 9.9 },
	dynGain: { min: 0, max: 30 },
	dynAttack: { min: 0, max: 250 },
	dynRelease: { min: 0, max: 1500 },
	dynCompThreshold: { min: -60, max: 0 },
	dynCompRatio: { min: 1, max: 10 },
	dynExpThreshold: { min: -60, max: 0 },
	dynExpRatio: { min: 1, max: 10 },
	autoMaxGain: { min: 0, max: 18 },
	autoHeadroom: { min: 3, max: 12 },
	autoRiseTime: { min: 0.1, max: 9.9 },
	width: { min: -1, max: 1, bipolar: true },
	delay: { min: 0, max: 1000 },
	roomEqVolumeCorr: { min: -20, max: 20, bipolar: true },
	roomEqDelay: { min: 0, max: 100 },
	reverbPredelay: { min: 0, max: 999 },
	reverbRoomscale: { min: 0.5, max: 3 },
	reverbSmooth: { min: 0, max: 100 },
	reverbWidth: { min: 0, max: 1 },
	reverbTime: { min: 0.1, max: 4.9 },
	reverbAttack: { min: 0, max: 400 },
	reverbHold: { min: 0, max: 400 },
	reverbRelease: { min: 0, max: 400 },
	echoDelay: { min: 0, max: 2000 },
	echoFeedback: { min: 0, max: 100 },
	echoWidth: { min: 0, max: 1 },
};

// Room EQ bands share the EQ bounds.
for (let band = 1; band <= 9; band++) {
	BOUNDS[`roomEqBand${band}Gain` as FxKey] = { min: -20, max: 20, bipolar: true };
	BOUNDS[`roomEqBand${band}Q` as FxKey] = { min: 0.4, max: 9.9 };
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Arc fill 0..1 for a value, or undefined when the parameter has no known span. */
export function fxPosition(key: FxKey, value: number, bus?: GlobalBus): number | undefined {
	const p = GLOBAL_FX[key]!;
	if (p.unit === "hz") return freqToValue(value);
	if (p.unit === "db" && p.min !== undefined && p.max !== undefined) {
		// Send/return levels and the unit volumes follow the fader curve.
		return dbToFader(value);
	}
	if (p.unit === "db" && (p.scope === "reverb" || p.scope === "echo")) return dbToFader(value);
	const positions = positionsOf(key, bus);
	if (p.unit === "index" && positions !== undefined) {
		return positions.length > 1 ? clamp01(value / (positions.length - 1)) : 0;
	}
	const b = BOUNDS[key];
	if (b === undefined) return undefined;
	return clamp01((value - b.min) / (b.max - b.min));
}

/** True when the arc should grow from the centre. */
export const fxBipolar = (key: FxKey): boolean => BOUNDS[key]?.bipolar === true;

/** Arc colour per TotalMix section: EQ bands red/green/blue, compressor red, expander green. */
export function fxArcColour(key: FxKey): string {
	if (key.startsWith("eqBand1") || key.startsWith("roomEqBand1")) return "#e0413f";
	if (key.startsWith("eqBand2") || key.startsWith("roomEqBand2")) return "#2ec84a";
	if (key.startsWith("eqBand3") || key.startsWith("roomEqBand3")) return TM.selected;
	if (key.startsWith("dynComp")) return "#e0413f";
	if (key.startsWith("dynExp")) return "#2ec84a";
	if (key.startsWith("lowcut")) return TM.fxOn;
	return TM.selected;
}

/** Badge caption for a section, matching the strip buttons in TotalMix. */
export function fxSectionBadge(section: string | undefined): string | undefined {
	switch (section) {
		case "eq":
			return "EQ";
		case "lowcut":
			return "LC";
		case "dynamics":
			return "D";
		case "autolevel":
			return "AL";
		case "fx":
			return "FX";
		case "roomeq":
			return "REQ";
		default:
			return undefined;
	}
}
