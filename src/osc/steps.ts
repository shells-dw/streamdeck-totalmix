import { stepDb } from "./curves.js";

/**
 * Value stepping for dials and nudge keys.
 *
 * Deliberately kept out of the action files: those carry the `@action` decorator
 * and import the Stream Deck SDK, which drags a whole runtime into anything that
 * imports them — including tests. Pure functions live here so they can be tested
 * directly, with no SDK and no decorator transform involved.
 */

/**
 * A typical RME preamp spans roughly this many dB. Gain is kOSCScaleLin01 over a
 * device-dependent range, so exact dB-per-detent is unknowable from our side;
 * this makes a step feel like approximately the configured dB. The displayed
 * value always comes from TotalMix's own string, so the reading stays truthful
 * even where this approximation is off.
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
): number {
	switch (kind) {
		case "fader":
			return stepDb(current, ticks * dbStep);
		case "gain":
			return clamp01(current + (ticks * dbStep) / GAIN_ASSUMED_RANGE_DB);
		case "fx":
			return clamp01(current + ticks * fxFraction);
	}
}

/**
 * Reduces TotalMix's gain display string ("60.0 dB") to a bare whole number
 * ("60") — preamps step in integers, so decimals and units are noise on a dial
 * touchscreen. Unrecognised strings pass through untouched, so an unexpected
 * device format degrades to showing exactly what TotalMix sent.
 */
export function formatGain(val: string): string {
	const m = val.match(/-?\d+(?:\.\d+)?/);
	return m ? String(Math.round(Number(m[0]))) : val;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
