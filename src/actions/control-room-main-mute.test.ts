import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { OscValue } from "../osc/codec.js";
import * as g from "../globalosc/addresses.js";
import {
	controlRoomMainMuteState,
	resolveControlRoomMainOutputs,
	subscribeControlRoomMainMute,
	toggleControlRoomMainMute,
} from "./control-room-main-mute.js";

type Listener = (value: OscValue) => void;

/** Minimal shared GlobalConnection cache, subscription and write surface. */
class FakeGlobalState {
	private readonly cache = new Map<string, OscValue>();
	private readonly listeners = new Map<string, Set<Listener>>();
	readonly writes: Array<{ address: string; value: number }> = [];

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

	set(address: string, value: number): void {
		this.writes.push({ address, value });
		this.emit(address, value);
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

function expectWrites(source: FakeGlobalState, value: 0 | 1, main = MAIN, mainB = MAIN_B): void {
	expect(source.writes).toEqual([
		{ address: g.channelMute("output", main), value },
		{ address: g.channelMute("output", mainB), value },
	]);
}

describe("ARC-style Control Room Mute Main Out", () => {
	it("turns both outputs on when Main and Main B are off", () => {
		const source = state(0, 0);

		expect(toggleControlRoomMainMute(source)).toBe(true);
		expectWrites(source, 1);
	});

	it("turns both outputs off when Main and Main B are on", () => {
		const source = state(1, 1);

		expect(toggleControlRoomMainMute(source)).toBe(false);
		expectWrites(source, 0);
	});

	it("shows on from Main alone and turns both off when Main B is already off", () => {
		const source = state(1, 0);

		expect(controlRoomMainMuteState(source)).toBe(true);
		expect(toggleControlRoomMainMute(source)).toBe(false);
		expectWrites(source, 0);
	});

	it("shows off from Main alone and turns both on when Main B is already on", () => {
		const source = state(0, 1);

		expect(controlRoomMainMuteState(source)).toBe(false);
		expect(toggleControlRoomMainMute(source)).toBe(true);
		expectWrites(source, 1);
	});

	it("ignores Speaker B state for display and writes", () => {
		const speakerBOff = state(0, 1, 0);
		const speakerBOn = state(0, 1, 1);

		expect(controlRoomMainMuteState(speakerBOff)).toBe(false);
		expect(controlRoomMainMuteState(speakerBOn)).toBe(false);
		expect(toggleControlRoomMainMute(speakerBOff)).toBe(true);
		expect(toggleControlRoomMainMute(speakerBOn)).toBe(true);
		expect(speakerBOff.writes).toEqual(speakerBOn.writes);
	});

	it("uses new Main and Main B outputs after assignments change", () => {
		const source = state(1, 0);
		const states: Array<boolean | undefined> = [];
		const unsubscribe = subscribeControlRoomMainMute(source, (muted) => states.push(muted));

		expect(source.listenerCount(mainMute)).toBe(1);
		source.put(g.channelMute("output", 8), 0);
		source.put(g.channelMute("output", 10), 1);
		source.emit(g.CR_MAINOUT, 8);
		source.emit(g.CR_MAINOUT_B, 10);

		expect(source.listenerCount(mainMute)).toBe(0);
		expect(source.listenerCount(g.channelMute("output", 8))).toBe(1);
		expect(controlRoomMainMuteState(source)).toBe(false);
		expect(toggleControlRoomMainMute(source)).toBe(true);
		expectWrites(source, 1, 8, 10);
		expect(states.at(-1)).toBe(true);

		unsubscribe();
		expect(source.listenerCount(g.CR_MAINOUT)).toBe(0);
		expect(source.listenerCount(g.CR_MAINOUT_B)).toBe(0);
		expect(source.listenerCount(g.channelMute("output", 8))).toBe(0);
	});

	it("subscribes only to assignments and Main mute for display state", () => {
		const source = state(1, 0, 1);
		const states: Array<boolean | undefined> = [];
		const unsubscribe = subscribeControlRoomMainMute(source, (muted) => states.push(muted));

		expect(states).toEqual([true]);
		expect(source.listenerCount(g.CR_MAINOUT)).toBe(1);
		expect(source.listenerCount(g.CR_MAINOUT_B)).toBe(1);
		expect(source.listenerCount(mainMute)).toBe(1);
		expect(source.listenerCount(mainBMute)).toBe(0);
		expect(source.listenerCount(g.CR_SPEAKER_B)).toBe(0);

		source.emit(mainBMute, 1);
		source.emit(g.CR_SPEAKER_B, 0);
		expect(states).toEqual([true]);

		source.emit(mainMute, 0);
		expect(states).toEqual([true, false]);
		unsubscribe();
	});

	it("waits for both assignments and Main mute instead of guessing", () => {
		const source = new FakeGlobalState();
		source.put(g.CR_MAINOUT, MAIN);
		source.put(mainMute, 0);

		expect(resolveControlRoomMainOutputs(source)).toBeUndefined();
		expect(toggleControlRoomMainMute(source)).toBeUndefined();
		expect(source.writes).toEqual([]);
	});

	it("is wired through the same helper in Volume gestures and Toggle", () => {
		const volume = readFileSync("src/actions/global-volume.ts", "utf8");
		const toggle = readFileSync("src/actions/global-toggle.ts", "utf8");

		expect(volume).toContain("toggleControlRoomMainMute(gm)");
		expect(toggle).toContain("toggleControlRoomMainMute(gm)");
		expect(toggle).toContain("controlRoomMainMuteState(gm)");
		expect(toggle).toContain("subscribeControlRoomMainMute(gm");
	});

	it("keeps This dial -> Mute on its existing fader-silence path", () => {
		const volume = readFileSync("src/actions/global-volume.ts", "utf8");
		const existingMute = volume.slice(volume.indexOf('case "mute":'), volume.indexOf('case "solo":'));

		expect(existingMute).toContain('target === "main" || target === "activeMonitor"');
		expect(existingMute).toContain("this.toggleSilence(gm, settings)");
		expect(existingMute).toContain('flipChannel("mute")');
		expect(existingMute).not.toContain("toggleControlRoomMainMute");
	});

	it("appears in both Volume gesture lists and the Toggle Control Room list", () => {
		const volumeInspector = readFileSync(
			"de.shells.totalmixgen2.sdPlugin/ui/global-volume.html",
			"utf8",
		);
		const toggleInspector = readFileSync(
			"de.shells.totalmixgen2.sdPlugin/ui/global-toggle.html",
			"utf8",
		);
		const option = '<option value="muteMainOut">Mute Main Out</option>';

		expect(volumeInspector.split(option)).toHaveLength(3);
		expect(toggleInspector.split(option)).toHaveLength(2);
	});
});
