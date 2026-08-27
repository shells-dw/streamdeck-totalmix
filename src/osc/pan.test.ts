import { describe, expect, it } from "vitest";
import { formatBalance, formatPan } from "./curves.js";
import { BALANCE_STEP, computeNext, PAN_STEP } from "./steps.js";

describe("formatPan", () => {
	it("prints TotalMix's own notation", () => {
		expect(formatPan(0)).toBe("L100");
		expect(formatPan(0.25)).toBe("L50");
		expect(formatPan(0.5)).toBe("C");
		expect(formatPan(0.75)).toBe("R50");
		expect(formatPan(1)).toBe("R100");
	});

	it("clamps out-of-range values rather than printing nonsense", () => {
		expect(formatPan(-1)).toBe("L100");
		expect(formatPan(2)).toBe("R100");
	});
});

describe("computeNext, pan", () => {
	it("steps one percent of the throw per detent", () => {
		expect(computeNext("pan", 0.5, 1, 1.5, 0.02)).toBeCloseTo(0.5 + PAN_STEP, 10);
		expect(computeNext("pan", 0.5, -1, 1.5, 0.02)).toBeCloseTo(0.5 - PAN_STEP, 10);
	});

	it("lands exactly on centre when stepping back from off-centre", () => {
		// Drift would leave centre unreachable by turning, which is the whole
		// reason the touch gesture exists — but turning should reach it too.
		let v = 0.5;
		for (let i = 0; i < 7; i++) v = computeNext("pan", v, 1, 1.5, 0.02);
		for (let i = 0; i < 7; i++) v = computeNext("pan", v, -1, 1.5, 0.02);
		expect(v).toBe(0.5);
		expect(formatPan(v)).toBe("C");
	});

	it("stops at the ends", () => {
		expect(computeNext("pan", 0, -5, 1.5, 0.02)).toBe(0);
		expect(computeNext("pan", 1, 5, 1.5, 0.02)).toBe(1);
	});
});

describe("formatBalance", () => {
	it("prints the same notation over Global OSC's -1..+1 range", () => {
		expect(formatBalance(-1)).toBe("L100");
		expect(formatBalance(-0.5)).toBe("L50");
		expect(formatBalance(0)).toBe("C");
		expect(formatBalance(0.5)).toBe("R50");
		expect(formatBalance(1)).toBe("R100");
	});

	it("clamps rather than printing nonsense", () => {
		expect(formatBalance(-2)).toBe("L100");
		expect(formatBalance(3)).toBe("R100");
	});

	it("agrees with the classic pan at the same physical position", () => {
		// 0..1 and -1..+1 describe the same control in the two protocols.
		expect(formatBalance(0.5)).toBe(formatPan(0.75));
		expect(formatBalance(0)).toBe(formatPan(0.5));
	});
});

describe("balance stepping", () => {
	it("moves 1% of the throw per detent, twice the wire step of a 0..1 pan", () => {
		expect(BALANCE_STEP).toBeCloseTo(PAN_STEP * 2, 10);
	});
});
