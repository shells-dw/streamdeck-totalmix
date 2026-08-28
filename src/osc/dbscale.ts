/**
 * Runtime measurement of the wire-value → dB mapping for kOSCScaleLin01
 * parameters that TotalMix displays in dB (reverb/echo volume, FX send/return,
 * compressor/expander thresholds, make-up gain, Auto Level gain/headroom).
 * The table gives no range for these; the slope is derived from consecutive
 * (value, "...Val" dB string) observations.
 */

/** Minimum wire separation between two readings before they define a slope. */
const MIN_SPAN = 0.004;

/** Slope bounds (dB per unit wire value); outside = saturated or noisy reading. */
const MIN_SLOPE_DB = 1;
const MAX_SLOPE_DB = 2000;

interface Reading {
	value: number;
	db: number;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Parses the leading dB figure of a display string; undefined for "-oo" or no number. Accepts comma decimals. */
export function parseDb(display: string): number | undefined {
	if (/^\s*-?\s*oo/i.test(display)) return undefined;
	const m = /^\s*([+-]?\d+(?:[.,]\d+)?)/.exec(display);
	if (m?.[1] === undefined) return undefined;
	const db = Number(m[1].replace(",", "."));
	return Number.isFinite(db) ? db : undefined;
}

/** Measured value→dB slope for one address. */
export class DbScale {
	private previous: Reading | undefined;
	private measured: number | undefined;

	/** Records a reading; updates the slope when far enough from the last used reading. */
	observe(value: number, db: number): void {
		if (!Number.isFinite(value) || !Number.isFinite(db)) return;

		const last = this.previous;
		if (last === undefined) {
			this.previous = { value, db };
			return;
		}

		const span = value - last.value;
		if (Math.abs(span) < MIN_SPAN) return;

		const slope = (db - last.db) / span;
		this.previous = { value, db };

		if (slope >= MIN_SLOPE_DB && slope <= MAX_SLOPE_DB) this.measured = slope;
	}

	/** dB per unit wire value, or undefined while unmeasured. */
	get slope(): number | undefined {
		return this.measured;
	}

	/** Wire value after a `deltaDb` step, or undefined while unmeasured. */
	step(current: number, deltaDb: number): number | undefined {
		const slope = this.measured;
		if (slope === undefined) return undefined;
		return clamp01(current + deltaDb / slope);
	}
}
