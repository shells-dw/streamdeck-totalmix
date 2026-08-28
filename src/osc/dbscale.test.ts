import { describe, expect, it } from "vitest";
import { DbScale, parseDb } from "./dbscale.js";

describe("parseDb", () => {
	it("reads the figure out of TotalMix's display strings", () => {
		expect(parseDb("-12.5 dB")).toBeCloseTo(-12.5, 6);
		expect(parseDb("+3.0 dB")).toBeCloseTo(3, 6);
		expect(parseDb("0.0 dB")).toBe(0);
	});

	/** The display follows the host locale, so a comma decimal has to work. */
	it("accepts a comma decimal separator", () => {
		expect(parseDb("-12,5 dB")).toBeCloseTo(-12.5, 6);
	});

	it("has no figure for silence or for a non-numeric string", () => {
		expect(parseDb("-oo")).toBeUndefined();
		expect(parseDb("-oo dB")).toBeUndefined();
		expect(parseDb("n/a")).toBeUndefined();
		expect(parseDb("")).toBeUndefined();
	});
});

describe("DbScale", () => {
	/** A parameter spanning 75 dB over the 0..1 range, as a volume does. */
	const dbAt = (v: number): number => -69 + 75 * v;

	it("has no slope before two readings", () => {
		const scale = new DbScale();
		expect(scale.slope).toBeUndefined();
		expect(scale.step(0.5, 1)).toBeUndefined();

		scale.observe(0.5, dbAt(0.5));
		expect(scale.slope).toBeUndefined();
	});

	it("measures the slope from two separated readings", () => {
		const scale = new DbScale();
		scale.observe(0.5, dbAt(0.5));
		scale.observe(0.6, dbAt(0.6));

		expect(scale.slope).toBeCloseTo(75, 4);
	});

	it("converts a decibel step into a wire step", () => {
		const scale = new DbScale();
		scale.observe(0.5, dbAt(0.5));
		scale.observe(0.6, dbAt(0.6));

		// One decibel of a 75 dB span.
		expect(scale.step(0.6, 1)).toBeCloseTo(0.6 + 1 / 75, 6);
		expect(scale.step(0.6, -1)).toBeCloseTo(0.6 - 1 / 75, 6);
	});

	it("stays inside the wire range at either end", () => {
		const scale = new DbScale();
		scale.observe(0.0, dbAt(0.0));
		scale.observe(1.0, dbAt(1.0));

		expect(scale.step(1.0, 6)).toBe(1);
		expect(scale.step(0.0, -6)).toBe(0);
	});

	/**
	 * Readings closer together than the display's own rounding would measure the
	 * rounding rather than the mapping.
	 */
	it("ignores readings too close together to measure", () => {
		const scale = new DbScale();
		scale.observe(0.5, dbAt(0.5));
		scale.observe(0.5005, dbAt(0.5005));

		expect(scale.slope).toBeUndefined();
	});

	/**
	 * A run of readings too close together must not keep resetting the baseline,
	 * or the separation needed to measure anything never accumulates.
	 */
	it("accumulates separation across readings that were too close", () => {
		const scale = new DbScale();
		scale.observe(0.5, dbAt(0.5));
		scale.observe(0.501, dbAt(0.501));
		scale.observe(0.502, dbAt(0.502));
		scale.observe(0.51, dbAt(0.51));

		expect(scale.slope).toBeCloseTo(75, 4);
	});

	/**
	 * At the bottom of a volume a range of values all read as the same figure,
	 * so a pair taken there measures a slope of zero. Keeping it would make a
	 * decibel step divide by nothing and freeze the dial.
	 */
	it("rejects a slope measured where the reading has saturated", () => {
		const scale = new DbScale();
		scale.observe(0.2, dbAt(0.2));
		scale.observe(0.4, dbAt(0.4));

		scale.observe(0.02, -65);
		scale.observe(0.10, -65);

		expect(scale.slope).toBeGreaterThan(0);
		expect(scale.step(0.5, 1)).toBeDefined();
	});

	it("follows the mapping locally rather than averaging its whole range", () => {
		// Steeper above the midpoint than below it.
		const bent = (v: number): number => (v < 0.5 ? 20 * v : 10 + 60 * (v - 0.5));

		const scale = new DbScale();
		scale.observe(0.1, bent(0.1));
		scale.observe(0.3, bent(0.3));
		expect(scale.slope).toBeCloseTo(20, 4);

		scale.observe(0.7, bent(0.7));
		scale.observe(0.9, bent(0.9));
		expect(scale.slope).toBeCloseTo(60, 4);
	});

	it("measures the same slope from readings taken in either direction", () => {
		const up = new DbScale();
		up.observe(0.4, dbAt(0.4));
		up.observe(0.6, dbAt(0.6));

		const down = new DbScale();
		down.observe(0.6, dbAt(0.6));
		down.observe(0.4, dbAt(0.4));

		expect(down.slope).toBeCloseTo(up.slope ?? 0, 6);
	});

	it("ignores readings that are not finite", () => {
		const scale = new DbScale();
		scale.observe(0.4, dbAt(0.4));
		scale.observe(Number.NaN, 0);
		scale.observe(0.6, dbAt(0.6));

		expect(scale.slope).toBeCloseTo(75, 4);
	});
});
