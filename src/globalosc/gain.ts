/** Global OSC gain stepping: 1 dB per step, floor 0 dB, device-dependent ceiling. */

export const GAIN_MIN_DB = 0;

/** Ceiling when the device is unknown (largest known preamp span). */
export const GAIN_MAX_DB = 75;

/** Rounds the current value to an integer, then steps `ticks` dB within [0, maxDb]. */
export function stepGainDb(current: number, ticks: number, maxDb: number = GAIN_MAX_DB): number {
	const ceiling = maxDb > GAIN_MIN_DB ? maxDb : GAIN_MAX_DB;
	return Math.min(ceiling, Math.max(GAIN_MIN_DB, Math.round(current) + ticks));
}
