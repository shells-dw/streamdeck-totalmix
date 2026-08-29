import { describe, expect, it } from "vitest";
import { fxArcColour, fxBipolar, fxPosition, fxSectionBadge } from "./fx-range.js";
import { dbToFader } from "../osc/curves.js";

describe("fxPosition", () => {
	it("spans gains from the centre", () => {
		expect(fxPosition("eqBand1Gain", 0)).toBeCloseTo(0.5);
		expect(fxPosition("eqBand1Gain", 20)).toBe(1);
		expect(fxPosition("eqBand1Gain", -25)).toBe(0);
		expect(fxBipolar("eqBand1Gain")).toBe(true);
	});

	it("uses the log frequency scale", () => {
		expect(fxPosition("eqBand2Freq", 20)).toBeCloseTo(0);
		expect(fxPosition("eqBand2Freq", 20000)).toBeCloseTo(1);
		expect(fxPosition("eqBand2Freq", 632)).toBeCloseTo(0.5, 1);
	});

	it("maps fader-type levels through the fader curve", () => {
		expect(fxPosition("fxSend", 0)).toBeCloseTo(dbToFader(0));
		expect(fxPosition("reverbVolume", -65)).toBe(0);
	});

	it("maps list positions across the list", () => {
		expect(fxPosition("eqBand1Type", 0)).toBe(0);
		expect(fxPosition("eqBand1Type", 3)).toBe(1);
	});

	it("returns undefined for unknown spans", () => {
		expect(fxPosition("reverbAttack", 2)).toBeDefined();
		expect(fxPosition("delay", 2)).toBeDefined();
		expect(fxPosition("reverbLowcut", 2)).toBeDefined();
	});

	it("colours and badges follow the section", () => {
		expect(fxArcColour("eqBand1Q")).not.toBe(fxArcColour("eqBand2Q"));
		expect(fxSectionBadge("dynamics")).toBe("D");
		expect(fxSectionBadge(undefined)).toBeUndefined();
	});
});
