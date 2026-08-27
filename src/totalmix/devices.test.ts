import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	DEVICES,
	FALLBACK_GAIN_DB,
	deviceById,
	detectedDevice,
	gainRangeDb,
	matchDevice,
	rememberDevice,
	detectedMaxGainDb,
	resetDeviceDetection,
} from "./devices.js";

beforeEach(() => resetDeviceDetection());

describe("the device table", () => {
	it("has unique ids", () => {
		const ids = DEVICES.map((d) => d.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("gives every device a positive span", () => {
		for (const d of DEVICES) expect(d.gainDb).toBeGreaterThan(0);
	});

	it("records the figures confirmed against RME documentation", () => {
		expect(deviceById("ucx2")?.gainDb).toBe(75);
		expect(deviceById("ufx2")?.gainDb).toBe(75);
		expect(deviceById("ucx")?.gainDb).toBe(65);
		// The Babyface Pro FS is listed as 76 dB including an 11 dB PAD; its gain
		// control runs 0..65.
		expect(deviceById("bfpro")?.gainDb).toBe(65);
	});
});

describe("matching a /status/device string", () => {
	it.each([
		["Fireface UCX II", "ucx2", 75],
		["Fireface UCX", "ucx", 65],
		["Fireface UFX II", "ufx2", 75],
		["Fireface UFX+", "ufxplus", 75],
		["Fireface UFX", "ufx", 65],
		["Babyface Pro FS", "bfpro", 65],
		["Babyface", "babyface", 60],
		["12Mic-D", "12mic", 75],
	])("resolves %s", (name, id, gain) => {
		const d = matchDevice(name);
		expect(d?.id).toBe(id);
		expect(d?.gainDb).toBe(gain);
	});

	it("prefers the longer name when one contains the other", () => {
		// "ucx" must not claim "Fireface UCX II".
		expect(matchDevice("Fireface UCX II")?.id).toBe("ucx2");
		expect(matchDevice("Fireface UFX II")?.id).toBe("ufx2");
	});

	it("does not let a prefix model swallow a longer one", () => {
		// "fireface uc" is the longer fragment, so length ordering alone is not
		// sufficient; matching stops at a word boundary.
		expect(matchDevice("Fireface UCX II")?.gainDb).toBe(75);
		expect(matchDevice("Fireface UCX")?.gainDb).toBe(65);
		expect(matchDevice("Fireface UC")?.id).toBe("uc");
	});

	it("ignores case and surrounding text", () => {
		expect(matchDevice("RME FIREFACE UCX II (USB)")?.id).toBe("ucx2");
	});

	it("returns nothing for a device it has never met", () => {
		expect(matchDevice("Some Other Interface")).toBeUndefined();
	});
});

describe("detection from Global OSC", () => {
	it("remembers a recognised device", () => {
		rememberDevice("Fireface UCX II");
		expect(detectedDevice()?.id).toBe("ucx2");
	});

	it("reports nothing when it has seen nothing", () => {
		expect(detectedDevice()).toBeUndefined();
	});

	it("logs an unknown device once, not on every status message", () => {
		const warn = vi.fn();
		rememberDevice("Mystery Box 9000", warn);
		rememberDevice("Mystery Box 9000", warn);
		rememberDevice("Mystery Box 9000", warn);

		expect(warn).toHaveBeenCalledOnce();
		expect(warn.mock.calls[0]?.[0]).toContain("Mystery Box 9000");
	});

	it("logs again when a different unknown device appears", () => {
		const warn = vi.fn();
		rememberDevice("Mystery Box 9000", warn);
		rememberDevice("Another Unknown", warn);
		expect(warn).toHaveBeenCalledTimes(2);
	});

	it("ignores an empty status string", () => {
		const warn = vi.fn();
		rememberDevice("   ", warn);
		expect(warn).not.toHaveBeenCalled();
		expect(detectedDevice()).toBeUndefined();
	});

	it("keeps the last known device when an unknown name arrives", () => {
		rememberDevice("Fireface UCX II");
		rememberDevice("Mystery Box 9000");
		expect(detectedDevice()?.id).toBe("ucx2");
	});
});

describe("resolving the span for an action", () => {
	it("uses an explicit pick", () => {
		expect(gainRangeDb("ucx2")).toBe(75);
		expect(gainRangeDb("babyface")).toBe(60);
	});

	it("ignores Global OSC detection entirely", () => {
		// Classic gain must not inherit a device from the Global OSC slot.
		rememberDevice("Fireface UCX II");
		expect(gainRangeDb("")).toBe(FALLBACK_GAIN_DB);
		expect(gainRangeDb(undefined)).toBe(FALLBACK_GAIN_DB);
		expect(gainRangeDb("ucx")).toBe(65);
	});

	it("falls back when a stored id is no longer in the table", () => {
		// An id not present in the table.
		expect(gainRangeDb("some-removed-device")).toBe(FALLBACK_GAIN_DB);
	});
});

describe("the Global OSC gain ceiling", () => {
	it("uses the detected device", () => {
		rememberDevice("Babyface Pro FS");
		expect(detectedMaxGainDb(75)).toBe(65);
	});

	it("keeps the caller's fallback when nothing is detected", () => {
		expect(detectedMaxGainDb(75)).toBe(75);
	});

	it("does not limit an unrecognised device", () => {
		rememberDevice("Mystery Box 9000");
		expect(detectedMaxGainDb(75)).toBe(75);
	});
});
