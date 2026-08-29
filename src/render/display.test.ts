import { describe, expect, it } from "vitest";
import { displayKeySvg, displayTouchSvg } from "./display.js";
import { TM } from "./theme.js";

describe("display artwork", () => {
	it("meter shows fill, hold line and readout", () => {
		const svg = displayKeySvg({ view: { kind: "meter", name: "Mic 1", peakDb: -12, holdDb: -6 } });
		expect(svg).toContain(`fill="${TM.meter}"`);
		expect(svg).toContain(`fill="${TM.meterPeak}"`);
		expect(svg).toContain(">-6.0 dB<");
	});

	it("meter clips red at 0 dB and hides fill offline", () => {
		expect(displayKeySvg({ view: { kind: "meter", name: "Mic 1", peakDb: 0.5 } })).toContain(`fill="${TM.hot}"`);
		expect(displayKeySvg({ view: { kind: "meter", name: "Mic 1", peakDb: -3 }, offline: true })).not.toContain(`fill="${TM.meter}"`);
	});

	it("connection lights green when on and red when off", () => {
		expect(displayKeySvg({ view: { kind: "status", name: "Connection", value: "Connected", on: true } })).toContain('fill="#2ec84a"');
		expect(displayKeySvg({ view: { kind: "status", name: "Connection", value: "No device", on: false } })).toContain(`fill="${TM.hot}"`);
	});

	it("gauge colours by load", () => {
		expect(displayTouchSvg({ view: { kind: "gauge", name: "DSP", value: "95 %", fraction: 0.95 } })).toContain(`stroke="${TM.hot}"`);
		expect(displayTouchSvg({ view: { kind: "gauge", name: "DSP", value: "20 %", fraction: 0.2 } })).toContain(`stroke="${TM.selected}"`);
	});

	it("clock and transport carry the state glyph", () => {
		expect(displayKeySvg({ view: { kind: "clock", name: "DURec", time: "00:01:23", state: "Record" } })).toContain("<circle");
		expect(displayTouchSvg({ view: { kind: "transport", name: "DURec", state: "Play" } })).toContain("<polygon");
		expect(displayTouchSvg({ view: { kind: "transport", name: "DURec", state: "Stop" } })).toContain(">Stop<");
	});

	it("device name is escaped", () => {
		expect(displayKeySvg({ view: { kind: "text", name: "Device", value: "UCX <II>" } })).toContain("UCX &lt;II&gt;");
	});
});
