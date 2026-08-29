import { describe, expect, it } from "vitest";
import { dbToFader } from "../osc/curves.js";
import { TM } from "./theme.js";
import { ellipsize, esc, fitFont, svgDataUrl } from "./svg.js";
import {
	buttonKeySvg,
	listKeySvg,
	listTouchSvg,
	faderKeyImage,
	faderKeySvg,
	faderTouchSvg,
	knobKeySvg,
	knobTouchSvg,
} from "./strip.js";

const base = { name: "Mic 1", label: "-12.0 dB", position: dbToFader(-12), mute: false, solo: false };

/** y of the vertical cap body: first rect filled with the cap gradient. */
const capY = (svg: string): number => {
	const m = /<rect x="[\d.]+" y="([\d.]+)" width="36" height="18" rx="3" fill="url\(#capV\)"/.exec(svg);
	if (m === null) throw new Error("cap not found");
	return Number(m[1]);
};

describe("svg helpers", () => {
	it("escapes markup in text", () => {
		expect(esc('<a & "b">')).toBe("&lt;a &amp; &quot;b&quot;&gt;");
	});

	it("fits font size between the bounds", () => {
		expect(fitFont("ab", 100, 20, 8)).toBe(20);
		expect(fitFont("a".repeat(40), 100, 20, 8)).toBe(8);
	});

	it("ellipsizes long names", () => {
		expect(ellipsize("Analog 5/6 Monitor", 10)).toBe("Analog 5/…");
		expect(ellipsize("Mic 1", 10)).toBe("Mic 1");
	});

	it("encodes a base64 svg data url", () => {
		const url = svgDataUrl("<svg/>");
		expect(url.startsWith("data:image/svg+xml;base64,")).toBe(true);
		expect(Buffer.from(url.split(",")[1] ?? "", "base64").toString()).toBe("<svg/>");
	});
});

describe("fader key", () => {
	it("is a complete svg carrying the name and readout", () => {
		const svg = faderKeySvg(base);
		expect(svg.startsWith("<svg")).toBe(true);
		expect(svg.endsWith("</svg>")).toBe(true);
		expect(svg).toContain(">Mic 1<");
		expect(svg).toContain(">-12.0 dB<");
	});

	it("moves the cap with the fader position", () => {
		const low = capY(faderKeySvg({ ...base, position: 0 }));
		const unity = capY(faderKeySvg({ ...base, position: dbToFader(0) }));
		const top = capY(faderKeySvg({ ...base, position: 1 }));
		expect(low).toBeGreaterThan(unity);
		expect(unity).toBeGreaterThan(top);
	});

	it("lights the pills in TotalMix colours", () => {
		expect(faderKeySvg({ ...base, mute: true })).toContain(`fill="${TM.mute}"`);
		expect(faderKeySvg({ ...base, solo: true })).toContain(`fill="${TM.solo}"`);
		expect(faderKeySvg(base)).not.toContain(`fill="${TM.mute}"`);
	});

	it("draws the meter only when a level is known, red at 0 dB", () => {
		expect(faderKeySvg(base)).not.toContain(`fill="${TM.meter}"`);
		expect(faderKeySvg({ ...base, meterDb: -20 })).toContain(`fill="${TM.meter}"`);
		expect(faderKeySvg({ ...base, meterDb: 0.2 })).toContain(`fill="${TM.hot}"`);
	});

	it("omits the meter well when asked", () => {
		expect(faderKeySvg({ ...base, noMeter: true })).not.toContain(`fill="${TM.inset}" `);
		expect(faderTouchSvg({ ...base, noMeter: true, meterDb: -10 })).not.toContain(`fill="${TM.meter}"`);
	});

	it("draws the hold line above the fill", () => {
		const svg = faderKeySvg({ ...base, meterDb: -20, holdDb: -8 });
		expect(svg).toContain(`fill="${TM.meterPeak}"`);
		expect(faderKeySvg({ ...base, meterDb: -20, holdDb: 0.5 })).toContain(`height="2" fill="${TM.hot}"`);
	});

	it("shows a dash and no lit state when offline", () => {
		const svg = faderKeySvg({ ...base, mute: true, meterDb: -3, offline: true });
		expect(svg).toContain(">—<");
		expect(svg).not.toContain(`fill="${TM.mute}"`);
		expect(svg).not.toContain(`fill="${TM.meter}"`);
	});

	it("escapes channel names", () => {
		expect(faderKeySvg({ ...base, name: "Chat <- Apo" })).toContain("Chat &lt;- Apo");
	});

	it("encodes a data url for setImage", () => {
		expect(faderKeyImage(base)).toMatch(/^data:image\/svg\+xml;base64,/);
	});
});

describe("touch and knob artwork", () => {
	it("touch strip uses the 200x100 viewBox", () => {
		expect(faderTouchSvg(base)).toContain('viewBox="0 0 200 100"');
	});

	it("knob key prints the readout once, touch prints it beside the knob", () => {
		const s = { name: "Mic 1", label: "56 dB", position: 0.7, bipolar: false, badges: [] };
		expect(knobKeySvg(s).split(">56 dB<").length - 1).toBe(1);
		expect(knobTouchSvg(s).split(">56 dB<").length - 1).toBe(1);
	});

	it("prints the caption and lights a badge", () => {
		const svg = knobKeySvg({
			name: "Mic 1",
			label: "+3.0 dB",
			position: 0.6,
			bipolar: true,
			caption: "EQ1 Gain",
			badges: [{ label: "EQ", lit: true, colour: TM.fxOn }],
		});
		expect(svg).toContain(">EQ1 Gain<");
		expect(svg).toContain(`fill="${TM.fxOn}"`);
	});

	it("bipolar knob draws no arc at centre", () => {
		const centred = knobTouchSvg({ name: "P", label: "C", position: 0.5, bipolar: true, badges: [] });
		expect(centred).not.toContain(`stroke="${TM.selected}"`);
	});
});

describe("list artwork", () => {
	const s = { name: "Reverb", label: "Large Room", caption: "Rev Type", index: 2, count: 15, badges: [] };

	it("prints the entry and caption without a knob ring", () => {
		const svg = listKeySvg(s);
		expect(svg).toContain(">Large Room<");
		expect(svg).toContain(">Rev Type<");
		expect(svg).not.toContain("<path");
	});

	it("marks the current position among the dots", () => {
		const svg = listTouchSvg(s);
		expect(svg.split(`fill="${TM.selected}"`).length - 1).toBe(2);
		expect(svg.split("<circle").length - 1).toBe(15);
	});

	it("lights the box for an active select key", () => {
		expect(listKeySvg({ ...s, active: true })).toContain(`fill="${TM.selected}" stroke=`);
		expect(listKeySvg(s)).not.toContain(`fill="${TM.selected}" stroke=`);
	});

	it("hides dots for unknown lists", () => {
		expect(listKeySvg({ ...s, count: undefined })).not.toContain("<circle");
	});
});

describe("button key", () => {
	it("lights the face with the given colour and keeps the caption", () => {
		const on = buttonKeySvg({ label: "48V", caption: "Mic 1", on: true, colour: TM.hot });
		expect(on).toContain(`fill="${TM.hot}"`);
		expect(on).toContain(">Mic 1<");
		const off = buttonKeySvg({ label: "48V", caption: "Mic 1", on: false, colour: TM.hot });
		expect(off).not.toContain(`fill="${TM.hot}"`);
	});

	it("stays unlit when offline", () => {
		expect(buttonKeySvg({ label: "M", caption: "", on: true, colour: TM.mute, offline: true })).not.toContain(
			`fill="${TM.mute}"`,
		);
	});
});
