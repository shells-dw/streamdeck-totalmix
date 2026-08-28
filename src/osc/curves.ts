/**
 * Value scaling from the RME OSC table (TotalMix FX 1.96, 22.07.2024).
 * Formulas transcribed verbatim.
 */

/** Wire 0.0 = -65 dB, displayed by TotalMix as -oo. */
export const MIN_DB = -65.0;

/** Wire 1.0 = +6 dB (the constants yield 6.0000000027; tests need ~1e-8 tolerance). */
export const MAX_DB = 6.0;

// Piecewise curve, split at fader position 649/1023 = -6.0 dB.
const SPLIT_FADER_POS = 649.0;
const SPLIT_DB = -6.0;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Fader wire value (0..1) to dB. */
export function faderToDb(value: number): number {
	const faderPos = clamp01(value) * 1023.0;

	if (faderPos >= SPLIT_FADER_POS) {
		return faderPos * 0.0320855615 - 26.8235294118;
	}

	return faderPos * faderPos * (-1.0 / 11033.0) + faderPos * 0.1497326203 - 65.0;
}

/** dB to fader wire value (0..1). */
export function dbToFader(dB: number): number {
	if (Number.isNaN(dB)) return 0;

	if (dB >= SPLIT_DB) {
		return clamp01(((dB + 26.8235294118) * (1.0 / 0.0320855615)) / 1023.0);
	}

	// Clamped first so -Infinity cannot produce NaN under the root.
	const d = -34869.0 - 11033.0 * Math.max(dB, MIN_DB);
	return clamp01((826.0 - Math.sqrt(d)) / 1023.0);
}

/** Steps a fader value by `deltaDb`, clamped to [MIN_DB, MAX_DB]. */
export function stepDb(currentValue: number, deltaDb: number): number {
	const dB = faderToDb(currentValue);
	return dbToFader(Math.min(Math.max(dB + deltaDb, MIN_DB), MAX_DB));
}

export const isMinusInfinity = (value: number): boolean => clamp01(value) <= 0;

/** Fallback fader display when no "...Val" string is cached; "-oo" matches TotalMix. */
export function formatDb(value: number): string {
	if (isMinusInfinity(value)) return "-oo";
	const dB = faderToDb(value);
	return `${dB >= 0 ? "+" : ""}${dB.toFixed(1)} dB`;
}

/** Fader value to 0..100 for the touch-display bar. */
export const faderToBar = (value: number): number => Math.round(clamp01(value) * 100);

// --- kOSCScaleFreq: pseudo-logarithmic over 20 Hz .. 20 kHz ---------------------

const LOG_MIN = Math.log(20.0);
const LOG_MAX = Math.log(20000.0);

export const freqToValue = (hz: number): number =>
	clamp01((Math.log(hz) - LOG_MIN) / (LOG_MAX - LOG_MIN));

export const valueToFreq = (value: number): number =>
	Math.exp(clamp01(value) * (LOG_MAX - LOG_MIN) + LOG_MIN);

/** Classic 0..1 pan in TotalMix notation: "L100" .. "C" .. "R100". Page-1 pans have no Val string. */
export function formatPan(value: number): string {
	const units = Math.round((clamp01(value) * 2 - 1) * 100);
	if (units === 0) return "C";
	return units < 0 ? `L${-units}` : `R${units}`;
}

/** Global OSC balpan (-1..+1) in the same notation. */
export function formatBalance(value: number): string {
	const clamped = value < -1 ? -1 : value > 1 ? 1 : value;
	const units = Math.round(clamped * 100);
	if (units === 0) return "C";
	return units < 0 ? `L${-units}` : `R${units}`;
}
