/**
 * Gain stepping for the Global Volume action: 1 dB per step, floor 0 dB, ceiling
 * per device. Kept decorator-free so tests can import it without dragging the
 * Stream Deck SDK in.
 */

export const GAIN_MIN_DB = 0;

/** Ceiling used when the device is unknown, set to the highest known preamp span. */
export const GAIN_MAX_DB = 75;

/**
 * Steps 1 dB per detent, rounding the current value to an integer first so an
 * off-grid cached value cannot produce an off-grid ladder.
 *
 * `maxDb` is the device ceiling from /status/device. Values above a device's
 * range are ignored by TotalMix, leaving the dial and the reading out of step.
 */
export function stepGainDb(current: number, ticks: number, maxDb: number = GAIN_MAX_DB): number {
	const ceiling = maxDb > GAIN_MIN_DB ? maxDb : GAIN_MAX_DB;
	return Math.min(ceiling, Math.max(GAIN_MIN_DB, Math.round(current) + ticks));
}
