import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAX_DB, MIN_DB } from "../osc/curves.js";
import {
	fxAddress,
	fxEnableAddress,
	fxStep,
	GLOBAL_FX,
	isFxKey,
	isOffDb,
	maxPosition,
	positionName,
	stepSettingOf,
	MAX_HZ,
	MIN_HZ,
	type FxKey,
} from "./fx.js";

const keys = Object.keys(GLOBAL_FX) as FxKey[];

/**
 * Every address must exist in RME's Global OSC table. An address that does not
 * is not rejected by TotalMix, it is ignored, so nothing else would catch it.
 */
describe("addresses conform to the Global OSC table", () => {
	const spec = JSON.parse(readFileSync("fixtures/globalosc-spec.json", "utf8")) as {
		sections: Record<string, { params: Record<string, unknown> }>;
	};

	it.each(keys)("%s names a parameter the table defines", (key) => {
		const p = GLOBAL_FX[key]!;
		const section = p.scope === "channel" ? "channel" : p.scope;
		expect(Object.keys(spec.sections[section]!.params)).toContain(p.param);
	});

	it("builds channel addresses from the bus and channel number", () => {
		expect(fxAddress("eqBand1Gain", "output", 2)).toBe("/output/2/eq/band1gain");
		expect(fxAddress("lowcutFreq", "input", 0)).toBe("/input/0/lowcut/freq");
		expect(fxAddress("dynCompThreshold", "playback", 7)).toBe("/playback/7/dynamics/compthres");
	});

	/** The units carry no channel, so the bus and channel are ignored for them. */
	it("builds unit addresses without a channel", () => {
		expect(fxAddress("reverbVolume", "output", 5)).toBe("/reverb/volume");
		expect(fxAddress("echoDelay", "input", 3)).toBe("/echo/delay");
	});
});

describe("section enables", () => {
	it("points each channel parameter at its own section", () => {
		expect(fxEnableAddress("eqBand2Freq", "input", 1)).toBe("/input/1/eq/enable");
		expect(fxEnableAddress("lowcutSlope", "input", 1)).toBe("/input/1/lowcut/enable");
		expect(fxEnableAddress("dynExpRatio", "input", 1)).toBe("/input/1/dynamics/enable");
		expect(fxEnableAddress("autoHeadroom", "input", 1)).toBe("/input/1/autolevel/enable");
	});

	it("points the unit parameters at their unit", () => {
		expect(fxEnableAddress("reverbTime", "input", 0)).toBe("/reverb/enable");
		expect(fxEnableAddress("echoFeedback", "input", 0)).toBe("/echo/enable");
	});

	/** Width, delay and crossfeed are always in circuit; nothing switches them. */
	it("has none for the parameters that belong to no section", () => {
		expect(fxEnableAddress("width", "output", 0)).toBeUndefined();
		expect(fxEnableAddress("delay", "output", 0)).toBeUndefined();
		expect(fxEnableAddress("crossfeed", "output", 0)).toBeUndefined();
	});
});

/**
 * Global OSC transmits these in their own units, so a step is added to the
 * value directly — none of the classic protocol's 0..1 conversion applies.
 */
describe("stepping", () => {
	it("adds the step in the parameter's own unit", () => {
		expect(fxStep("eqBand1Gain", -3, 1, 1)).toBeCloseTo(-2, 6);
		expect(fxStep("eqBand1Gain", -3, -2, 0.5)).toBeCloseTo(-4, 6);
		expect(fxStep("eqBand1Freq", 1000, 1, 20)).toBeCloseTo(1020, 6);
		expect(fxStep("dynCompRatio", 2.5, 1, 0.1)).toBeCloseTo(2.6, 6);
	});

	it("holds a frequency inside the range the controls cover", () => {
		expect(fxStep("eqBand1Freq", MIN_HZ, -1, 50)).toBe(MIN_HZ);
		expect(fxStep("eqBand1Freq", MAX_HZ, 1, 50)).toBe(MAX_HZ);
	});

	/** An index is a position in a list; a fractional one addresses nothing. */
	it("keeps an index whole and never negative", () => {
		expect(fxStep("eqBand1Type", 0, 1, 1)).toBe(1);
		expect(fxStep("eqBand1Type", 0, -1, 1)).toBe(0);
		expect(fxStep("eqBand1Type", 2.4, 1, 1)).toBe(3);
	});

	/** Send and return are faders and stop at the ends of the published curve. */
	it("holds the FX send and return inside the fader range", () => {
		expect(fxStep("fxSend", -64, -10, 1)).toBe(MIN_DB);
		expect(fxStep("fxReturn", 5, 10, 1)).toBe(MAX_DB);
		expect(fxStep("fxSend", -20, 3, 1)).toBe(-17);
	});

	/** An under-range level is off, not a number to print. */
	it("reads an under-range level as off", () => {
		expect(isOffDb("fxSend", -300)).toBe(true);
		expect(isOffDb("fxSend", MIN_DB)).toBe(true);
		expect(isOffDb("fxSend", -64)).toBe(false);
		expect(isOffDb("eqBand1Type", 0)).toBe(false);
	});

	/** The classic protocol sends the name beside the index; Global OSC does not. */
	it("names the EQ filter types by position", () => {
		expect(positionName("eqBand1Type", 0)).toBe("Bell");
		expect(positionName("eqBand1Type", 1)).toBe("Shelving");
		expect(positionName("eqBand3Type", 2)).toBe("High Pass");
		expect(positionName("eqBand3Type", 3)).toBe("Low Pass");
	});

	/** Index contents are device dependent, so an unknown list stays numeric. */
	it("has no names for the lists the table leaves open", () => {
		expect(positionName("lowcutSlope", 0)).toBeUndefined();
		expect(positionName("refLevel", 0)).toBeUndefined();
		expect(positionName("reverbType", 0)).toBeUndefined();
		expect(maxPosition("reverbType")).toBeUndefined();
	});

	it("stops at the end of a known list and keeps stepping an unknown one", () => {
		expect(fxStep("eqBand1Type", 3, 1, 1)).toBe(3);
		expect(fxStep("eqBand1Type", 0, 9, 1)).toBe(3);
		expect(fxStep("eqBand1Type", 2, -1, 1)).toBe(1);
		expect(fxStep("reverbType", 9, 1, 1)).toBe(10);
	});

	/**
	 * A range control's bounds and default are static markup, so every parameter
	 * has to land on a slider whose default is already its own.
	 */
	it("routes every parameter to a slider whose default matches its step", () => {
		const defaults: Record<string, number> = {
			stepDb: 1,
			stepHz: 20,
			stepPositions: 1,
			stepFine: 0.05,
			stepTenth: 0.1,
			stepWhole: 1,
			stepTen: 10,
		};
		for (const key of keys) {
			expect(defaults[stepSettingOf(key)]).toBe(GLOBAL_FX[key]!.step);
		}
	});

	/** The inspector needs a row for each slider, with the same default. */
	it("agrees with the inspector's sliders", () => {
		const html = readFileSync("de.shells.totalmixgen2.sdPlugin/ui/global-fx.html", "utf8");
		for (const key of keys) {
			const setting = stepSettingOf(key);
			const range = new RegExp(`setting="${setting}"[^>]*default="([\\d.]+)"`).exec(html);
			expect(range, `no slider for ${setting}`).not.toBeNull();
			expect(Number(range![1])).toBe(GLOBAL_FX[key]!.step);
		}
	});

	it("leaves the unbounded parameters to TotalMix to clamp", () => {
		// The table states no range for these and they differ per device.
		expect(fxStep("reverbPredelay", 0, -5, 1)).toBe(-5);
		expect(fxStep("dynGain", 100, 1, 1)).toBe(101);
	});

	it("recognises its own keys and rejects anything else", () => {
		for (const key of keys) expect(isFxKey(key)).toBe(true);
		expect(isFxKey("nonsense")).toBe(false);
		expect(isFxKey("/reverb/volume")).toBe(false);
	});
});

/**
 * The property inspector carries its own copy of the unit, default step and
 * whether a channel applies, because it cannot import TypeScript. The two must
 * agree or a dial steps by one figure while the panel reports another.
 */
describe("the property inspector's copy of the table", () => {
	const html = readFileSync("de.shells.totalmixgen2.sdPlugin/ui/global-fx.html", "utf8");

	const meta = (() => {
		const start = html.indexOf("var META = {");
		const end = html.indexOf("};", start);
		const body = html.slice(start + "var META = ".length, end + 1).replace(/\s+/g, "");
		return JSON.parse(body.replace(/(\w+):/g, '"$1":')) as Record<
			string,
			[string, number, number]
		>;
	})();

	it("lists exactly the same parameters", () => {
		expect(Object.keys(meta).sort()).toEqual([...keys].sort());
	});

	it.each(keys)("%s agrees on unit, default step and channel scope", (key) => {
		const p = GLOBAL_FX[key]!;
		expect(meta[key]).toEqual([p.unit, p.step, p.scope === "channel" ? 1 : 0]);
	});

	it("offers every parameter in the dropdown", () => {
		for (const key of keys) {
			expect(html).toContain(`<option value="${key}">`);
		}
	});
});
