/**
 * Value scaling from RME's official OSC implementation table (TotalMix FX 1.96,
 * 22.07.2024). Formulas are transcribed verbatim and must not be simplified.
 *
 * The fader curve is non-linear in dB: a fixed step in the 0..1 wire domain
 * moves about 0.144 dB near the bottom of the throw and 0.033 dB near the top.
 * Dial stepping therefore converts to dB, steps a fixed dB, and converts back.
 */

/** Wire value 0.0 is this dB floor, displayed by TotalMix as -oo. */
export const MIN_DB = -65.0;

/**
 * Wire value 1.0 is this dB ceiling.
 *
 * The published constants yield 6.0000000027 dB at fader position 1023 rather
 * than exactly 6.0, from rounding in the coefficients. Tests comparing against
 * the curve should allow a tolerance of ~1e-8.
 */
export const MAX_DB = 6.0;

// The curve is piecewise, splitting at fader position 649/1023, which is exactly
// -6.0 dB. Both branches meet there, so the function is continuous and the
// inverse uses the matching -6.0 dB pivot.
const SPLIT_FADER_POS = 649.0;
const SPLIT_DB = -6.0;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Converts a received fader value (0..1) to dB. */
export function faderToDb(value: number): number {
	const faderPos = clamp01(value) * 1023.0;

	if (faderPos >= SPLIT_FADER_POS) {
		return faderPos * 0.0320855615 - 26.8235294118;
	}

	return faderPos * faderPos * (-1.0 / 11033.0) + faderPos * 0.1497326203 - 65.0;
}

/** Converts dB to a fader value (0..1) suitable for sending. */
export function dbToFader(dB: number): number {
	if (Number.isNaN(dB)) return 0;

	if (dB >= SPLIT_DB) {
		return clamp01(((dB + 26.8235294118) * (1.0 / 0.0320855615)) / 1023.0);
	}

	// Clamp first so -Infinity cannot produce NaN under the square root.
	const d = -34869.0 - 11033.0 * Math.max(dB, MIN_DB);
	return clamp01((826.0 - Math.sqrt(d)) / 1023.0);
}

/**
 * Steps a fader value by a fixed number of dB, the primitive used for a dial
 * detent or a volume up/down key.
 */
export function stepDb(currentValue: number, deltaDb: number): number {
	const dB = faderToDb(currentValue);
	return dbToFader(Math.min(Math.max(dB + deltaDb, MIN_DB), MAX_DB));
}

/** True when the fader sits at the bottom, which TotalMix shows as -oo. */
export const isMinusInfinity = (value: number): boolean => clamp01(value) <= 0;

/**
 * Formats a fader value for display. Used only when TotalMix's own "...Val"
 * string is unavailable.
 */
export function formatDb(value: number): string {
	// TotalMix renders minus infinity as the ASCII string "-oo". Matching it keeps
	// this fallback and TotalMix's own Val string consistent.
	if (isMinusInfinity(value)) return "-oo";
	const dB = faderToDb(value);
	return `${dB >= 0 ? "+" : ""}${dB.toFixed(1)} dB`;
}

/** Maps a fader value to 0..100 for a Stream Deck+ touchscreen bar indicator. */
export const faderToBar = (value: number): number => Math.round(clamp01(value) * 100);

// --- Frequency knobs (kOSCScaleFreq), pseudo-logarithmic over 20 Hz - 20 kHz ---

const LOG_MIN = Math.log(20.0);
const LOG_MAX = Math.log(20000.0);

export const freqToValue = (hz: number): number =>
	clamp01((Math.log(hz) - LOG_MIN) / (LOG_MAX - LOG_MIN));

export const valueToFreq = (value: number): number =>
	Math.exp(clamp01(value) * (LOG_MAX - LOG_MIN) + LOG_MIN);

/**
 * Formats a pan wire value the way TotalMix prints it: "L100" to "C" to "R100".
 *
 * Only needed for page-1 strip pans, which are kOSCScaleNoSend and so have no
 * ...Val string of their own; the selected-channel pan on page 2 is
 * kOSCScalePrintPan and its own string is preferred wherever it is available.
 */
export function formatPan(value: number): string {
	const units = Math.round((clamp01(value) * 2 - 1) * 100);
	if (units === 0) return "C";
	return units < 0 ? `L${-units}` : `R${units}`;
}

/**
 * Formats a Global OSC balance/pan value, which runs -1.0 (hard left) through
 * 0.0 (centre) to +1.0 (hard right), in the same notation TotalMix prints for
 * the classic protocol's 0..1 pan.
 */
export function formatBalance(value: number): string {
	const clamped = value < -1 ? -1 : value > 1 ? 1 : value;
	const units = Math.round(clamped * 100);
	if (units === 0) return "C";
	return units < 0 ? `L${-units}` : `R${units}`;
}
