import { describe, expect, it } from "vitest";

const { stepGainDb, GAIN_MIN_DB, GAIN_MAX_DB } = await import("./gain.js");

describe("gain stepping", () => {
	it("moves exactly 1 dB per tick", () => {
		expect(stepGainDb(20, 1)).toBe(21);
		expect(stepGainDb(20, -1)).toBe(19);
		expect(stepGainDb(20, 3)).toBe(23);
	});

	it("snaps off-grid values to whole dB before stepping", () => {
		// A cache holding 20.4 must not produce an endless 20.4 -> 21.4 ladder.
		expect(stepGainDb(20.4, 1)).toBe(21);
		expect(stepGainDb(20.6, -1)).toBe(20);
	});

	it("clamps to the 0..75 dB range", () => {
		expect(GAIN_MIN_DB).toBe(0);
		expect(GAIN_MAX_DB).toBe(75);
		expect(stepGainDb(0, -1)).toBe(0);
		expect(stepGainDb(75, 1)).toBe(75);
		expect(stepGainDb(74.6, 1)).toBe(75);
		expect(stepGainDb(-5, -1)).toBe(0);
		expect(stepGainDb(200, 1)).toBe(75);
	});
});
