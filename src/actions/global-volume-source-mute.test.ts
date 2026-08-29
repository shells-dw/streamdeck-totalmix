import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	mixSourceMuteAddress,
	usesMixSourceMuteGesture,
} from "./global-volume-source-mute.js";

describe("Global Volume mix-node source mute", () => {
	it("resolves an input source channel's real mute address", () => {
		expect(mixSourceMuteAddress({ target: "mixNode", mixSrcBus: "in", mixSrc: 2 })).toBe(
			"/input/2/mute",
		);
	});

	it("resolves a playback source channel's real mute address", () => {
		expect(mixSourceMuteAddress({ target: "mixNode", mixSrcBus: "pb", mixSrc: "5" })).toBe(
			"/playback/5/mute",
		);
	});

	it("does not resolve a source mute for other targets", () => {
		expect(mixSourceMuteAddress({ target: "channel", mixSrcBus: "in", mixSrc: 2 })).toBeUndefined();
		expect(mixSourceMuteAddress({ target: "mixPan", mixSrcBus: "pb", mixSrc: 2 })).toBeUndefined();
	});

	it("enables feedback from either gesture slot without changing the infinity gesture", () => {
		expect(usesMixSourceMuteGesture({ target: "mixNode", press: "muteSource" })).toBe(true);
		expect(usesMixSourceMuteGesture({ target: "mixNode", touch: "muteSource" })).toBe(true);
		expect(usesMixSourceMuteGesture({ target: "mixNode", touch: "infinity" })).toBe(false);
		expect(usesMixSourceMuteGesture({ target: "channel", press: "muteSource" })).toBe(false);
	});

	it("is offered in both gesture menus and wired to toggle and feedback paths", () => {
		const inspector = readFileSync(
			"de.shells.totalmixgen2.sdPlugin/ui/global-volume.html",
			"utf8",
		);
		const source = readFileSync("src/actions/global-volume.ts", "utf8");
		const option = '<option value="muteSource" data-kinds="mixNode">Mute source channel</option>';

		expect(inspector.split(option)).toHaveLength(3);
		expect(source).toContain('case "muteSource":');
		expect(source).toContain("gm.toggleSet(muteAddress)");
		expect(source).toContain("usesMixSourceMuteGesture(settings)");
		expect(source).toContain("asBool(gm.get(sourceMuteAddress) ?? 0)");
	});
});
