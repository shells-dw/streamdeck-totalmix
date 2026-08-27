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

describe("per-device ceiling", () => {
	it("clamps to the device maximum rather than the default 75", () => {
		// Values above a device's range are ignored by TotalMix.
		expect(stepGainDb(64, 10, 65)).toBe(65);
		expect(stepGainDb(60, 1, 65)).toBe(61);
	});

	it("still allows the full 75 on a device that has it", () => {
		expect(stepGainDb(70, 10, 75)).toBe(75);
	});

	it("keeps the floor at 0 regardless of ceiling", () => {
		expect(stepGainDb(3, -10, 65)).toBe(0);
	});

	it("falls back to 75 if handed a nonsense ceiling", () => {
		expect(stepGainDb(70, 10, 0)).toBe(75);
		expect(stepGainDb(70, 10, -5)).toBe(75);
	});

	it("defaults to 75 when no ceiling is passed", () => {
		expect(stepGainDb(70, 10)).toBe(75);
	});
});
