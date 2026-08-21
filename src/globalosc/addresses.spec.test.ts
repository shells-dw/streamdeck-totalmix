import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as g from "./addresses.js";

/**
 * Every address this plugin can emit over Global OSC must exist in RME's
 * protocol table (fixtures/globalosc-spec.json, transcribed from
 * OSCProtocoll_260721.ods). The fixture is the doc; this test is the proof the
 * builders follow it.
 */

interface Param {
	value: string;
	send: boolean;
	rec: boolean;
	lr?: boolean;
}

const spec = JSON.parse(readFileSync("fixtures/globalosc-spec.json", "utf8")) as {
	sections: {
		mix: { params: Record<string, Param> };
		channel: { params: Record<string, Param> };
		reverb: { params: Record<string, Param> };
		echo: { params: Record<string, Param> };
		controlroom: { params: Record<string, Param> };
		durec: { params: Record<string, Param> };
		top: { params: Record<string, Param> };
		numbered: Record<string, { template: string; rec: boolean }>;
	};
};

/** Expands the fixture's templates into a validator for concrete addresses. */
function isInSpec(address: string): boolean {
	const s = spec.sections;
	let m: RegExpExecArray | null;

	if ((m = /^\/mix\/(in|pb)\/\d+\/\d+\/(.+)$/.exec(address)) !== null) {
		return (m[2] ?? "") in s.mix.params;
	}
	if ((m = /^\/(input|playback|output)\/\d+\/(.+)$/.exec(address)) !== null) {
		return (m[2] ?? "") in s.channel.params;
	}
	if ((m = /^\/reverb\/(.+)$/.exec(address)) !== null) return (m[1] ?? "") in s.reverb.params;
	if ((m = /^\/echo\/(.+)$/.exec(address)) !== null) return (m[1] ?? "") in s.echo.params;
	if ((m = /^\/controlroom\/(.+)$/.exec(address)) !== null) return (m[1] ?? "") in s.controlroom.params;
	if ((m = /^\/durec\/(.+)$/.exec(address)) !== null) return (m[1] ?? "") in s.durec.params;
	if (/^\/(mutegroup|sologroup|fadergroup)\/[1-4]$/.test(address)) return true;
	if (/^\/snapshot\/load\/[1-8]$/.test(address)) return true;
	if (/^\/layout\/load\/\d+$/.test(address)) return true;
	if (/^\/sendchan\/(input|playback|output)\/\d+$/.test(address)) return true;
	if (/^\/sendsubmix\/\d+$/.test(address)) return true;
	if (/^\/level\/(in|pb|out)\/\d+$/.test(address)) return true;
	if (/^\/status\/(device|connection|dsp)$/.test(address)) return true;
	const top = /^\/(.+)$/.exec(address);
	if (top !== null) {
		const name = top[1] ?? "";
		if (!name.includes("/")) return name in s.top.params;
	}
	return false;
}

describe("global addresses conform to the Global OSC table", () => {
	const emitted: [string, string][] = [
		// channel level
		["channelFaderlin input 0", g.channelFaderlin("input", 0)],
		["channelFaderlin playback 5", g.channelFaderlin("playback", 5)],
		["channelFaderlin output 2", g.channelFaderlin("output", 2)],
		["channelMute", g.channelMute("input", 3)],
		["channelName", g.channelName("output", 7)],
		["channelGain", g.channelGain(4)],
		["channelStereo", g.channelStereo("input", 0)],
		// nested channel params used by GlobalToggle
		["lowcut enable", g.channel("input", 0, "lowcut/enable")],
		["eq enable", g.channel("playback", 1, "eq/enable")],
		["dynamics enable", g.channel("input", 2, "dynamics/enable")],
		["autolevel enable", g.channel("input", 2, "autolevel/enable")],
		["roomeq enable", g.channel("output", 2, "roomeq/enable")],
		["phase", g.channel("input", 0, "phase")],
		["48v", g.channel("input", 0, "48v")],
		["instrument", g.channel("input", 0, "instrument")],
		["pad", g.channel("input", 0, "pad")],
		["autoset", g.channel("input", 0, "autoset")],
		["msproc", g.channel("input", 0, "msproc")],
		["loopback", g.channel("output", 0, "loopback")],
		["pfl", g.channel("input", 0, "pfl")],
		["record", g.channel("input", 0, "record")],
		// mix nodes
		["mixFaderlin", g.mixFaderlin("in", 0, 2)],
		["mixFaderlin pb", g.mixFaderlin("pb", 3, 4)],
		["mixSolo", g.mixSolo("in", 1, 1)],
		// control room
		["CR_DIM", g.CR_DIM],
		["CR_MAIN_MONO", g.CR_MAIN_MONO],
		["CR_TALKBACK", g.CR_TALKBACK],
		["CR_EXTERNAL_IN", g.CR_EXTERNAL_IN],
		["CR_SPEAKER_B", g.CR_SPEAKER_B],
		["CR_MUTE_FX", g.CR_MUTE_FX],
		["CR_LINK_AB", g.CR_LINK_AB],
		["CR_RECALL", g.CR_RECALL],
		// fx
		["REVERB_ENABLE", g.REVERB_ENABLE],
		["ECHO_ENABLE", g.ECHO_ENABLE],
		// top level
		["GLOBAL_MUTE", g.GLOBAL_MUTE],
		["GLOBAL_SOLO", g.GLOBAL_SOLO],
		["UNDO", g.UNDO],
		["REDO", g.REDO],
		["SHOW_WINDOW", g.SHOW_WINDOW],
		["SEND_ALL", g.SEND_ALL],
		["SEND_SETTINGS", g.SEND_SETTINGS],
		["SEND_STATE", g.SEND_STATE],
		// numbered
		["muteGroup", g.muteGroup(1)],
		["soloGroup", g.soloGroup(2)],
		["faderGroup", g.faderGroup(4)],
		["snapshotLoad", g.snapshotLoad(2)],
		["layoutLoad", g.layoutLoad(3)],
		["sendChan", g.sendChan("input", 2)],
		["sendSubmix", g.sendSubmix(2)],
		["mix fader dB fallback", g.mixNode("in", 0, 2, "fader")],
		["mix fader dB fallback pb", g.mixNode("pb", 1, 0, "fader")],
		// durec
		["DUREC_PLAY", g.DUREC_PLAY],
		["DUREC_PAUSE", g.DUREC_PAUSE],
		["DUREC_STOP", g.DUREC_STOP],
		["DUREC_RECORD", g.DUREC_RECORD],
		["DUREC_NEXT", g.DUREC_NEXT],
		["DUREC_PREVIOUS", g.DUREC_PREVIOUS],
		["DUREC_STATE", g.DUREC_STATE],
		["DUREC_TIME", g.DUREC_TIME],
		// levels and status (read side of the Global Display action)
		["level in", g.level("in", 0)],
		["level pb", g.level("pb", 3)],
		["level out", g.level("out", 2)],
		["level via bus map", g.level(g.levelBusOf("playback"), 1)],
		["STATUS_DEVICE", g.STATUS_DEVICE],
		["STATUS_CONNECTION", g.STATUS_CONNECTION],
		["STATUS_DSP", g.STATUS_DSP],
	];

	for (const [name, address] of emitted) {
		it(`${name} -> ${address}`, () => {
			expect(isInSpec(address), `${address} not found in the Global OSC table`).toBe(true);
		});
	}

	it("matches the table's worked examples verbatim", () => {
		// From the Description sheet's Examples block, character for character.
		expect(g.UNDO).toBe("/undo");
		expect(g.snapshotLoad(2)).toBe("/snapshot/load/2");
		expect(g.controlroom("mainout")).toBe("/controlroom/mainout");
		expect(g.channelFaderlin("output", 2)).toBe("/output/2/faderlin");
		expect(g.durec("pause")).toBe("/durec/pause");
		expect(g.muteGroup(1)).toBe("/mutegroup/1");
		expect(g.mixFaderlin("in", 0, 2)).toBe("/mix/in/0/2/faderlin");
		expect(g.sendChan("input", 2)).toBe("/sendchan/input/2");
	});

	it("marks the group addresses as receive-only, so buttons must self-track", () => {
		const n = spec.sections.numbered as Record<string, { send?: boolean }>;
		expect(n["mutegroup"]?.send).toBe(false);
		expect(n["sologroup"]?.send).toBe(false);
		expect(n["fadergroup"]?.send).toBe(false);
	});
});
