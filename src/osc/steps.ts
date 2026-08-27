import { stepDb } from "./curves.js";

/**
 * Value stepping for dials and nudge keys.
 *
 * Kept out of the action files, which carry the `@action` decorator and import
 * the Stream Deck SDK. Pure functions here are testable without the SDK or the
 * decorator transform.
 */

/**
 * Fallback preamp span. Gain is kOSCScaleLin01 over a device-dependent range;
 * callers pass the device span where known (see totalmix/devices.ts). Displayed
 * values come from TotalMix's own string regardless.
 */
export const GAIN_ASSUMED_RANGE_DB = 65;

/** FX steps 2% of range per detent — fine enough for time and frequency knobs. */
export const FX_STEP = 0.02;

export type StepKind = "fader" | "gain" | "fx";

/**
 * Computes the next wire value for a continuous target.
 *
 * Faders step in dB along RME's curve — that curve is specific to mix faders and
 * must not be applied to the others. Gain and FX are linear on the wire.
 */
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
			// A zero or negative span would make the step infinite or inverted.
			return clamp01(
				current + (ticks * dbStep) / (gainRangeDb > 0 ? gainRangeDb : GAIN_ASSUMED_RANGE_DB),
			);
		case "fx":
			return clamp01(current + ticks * fxFraction);
	}
}

/**
 * Rounds TotalMix's gain display string to a whole number, keeping the unit
 * ("60.0 dB" -> "60 dB").
 *
 * The unit is carried over from the source rather than hardcoded, so a device
 * reporting other than dB shows its own. Strings with no leading number ("n/a",
 * "-oo") pass through unchanged.
 */
export function formatGain(val: string): string {
	const m = val.match(/^\s*([+-]?\d+(?:\.\d+)?)\s*(.*)$/);
	if (m?.[1] === undefined) return val;
	const unit = (m[2] ?? "").trim() || "dB";
	return `${Math.round(Number(m[1]))} ${unit}`;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
