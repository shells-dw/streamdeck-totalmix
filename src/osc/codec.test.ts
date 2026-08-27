import { describe, expect, it } from "vitest";
import {
	asBool,
	asNumber,
	encodeBare,
	encodeFloat,
	encodeInt,
	encodeToggle,
	isDisplayValue,
	isHeartbeat,
	parsePacket,
} from "./codec.js";
import {
	dbToFader,
	faderToDb,
	formatDb,
	freqToValue,
	MAX_DB,
	MIN_DB,
	stepDb,
	valueToFreq,
} from "./curves.js";

// --- packet builders: bytes constructed by hand so the parser is tested against
// the wire format rather than against itself ---

const pad4 = (n: number) => (n + 3) & ~3;

function str(s: string): Buffer {
	const raw = Buffer.from(s, "utf8");
	const b = Buffer.alloc(pad4(raw.length + 1));
	raw.copy(b, 0);
	return b;
}

function msg(address: string, ...args: (number | string | { int: number })[]): Buffer {
	let tags = ",";
	const body: Buffer[] = [];

	for (const a of args) {
		if (typeof a === "number") {
			tags += "f";
			const b = Buffer.alloc(4);
			b.writeFloatBE(a, 0);
			body.push(b);
		} else if (typeof a === "string") {
			tags += "s";
			body.push(str(a));
		} else {
			tags += "i";
			const b = Buffer.alloc(4);
			b.writeInt32BE(a.int, 0);
			body.push(b);
		}
	}

	return Buffer.concat([str(address), str(tags), ...body]);
}

function bundle(...elements: Buffer[]): Buffer {
	const parts: Buffer[] = [str("#bundle"), Buffer.alloc(8)];
	for (const e of elements) {
		const size = Buffer.alloc(4);
		size.writeInt32BE(e.length, 0);
		parts.push(size, e);
	}
	return Buffer.concat(parts);
}

describe("parsePacket", () => {
	it("parses a bare message", () => {
		const m = parsePacket(msg("/1/mainDim", 1.0));
		expect(m).toHaveLength(1);
		expect(m[0]!.address).toBe("/1/mainDim");
		expect(m[0]!.value).toBe(1);
		expect(asBool(m[0]!.value)).toBe(true);
	});

	it("parses a bundle of mixed types", () => {
		const m = parsePacket(
			bundle(
				msg("/1/volume1", 0.5),
				msg("/1/volume1Val", "-6.0 dB"),
				msg("/1/trackname1", "Kick"),
				msg("/setSubmix", { int: 2 }),
			),
		);

		expect(m).toHaveLength(4);
		expect(m[0]!.value).toBe(0.5);
		expect(m[1]!.value).toBe("-6.0 dB");
		expect(isDisplayValue(m[1]!)).toBe(true);
		expect(isDisplayValue(m[0]!)).toBe(false);
		expect(m[2]!.value).toBe("Kick");
		expect(m[3]!.value).toBe(2);
	});

	// Address lengths chosen to hit every 4-byte padding remainder.
	it.each(["/a", "/ab", "/abc", "/abcd", "/abcde", "/abcdef", "/abcdefg"])(
		"handles padding alignment for %s",
		(address) => {
			const m = parsePacket(bundle(msg(address, 1.0)));
			expect(m).toHaveLength(1);
			expect(m[0]!.address).toBe(address);
			expect(m[0]!.value).toBe(1);
		},
	);

	it("recognises the heartbeat", () => {
		const m = parsePacket(msg("/", 0.0));
		expect(isHeartbeat(m[0]!)).toBe(true);
	});

	it("flattens nested bundles", () => {
		const m = parsePacket(bundle(bundle(msg("/x", 1.0))));
		expect(m).toHaveLength(1);
		expect(m[0]!.address).toBe("/x");
	});

	// The important one: one malformed datagram must not take the listener down.
	it("never throws on truncated input", () => {
		const full = bundle(
			msg("/1/volume1", 0.5),
			msg("/1/volume1Val", "-6.0 dB"),
			msg("/1/mute/1/3", 1.0),
		);

		for (let n = 0; n <= full.length; n++) {
			expect(() => parsePacket(full.subarray(0, n))).not.toThrow();
		}
	});

	it("never throws on random garbage", () => {
		for (let i = 0; i < 2000; i++) {
			const junk = Buffer.alloc(Math.floor(Math.random() * 128));
			for (let j = 0; j < junk.length; j++) junk[j] = Math.floor(Math.random() * 256);
			expect(() => parsePacket(junk)).not.toThrow();
		}
	});

	it("rejects a negative bundle element size", () => {
		const size = Buffer.alloc(4);
		size.writeInt32BE(-1, 0);
		const buf = Buffer.concat([str("#bundle"), Buffer.alloc(8), size]);
		expect(parsePacket(buf)).toHaveLength(0);
	});

	it("skips unused argument types without losing alignment", () => {
		const i = Buffer.alloc(4);
		i.writeInt32BE(7, 0);
		const f = Buffer.alloc(4);
		f.writeFloatBE(0.25, 0);
		const buf = Buffer.concat([str("/1/volume1"), str(",if"), i, f]);

		const m = parsePacket(buf);
		expect(m).toHaveLength(1);
		expect(m[0]!.argCount).toBe(2);
		expect(m[0]!.value).toBe(7);
	});

	it("does not coerce display strings to numbers", () => {
		const m = parsePacket(msg("/1/volume1Val", "-6.0 dB"));
		expect(asNumber(m[0]!.value)).toBe(0);
		expect(asBool(m[0]!.value)).toBe(false);
	});
});

describe("encoders", () => {
	it("round-trips through the parser", () => {
		const m = parsePacket(encodeFloat("/1/volume1", 0.75));
		expect(m[0]!.address).toBe("/1/volume1");
		expect(m[0]!.value).toBeCloseTo(0.75, 6);
	});

	it.each(["/a", "/ab", "/abc", "/abcd", "/setSubmix"])(
		"emits 4-byte-aligned output for %s",
		(address) => {
			expect(encodeFloat(address, 1).length % 4).toBe(0);
			expect(encodeInt(address, 1).length % 4).toBe(0);
			expect(encodeBare(address).length % 4).toBe(0);
		},
	);

	it("toggle sends 1.0", () => {
		expect(parsePacket(encodeToggle("/1/mainDim"))[0]!.value).toBe(1);
	});
});

describe("fader curve", () => {
	it.each([0, 0.1, 0.25, 0.5, 0.634, 0.635, 0.8, 1])("round-trips at %s", (v) => {
		expect(dbToFader(faderToDb(v))).toBeCloseTo(v, 9);
	});

	it("is continuous at the piecewise split", () => {
		// 649/1023 is exactly -6.0 dB; both branches must agree there.
		expect(faderToDb(649 / 1023)).toBeCloseTo(-6.0, 6);
	});

	it("matches the spec endpoints", () => {
		expect(faderToDb(0)).toBeCloseTo(MIN_DB, 9);
		// RME's rounded coefficients give 6.0000000027 dB at the top, not exactly 6.
		expect(faderToDb(1)).toBeCloseTo(MAX_DB, 7);
	});

	it("is monotonic across all 1024 fader positions", () => {
		let prev = -Infinity;
		for (let i = 0; i <= 1023; i++) {
			const dB = faderToDb(i / 1023);
			expect(dB).toBeGreaterThan(prev);
			prev = dB;
		}
	});

	it("clamps stepping at both ends", () => {
		expect(stepDb(0, -10)).toBeCloseTo(0, 9);
		expect(stepDb(1, +10)).toBeCloseTo(1, 9);
	});

	it("steps by the requested dB amount", () => {
		const moved = stepDb(0.5, 1.5);
		expect(faderToDb(moved) - faderToDb(0.5)).toBeCloseTo(1.5, 6);
	});

	it("handles non-finite input without NaN", () => {
		expect(dbToFader(-Infinity)).toBe(0);
		expect(dbToFader(Infinity)).toBe(1);
		expect(dbToFader(NaN)).toBe(0);
	});

	it("formats dB sensibly", () => {
		// Matches TotalMix's own rendering, verified against a real capture.
		expect(formatDb(0)).toBe("-oo");
		expect(formatDb(1)).toBe("+6.0 dB");
	});

	it("round-trips frequencies", () => {
		for (const hz of [20, 100, 1000, 5000, 20000]) {
			expect(valueToFreq(freqToValue(hz))).toBeCloseTo(hz, 6);
		}
	});
});

describe("gain display formatting", async () => {
	const { formatGain } = await import("./steps.js");

	it.each([
		["60.0 dB", "60 dB"],
		["7.5 dB", "8 dB"],
		["0.0 dB", "0 dB"],
		["-3.0 dB", "-3 dB"],
		["+12.0 dB", "12 dB"],
	])("rounds %s to %s", (input, expected) => {
		expect(formatGain(input)).toBe(expected);
	});

	it("keeps a unit the device reports instead of assuming dB", () => {
		expect(formatGain("12.0 dBu")).toBe("12 dBu");
	});

	it("assumes dB when a bare number arrives", () => {
		expect(formatGain("42")).toBe("42 dB");
	});

	it("passes unrecognised strings through untouched", () => {
		// "-oo" is what TotalMix sends for a fader at the bottom of its travel.
		expect(formatGain("n/a")).toBe("n/a");
		expect(formatGain("-oo")).toBe("-oo");
	});
});

describe("computeNext (key nudges and dial steps)", async () => {
	const { computeNext } = await import("./steps.js");
	const { faderToDb } = await import("./curves.js");

	it("steps faders by dB along the curve", () => {
		const next = computeNext("fader", 0.5, 1, 3, 0);
		expect(faderToDb(next) - faderToDb(0.5)).toBeCloseTo(3, 6);
	});

	it("steps down with negative ticks", () => {
		const next = computeNext("fader", 0.5, -1, 3, 0);
		expect(faderToDb(next) - faderToDb(0.5)).toBeCloseTo(-3, 6);
	});

	it("steps gain linearly by dB over the assumed range", () => {
		expect(computeNext("gain", 0.5, 1, 6.5, 0)).toBeCloseTo(0.6, 9);
	});

	it("steps fx linearly by the given fraction", () => {
		expect(computeNext("fx", 0.5, 1, 0, 0.02)).toBeCloseTo(0.52, 9);
		expect(computeNext("fx", 0.5, -2, 0, 0.02)).toBeCloseTo(0.46, 9);
	});

	it("clamps everything to 0..1", () => {
		expect(computeNext("gain", 0.99, 5, 6.5, 0)).toBe(1);
		expect(computeNext("fx", 0.01, -5, 0, 0.02)).toBe(0);
		expect(computeNext("fader", 1, 10, 6, 0)).toBeCloseTo(1, 6);
	});
});
