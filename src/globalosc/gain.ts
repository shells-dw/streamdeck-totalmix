/**
 * Gain stepping for the Global Volume action, per user spec: 1 dB per step,
 * floor 0 dB, ceiling 75 dB. Kept decorator-free so tests can import it
 * without dragging the Stream Deck SDK in.
 */

export const GAIN_MIN_DB = 0;
export const GAIN_MAX_DB = 75;

/**
 * Each detent is exactly 1 dB, and the current value is snapped to an integer
 * first — a cache that somehow holds 20.4 must not produce an endless
 * 20.4 -> 21.4 ladder of off-grid values.
 */
export function stepGainDb(current: number, ticks: number): number {
	return Math.min(GAIN_MAX_DB, Math.max(GAIN_MIN_DB, Math.round(current) + ticks));
}
