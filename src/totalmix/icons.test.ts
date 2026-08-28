import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACTION_ICONS, iconFor, nudgeIcon } from "./icons.js";

const ROOT = "de.shells.totalmixgen2.sdPlugin";
const resolves = (path: string): boolean =>
	existsSync(`${ROOT}/${path}.svg`) || existsSync(`${ROOT}/${path}.png`);

describe("action icons", () => {
	/** A missing file leaves the key blank at runtime with no error. */
	it("resolves every icon it can hand out", () => {
		for (const path of Object.values(ACTION_ICONS)) {
			expect(resolves(path), path).toBe(true);
		}
	});

	it("points a nudge key the way the press moves the value", () => {
		expect(nudgeIcon("up")).toBe(ACTION_ICONS.volumeRaise);
		expect(nudgeIcon("down")).toBe(ACTION_ICONS.volumeLower);
		// Up is the default, matching the property inspector.
		expect(nudgeIcon(undefined)).toBe(ACTION_ICONS.volumeRaise);
	});

	/** Stereo and mono must not look alike, or the button reports nothing. */
	it("gives the stereo toggle a distinct icon per state", () => {
		const stereo = iconFor("channelStereo");
		expect(stereo.on).not.toBe(stereo.off);
		expect(resolves(stereo.on)).toBe(true);
		expect(resolves(stereo.off)).toBe(true);
	});
});
