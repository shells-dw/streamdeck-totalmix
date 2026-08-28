import { stepDb } from "./curves.js";

/** Value stepping for dials and nudge keys (SDK-free for tests). */

/** Fallback preamp span in dB for kOSCScaleLin01 gain; see totalmix/devices.ts. */
export const GAIN_ASSUMED_RANGE_DB = 65;

/** FX step: 2% of range per detent. */
export const FX_STEP = 0.02;

/** Classic pan step: 1% of the 0..1 throw (two TotalMix pan units). */
export const PAN_STEP = 0.01;

/** Global balpan step: same 1% of a -1..+1 throw. */
export const BALANCE_STEP = 0.02;

export type StepKind = "fader" | "gain" | "fx" | "pan";

/** Next wire value. Faders step in dB on the RME curve; gain, FX and pan step linearly. */
export function computeNext(
	kind: StepKind,
	current: number,
	ticks: number,
	dbStep: number,
	fxFraction: number,
	gainRangeDb: number = GAIN_ASSUMED_RANGE_DB,
): number {
	switch (kind) {
		case "fader":
			return stepDb(current, ticks * dbStep);
		case "gain":
			return clamp01(
				current + (ticks * dbStep) / (gainRangeDb > 0 ? gainRangeDb : GAIN_ASSUMED_RANGE_DB),
			);
		case "fx":
			return clamp01(current + ticks * fxFraction);
		case "pan":
			// Snapped to the step grid so 0.5 is reachable exactly.
			return clamp01(Math.round((current + ticks * PAN_STEP) / PAN_STEP) * PAN_STEP);
	}
}

/** Rounds a gain display string to a whole number, keeping its unit ("60.0 dB" -> "60 dB"). Non-numeric strings pass through. */
export function formatGain(val: string): string {
	const m = val.match(/^\s*([+-]?\d+(?:\.\d+)?)\s*(.*)$/);
	if (m?.[1] === undefined) return val;
	const unit = (m[2] ?? "").trim() || "dB";
	return `${Math.round(Number(m[1]))} ${unit}`;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
