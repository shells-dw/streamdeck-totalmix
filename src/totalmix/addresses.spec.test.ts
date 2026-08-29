import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as addr from "./addresses.js";

/**
 * Every address this plugin can emit must exist in RME's official OSC table
 * (fixtures/osc-spec.json).
 */
describe("addresses conform to the RME spec", () => {
	const spec = JSON.parse(readFileSync("fixtures/osc-spec.json", "utf8")) as {
		pages: Record<string, { entries: { address: string }[] }>;
	};

	const valid = new Set<string>();
	for (const page of Object.values(spec.pages)) {
		for (const e of page.entries) valid.add(e.address);
	}
	// The table compresses runs like "volume9 to volume 24"; expand the grids.
	for (let i = 1; i <= 24; i++) {
		valid.add(`/1/volume${i}`);
		valid.add(`/1/pan${i}`);
		valid.add(`/1/trackname${i}`);
		for (const g of ["mute", "solo", "phantom", "cue", "select"]) valid.add(`/1/${g}/1/${i}`);
		valid.add(`/1/micgain${i}`);
	}

	// Page-independent selectors are documented outside the page tables.
	const pageless = new Set([
		addr.SET_SUBMIX,
		addr.SET_BANK_START,
		addr.SET_OFFSET_IN_BANK,
		addr.LOAD_QUICK_WORKSPACE,
	]);

	const emitted: [string, string][] = [
		["MAIN_VOLUME", addr.MAIN_VOLUME],
		["MAIN_DIM", addr.MAIN_DIM],
		["MAIN_MONO", addr.MAIN_MONO],
		["MAIN_RECALL", addr.MAIN_RECALL],
		["MAIN_MUTE_FX", addr.MAIN_MUTE_FX],
		["MAIN_EXT_IN", addr.MAIN_EXT_IN],
		["MAIN_TALKBACK", addr.MAIN_TALKBACK],
		["MAIN_SPEAKER_B", addr.MAIN_SPEAKER_B],
		["SPEAKER_B_LINKED", addr.SPEAKER_B_LINKED],
		["GLOBAL_MUTE", addr.GLOBAL_MUTE],
		["GLOBAL_SOLO", addr.GLOBAL_SOLO],
		["TRIM", addr.TRIM],
		["TRACK_NEXT", addr.TRACK_NEXT],
		["TRACK_PREV", addr.TRACK_PREV],
		["BANK_NEXT", addr.BANK_NEXT],
		["BANK_PREV", addr.BANK_PREV],
		["LABEL_SUBMIX", addr.LABEL_SUBMIX],
		["bus(input)", addr.bus("input")],
		["bus(playback)", addr.bus("playback")],
		["bus(output)", addr.bus("output")],
		["busPage2(input)", addr.busPage2("input")],
		["busPage2(playback)", addr.busPage2("playback")],
		["busPage2(output)", addr.busPage2("output")],
		["volume(3)", addr.volume(3)],
		["pan(3)", addr.pan(3)],
		["mute(3)", addr.mute(3)],
		["solo(3)", addr.solo(3)],
		["phantom(3)", addr.phantom(3)],
		["cue(3)", addr.cue(3)],
		["trackName(3)", addr.trackName(3)],
		["micGain(3)", addr.micGain(3)],
		["CH_VOLUME", addr.CH_VOLUME],
		["CH_PAN", addr.CH_PAN],
		["CH_MUTE", addr.CH_MUTE],
		["CH_SOLO", addr.CH_SOLO],
		["CH_PHANTOM", addr.CH_PHANTOM],
		["CH_INSTRUMENT", addr.CH_INSTRUMENT],
		["CH_PAD", addr.CH_PAD],
		["CH_PHASE", addr.CH_PHASE],
		["CH_STEREO", addr.CH_STEREO],
		["CH_LOOPBACK", addr.CH_LOOPBACK],
		["CH_CUE", addr.CH_CUE],
		["CH_EQ_ENABLE", addr.CH_EQ_ENABLE],
		["CH_LOWCUT_ENABLE", addr.CH_LOWCUT_ENABLE],
		["CH_COMP_ENABLE", addr.CH_COMP_ENABLE],
		["CH_AUTOLEVEL_ENABLE", addr.CH_AUTOLEVEL_ENABLE],
		["CH_REVERB_SEND", addr.CH_REVERB_SEND],
		["CH_RECORD_ENABLE", addr.CH_RECORD_ENABLE],
		["CH_TRACK_NAME", addr.CH_TRACK_NAME],
		["muteGroup(1)", addr.muteGroup(1)],
		["muteGroup(4)", addr.muteGroup(4)],
		["soloGroup(2)", addr.soloGroup(2)],
		["faderGroup(3)", addr.faderGroup(3)],
		["snapshot(1)", addr.snapshot(1)],
		["snapshot(8)", addr.snapshot(8)],
		["REVERB_ENABLE", addr.REVERB_ENABLE],
		["ECHO_ENABLE", addr.ECHO_ENABLE],
		["UNDO", addr.UNDO],
		["REDO", addr.REDO],
		["RECORD_START", addr.RECORD_START],
		["RECORD_PLAY_PAUSE", addr.RECORD_PLAY_PAUSE],
		["RECORD_STOP", addr.RECORD_STOP],
		["ROOM_EQ_ENABLE", addr.ROOM_EQ_ENABLE],
		["REVERB_VOLUME", addr.REVERB_VOLUME],
		["REVERB_TIME", addr.REVERB_TIME],
		["REVERB_PREDELAY", addr.REVERB_PREDELAY],
		["REVERB_WIDTH", addr.REVERB_WIDTH],
		["ECHO_VOLUME", addr.ECHO_VOLUME],
		["ECHO_DELAY", addr.ECHO_DELAY],
		["ECHO_FEEDBACK", addr.ECHO_FEEDBACK],
		["CH_REVERB_RETURN", addr.CH_REVERB_RETURN],
		["CH_LOWCUT_FREQ", addr.CH_LOWCUT_FREQ],
		["REVERB_LOWCUT", addr.REVERB_LOWCUT],
		["REVERB_HIGHCUT", addr.REVERB_HIGHCUT],
		["REVERB_ROOMSCALE", addr.REVERB_ROOMSCALE],
		["REVERB_SMOOTH", addr.REVERB_SMOOTH],
		["REVERB_HIGHDAMP", addr.REVERB_HIGHDAMP],
		["REVERB_ATTACK", addr.REVERB_ATTACK],
		["REVERB_HOLD", addr.REVERB_HOLD],
		["REVERB_RELEASE", addr.REVERB_RELEASE],
		["ECHO_WIDTH", addr.ECHO_WIDTH],
		["CH_COMP_GAIN", addr.CH_COMP_GAIN],
		["CH_COMP_ATTACK", addr.CH_COMP_ATTACK],
		["CH_COMP_RELEASE", addr.CH_COMP_RELEASE],
		["CH_COMP_THRESHOLD", addr.CH_COMP_THRESHOLD],
		["CH_COMP_RATIO", addr.CH_COMP_RATIO],
		["CH_EXP_THRESHOLD", addr.CH_EXP_THRESHOLD],
		["CH_EXP_RATIO", addr.CH_EXP_RATIO],
		["CH_AUTOLEVEL_ENABLE", addr.CH_AUTOLEVEL_ENABLE],
		["CH_AUTOLEVEL_MAXGAIN", addr.CH_AUTOLEVEL_MAXGAIN],
		["CH_AUTOLEVEL_HEADROOM", addr.CH_AUTOLEVEL_HEADROOM],
		["CH_AUTOLEVEL_RISETIME", addr.CH_AUTOLEVEL_RISETIME],
		["CH_EQ_TYPE1", addr.CH_EQ_TYPE1],
		["CH_EQ_GAIN1", addr.CH_EQ_GAIN1],
		["CH_EQ_FREQ1", addr.CH_EQ_FREQ1],
		["CH_EQ_Q1", addr.CH_EQ_Q1],
		["CH_EQ_GAIN2", addr.CH_EQ_GAIN2],
		["CH_EQ_FREQ2", addr.CH_EQ_FREQ2],
		["CH_EQ_Q2", addr.CH_EQ_Q2],
		["CH_EQ_TYPE3", addr.CH_EQ_TYPE3],
		["CH_EQ_GAIN3", addr.CH_EQ_GAIN3],
		["CH_EQ_FREQ3", addr.CH_EQ_FREQ3],
		["CH_EQ_Q3", addr.CH_EQ_Q3],
		["CH_LOWCUT_GRADE", addr.CH_LOWCUT_GRADE],
		["CH_PHASE_RIGHT", addr.CH_PHASE_RIGHT],
		["CH_TALKBACK_SEL", addr.CH_TALKBACK_SEL],
		["CH_NO_TRIM", addr.CH_NO_TRIM],
		["CH_MS_PROC", addr.CH_MS_PROC],
		["CH_AUTOSET", addr.CH_AUTOSET],
		["RECORD_TIME", addr.RECORD_TIME],
		["RECORD_STATE", addr.RECORD_STATE],
		["ROOM_EQ_TRACK_NAME", addr.ROOM_EQ_TRACK_NAME],
		["ROOM_EQ_LEFT", addr.ROOM_EQ_LEFT],
		["ROOM_EQ_RIGHT", addr.ROOM_EQ_RIGHT],
		["ROOM_EQ_DELAY", addr.ROOM_EQ_DELAY],
		["ROOM_EQ_VOLUME_CORR", addr.ROOM_EQ_VOLUME_CORR],
		["roomEqType(1)", addr.roomEqType(1)],
		["roomEqType(8)", addr.roomEqType(8)],
		["roomEqType(9)", addr.roomEqType(9)],
		...([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).flatMap((n): [string, string][] => [
			[`roomEqGain(${n})`, addr.roomEqGain(n)],
			[`roomEqFreq(${n})`, addr.roomEqFreq(n)],
			[`roomEqQ(${n})`, addr.roomEqQ(n)],
		]),
	];

	it.each(emitted)("%s -> %s exists in the RME table", (_name, address) => {
		expect(pageless.has(address) || valid.has(address), `${address} not in spec`).toBe(true);
	});
});

describe("group and snapshot indices", () => {
	it("reverses the grid index", () => {
		expect(addr.muteGroup(1)).toBe("/3/muteGroups/4/1");
		expect(addr.faderGroup(4)).toBe("/3/faderGroups/1/1");
		expect(addr.snapshot(1)).toBe("/3/snapshots/8/1");
		expect(addr.snapshot(8)).toBe("/3/snapshots/1/1");
	});

	it("clamps out-of-range numbers to the table's ranges", () => {
		expect(addr.muteGroup(0)).toBe(addr.muteGroup(1));
		expect(addr.soloGroup(9)).toBe(addr.soloGroup(4));
		expect(addr.snapshot(0)).toBe(addr.snapshot(1));
		expect(addr.snapshot(12)).toBe(addr.snapshot(8));
	});
});

describe("pageOf", () => {
	it("reads the page out of the address", () => {
		expect(addr.pageOf("/1/volume1")).toBe(1);
		expect(addr.pageOf("/2/lowcutEnable")).toBe(2);
		expect(addr.pageOf("/3/reverbEnable")).toBe(3);
		expect(addr.pageOf("/4/roomEqEnable")).toBe(4);
	});

	it("puts every snapshot on page 3", () => {
		for (let n = 1; n <= 8; n++) expect(addr.pageOf(addr.snapshot(n))).toBe(3);
	});

	it("puts groups on page 3 and strip parameters on page 1", () => {
		expect(addr.pageOf(addr.muteGroup(1))).toBe(3);
		expect(addr.pageOf(addr.soloGroup(4))).toBe(3);
		expect(addr.pageOf(addr.mute(1))).toBe(1);
		expect(addr.pageOf(addr.solo(8))).toBe(1);
	});

	it("defaults to page 1 for anything unrecognised", () => {
		// Unrecognised address shapes fall back to page 1.
		expect(addr.pageOf("/setBankStart")).toBe(1);
		expect(addr.pageOf("")).toBe(1);
	});
});
