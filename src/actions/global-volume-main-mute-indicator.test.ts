import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { OscValue } from "../osc/codec.js";
import * as g from "../globalosc/addresses.js";
import {
	mainMuteIndicatorOn,
	subscribeMainMuteIndicator,
	usesMainMuteIndicator,
	type MainMuteIndicatorSettings,
} from "./global-volume-main-mute-indicator.js";

type Listener = (value: OscValue) => void;

class FakeGlobalState {
	private readonly cache = new Map<string, OscValue>();
	private readonly listeners = new Map<string, Set<Listener>>();

	put(address: string, value: OscValue): void {
		this.cache.set(address, value);
	}

	emit(address: string, value: OscValue): void {
		this.cache.set(address, value);
		for (const listener of [...(this.listeners.get(address) ?? [])]) listener(value);
	}

	get(address: string): OscValue | undefined {
		return this.cache.get(address);
	}

	subscribe(address: string, listener: Listener): () => void {
		let current = this.listeners.get(address);
		if (current === undefined) {
			current = new Set();
			this.listeners.set(address, current);
		}
		current.add(listener);
		return () => {
			const listeners = this.listeners.get(address);
			listeners?.delete(listener);
			if (listeners?.size === 0) this.listeners.delete(address);
		};
	}

	listenerCount(address: string): number {
		return this.listeners.get(address)?.size ?? 0;
	}
}

const MAIN = 2;
const MAIN_B = 6;
const mainMute = g.channelMute("output", MAIN);
const mainBMute = g.channelMute("output", MAIN_B);

function state(main: 0 | 1, mainB: 0 | 1, speakerB: 0 | 1 = 0): FakeGlobalState {
	const result = new FakeGlobalState();
	result.put(g.CR_MAINOUT, MAIN);
	result.put(g.CR_MAINOUT_B, MAIN_B);
	result.put(g.CR_SPEAKER_B, speakerB);
	result.put(mainMute, main);
	result.put(mainBMute, mainB);
	return result;
}

const press: MainMuteIndicatorSettings = {
	target: "activeMonitor",
	press: "muteMainOut",
	touch: "dim",
};

const touch: MainMuteIndicatorSettings = {
	target: "activeMonitor",
	press: "mute",
	touch: "muteMainOut",
};

describe("Active Monitor Main Out mute indicator", () => {
	it("is enabled by Mute Main Out on either press or touch", () => {
		expect(usesMainMuteIndicator(press)).toBe(true);
		expect(usesMainMuteIndicator(touch)).toBe(true);
		expect(
			usesMainMuteIndicator({
				target: "activeMonitor",
				press: "muteMainOut",
				touch: "muteMainOut",
			}),
		).toBe(true);
	});

	it("is disabled for Main Out and every non-Active-Monitor target", () => {
		for (const target of ["main", "channel", "gain", "mixNode", "pan", "mixPan"] as const) {
			expect(usesMainMuteIndicator({ target, press: "muteMainOut" })).toBe(false);
		}
	});

	it("is disabled for Active Monitor's existing This dial -> Mute gesture", () => {
		expect(
			usesMainMuteIndicator({ target: "activeMonitor", press: "mute", touch: "dim" }),
		).toBe(false);
	});

	it("shows only Main Out mute and hides when disconnected", () => {
		expect(mainMuteIndicatorOn(press, state(1, 1), true)).toBe(true);
		expect(mainMuteIndicatorOn(press, state(1, 0), true)).toBe(true);
		expect(mainMuteIndicatorOn(press, state(0, 1), true)).toBe(false);
		expect(mainMuteIndicatorOn(press, state(1, 0), false)).toBe(false);
	});

	it("ignores Speaker B and Main Out B mute changes", () => {
		const source = state(1, 0, 0);
		const shown: boolean[] = [];
		const unsubscribe = subscribeMainMuteIndicator(press, source, (on) => shown.push(on));

		expect(shown).toEqual([true]);
		source.emit(g.CR_SPEAKER_B, 1);
		source.emit(mainBMute, 1);
		expect(shown).toEqual([true]);
		expect(mainMuteIndicatorOn(press, source, true)).toBe(true);
		unsubscribe();
	});

	it("retargets to a new Main Out assignment and releases the old mute subscription", () => {
		const source = state(1, 0);
		const shown: boolean[] = [];
		const unsubscribe = subscribeMainMuteIndicator(press, source, (on) => shown.push(on));
		const nextMute = g.channelMute("output", 8);
		source.put(nextMute, 0);

		source.emit(g.CR_MAINOUT, 8);

		expect(shown.at(-1)).toBe(false);
		expect(source.listenerCount(mainMute)).toBe(0);
		expect(source.listenerCount(nextMute)).toBe(1);
		source.emit(nextMute, 1);
		expect(shown.at(-1)).toBe(true);

		unsubscribe();
		expect(source.listenerCount(g.CR_MAINOUT)).toBe(0);
		expect(source.listenerCount(g.CR_MAINOUT_B)).toBe(0);
		expect(source.listenerCount(nextMute)).toBe(0);
	});

	it("creates one subscription when both gesture slots use Mute Main Out", () => {
		const source = state(1, 1);
		const unsubscribe = subscribeMainMuteIndicator(
			{ target: "activeMonitor", press: "muteMainOut", touch: "muteMainOut" },
			source,
			() => {},
		);

		expect(source.listenerCount(g.CR_MAINOUT)).toBe(1);
		expect(source.listenerCount(g.CR_MAINOUT_B)).toBe(1);
		expect(source.listenerCount(mainMute)).toBe(1);
		expect(source.listenerCount(mainBMute)).toBe(0);
		expect(source.listenerCount(g.CR_SPEAKER_B)).toBe(0);
		unsubscribe();
	});

	it("does not subscribe for inapplicable settings", () => {
		const source = state(1, 1);
		const unsubscribe = subscribeMainMuteIndicator(
			{ target: "main", press: "muteMainOut" },
			source,
			() => {},
		);

		expect(source.listenerCount(g.CR_MAINOUT)).toBe(0);
		expect(source.listenerCount(mainMute)).toBe(0);
		unsubscribe();
	});

	it("is integrated once into Global Volume setup and render", () => {
		const source = readFileSync("src/actions/global-volume.ts", "utf8");
		const setupCall = "unsubs.push(subscribeMainMuteIndicator(settings, gm, render))";

		expect(source).toContain("target.isDial() && usesMainMuteIndicator(settings)");
		expect(source.split(setupCall)).toHaveLength(2);
		expect(source).toContain("mainMuteIndicatorOn(settings, gm, gm.connected)");
		expect(source).toContain(
			'const mute = wash === "mute" || mainMuteIndicatorOn(settings, gm, gm.connected)',
		);
		expect(source).toContain(
			'washFeedback(this.labelFor(gm, settings), "—", 0, "none", mainMute)',
		);
		expect(source).toContain("this.releaseFor(target.id)");
	});
});
