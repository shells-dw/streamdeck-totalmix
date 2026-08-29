import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { OscValue } from "../osc/codec.js";
import * as g from "../globalosc/addresses.js";
import {
	controlRoomDependencies,
	resolveControlRoomOutput,
	subscribeControlRoomOutput,
	type ControlRoomVolumeTarget,
} from "./global-volume-target.js";

type Listener = (value: OscValue) => void;

/** Minimal view of the shared GlobalConnection cache and subscriptions. */
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

function state(speakerB: 0 | 1): FakeGlobalState {
	const result = new FakeGlobalState();
	result.put(g.CR_MAINOUT, 2);
	result.put(g.CR_MAINOUT_B, 6);
	result.put(g.CR_SPEAKER_B, speakerB);
	return result;
}

function faderAddress(target: ControlRoomVolumeTarget, source: FakeGlobalState): string | undefined {
	const output = resolveControlRoomOutput(target, source);
	return output === undefined ? undefined : g.channelFaderlin("output", output);
}

describe("Global OSC active monitor target", () => {
	it("is available in the Volume (TotalMix 2.1+) Target dropdown", () => {
		const inspector = readFileSync(
			"de.shells.totalmixgen2.sdPlugin/ui/global-volume.html",
			"utf8",
		);
		expect(inspector).toContain(
			'<option value="activeMonitor">Active Monitor (Main / Speaker B)</option>',
		);
	});

	it("Speaker B OFF resolves the output assigned to Main Out", () => {
		expect(faderAddress("activeMonitor", state(0))).toBe("/output/2/faderlin");
	});

	it("Speaker B ON resolves the output assigned to Main Out B", () => {
		expect(faderAddress("activeMonitor", state(1))).toBe("/output/6/faderlin");
	});

	it("follows OFF -> ON -> OFF changes received through the shared state subscription", () => {
		const source = state(0);
		const outputs: Array<number | undefined> = [];
		const unsubscribe = subscribeControlRoomOutput("activeMonitor", source, (output) =>
			outputs.push(output),
		);

		source.emit(g.CR_SPEAKER_B, 1);
		source.emit(g.CR_SPEAKER_B, 0);

		expect(outputs).toEqual([6, 2]);
		unsubscribe();
		for (const address of controlRoomDependencies("activeMonitor")) {
			expect(source.listenerCount(address)).toBe(0);
		}
	});

	it("follows a Main Out B assignment change while Speaker B is on", () => {
		const source = state(1);
		const outputs: Array<number | undefined> = [];
		subscribeControlRoomOutput("activeMonitor", source, (output) => outputs.push(output));

		source.emit(g.CR_MAINOUT_B, 8);

		expect(outputs).toEqual([8]);
		expect(faderAddress("activeMonitor", source)).toBe("/output/8/faderlin");
	});

	it("follows a Main Out assignment change while Speaker B is off", () => {
		const source = state(0);
		const outputs: Array<number | undefined> = [];
		subscribeControlRoomOutput("activeMonitor", source, (output) => outputs.push(output));

		source.emit(g.CR_MAINOUT, 4);

		expect(outputs).toEqual([4]);
		expect(faderAddress("activeMonitor", source)).toBe("/output/4/faderlin");
	});

	it("keeps Main Out (Control Room) dependent only on Main Out", () => {
		const source = state(0);
		const outputs: Array<number | undefined> = [];
		subscribeControlRoomOutput("main", source, (output) => outputs.push(output));

		expect(controlRoomDependencies("main")).toEqual([g.CR_MAINOUT]);
		expect(source.listenerCount(g.CR_SPEAKER_B)).toBe(0);
		expect(source.listenerCount(g.CR_MAINOUT_B)).toBe(0);

		source.emit(g.CR_SPEAKER_B, 1);
		source.emit(g.CR_MAINOUT_B, 8);
		expect(faderAddress("main", source)).toBe("/output/2/faderlin");
		expect(outputs).toEqual([]);

		source.emit(g.CR_MAINOUT, 4);
		expect(outputs).toEqual([4]);
		expect(faderAddress("main", source)).toBe("/output/4/faderlin");
	});

	it("waits for Speaker B state instead of guessing the active monitor", () => {
		const source = new FakeGlobalState();
		source.put(g.CR_MAINOUT, 2);
		source.put(g.CR_MAINOUT_B, 6);

		expect(resolveControlRoomOutput("activeMonitor", source)).toBeUndefined();
	});
});
