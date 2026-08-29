import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	CLEAR_MUTE_BADGE,
	MAIN_MUTE_BADGE,
	washFeedback,
} from "./wash.js";

type Feedback = Record<string, unknown>;

function feedback(mainMute: boolean): Feedback {
	return washFeedback("Main", "-24.0 dB", 52, "none", mainMute) as Feedback;
}

function pngDimensions(path: string): [number, number] {
	const bytes = readFileSync(path);
	expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
	return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

describe("volume feedback Main Out mute badge", () => {
	it("selects the red badge when on and explicitly clears it when off", () => {
		expect(feedback(true).muteIndicator).toBe(MAIN_MUTE_BADGE);
		expect(feedback(false).muteIndicator).toBe(CLEAR_MUTE_BADGE);
		expect((washFeedback("Main", "-24.0 dB", 52, "none") as Feedback).muteIndicator).toBe(
			CLEAR_MUTE_BADGE,
		);
	});

	it("does not move or recolour the value and level bar", () => {
		const on = feedback(true);
		const off = feedback(false);

		expect(on.name).toEqual(off.name);
		expect(on.value).toEqual(off.value);
		expect(on.indicator).toEqual(off.indicator);
	});

	it("keeps the existing centred layout and places the badge left of the dB value", () => {
		const layout = JSON.parse(
			readFileSync("de.shells.totalmixgen2.sdPlugin/layouts/volume.json", "utf8"),
		) as { items: Array<Record<string, unknown>> };
		const item = (key: string): Record<string, unknown> => {
			const found = layout.items.find((entry) => entry.key === key);
			expect(found).toBeDefined();
			return found ?? {};
		};

		expect(item("name").rect).toEqual([8, 6, 184, 20]);
		expect(item("value").rect).toEqual([8, 28, 184, 26]);
		expect(item("value").alignment).toBe("center");
		expect(item("indicator").rect).toEqual([16, 60, 168, 12]);
		expect(item("muteIndicator")).toMatchObject({
			type: "pixmap",
			rect: [16, 31, 22, 22],
			zOrder: 20,
			value: CLEAR_MUTE_BADGE,
		});
	});

	it("ships matching 1x and 2x transparent and red badge resources", () => {
		expect(pngDimensions(`de.shells.totalmixgen2.sdPlugin/${MAIN_MUTE_BADGE}`)).toEqual([
			22, 22,
		]);
		expect(
			pngDimensions("de.shells.totalmixgen2.sdPlugin/imgs/mainMuteBadge@2x.png"),
		).toEqual([44, 44]);
		expect(pngDimensions(`de.shells.totalmixgen2.sdPlugin/${CLEAR_MUTE_BADGE}`)).toEqual([
			22, 22,
		]);
		expect(
			pngDimensions("de.shells.totalmixgen2.sdPlugin/imgs/clearMuteBadge@2x.png"),
		).toEqual([44, 44]);
	});
});
