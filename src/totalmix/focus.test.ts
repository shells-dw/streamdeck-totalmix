import { describe, expect, it } from "vitest";
import {
	ALL_BUSES,
	channelView,
	FOLLOW,
	INPUTS_ONLY,
	OUTPUTS_ONLY,
	resolveBus,
	SOURCES,
} from "./focus.js";

/**
 * Which channel a page-2 or page-4 write lands on comes entirely from the bus,
 * bank start and offset resolved here, so these rules decide whether a button
 * acts on the channel its user named or on whichever one TotalMix last showed.
 */
describe("resolveBus", () => {
	/**
	 * Asserting a bus changes a slot every button shares, so an unconfigured
	 * button never does it on the user's behalf.
	 */
	it("follows the mixer when no bus is set", () => {
		expect(resolveBus({}, ALL_BUSES)).toBe(FOLLOW);
		expect(resolveBus({ bus: "" }, OUTPUTS_ONLY)).toBe(FOLLOW);
	});

	it("keeps a bus the parameter supports", () => {
		expect(resolveBus({ bus: "output" }, ALL_BUSES)).toBe("output");
		expect(resolveBus({ bus: "playback" }, SOURCES)).toBe("playback");
	});

	/**
	 * Changing an existing button's parameter can leave a bus behind that the
	 * new parameter has no state on. Substituting a usable one keeps the button
	 * working rather than leaving it inert on a channel with nothing to control.
	 */
	it("substitutes a usable bus for one the parameter lacks", () => {
		expect(resolveBus({ bus: "output" }, SOURCES)).toBe("input");
		expect(resolveBus({ bus: "playback" }, INPUTS_ONLY)).toBe("input");
		expect(resolveBus({ bus: "input" }, OUTPUTS_ONLY)).toBe("output");
	});

	it("passes the follow setting through unchanged", () => {
		expect(resolveBus({ bus: FOLLOW }, ALL_BUSES)).toBe(FOLLOW);
		expect(resolveBus({ bus: FOLLOW }, OUTPUTS_ONLY)).toBe(FOLLOW);
	});
});

describe("channelView", () => {
	it("turns a fader position into an offset from the bank start", () => {
		expect(channelView({ bus: "output", bankStart: 0, strip: 3 }, ALL_BUSES)).toEqual({
			bus: "output",
			bank: 0,
			offset: 2,
		});
	});

	it("keeps a bank start the user did pin", () => {
		expect(channelView({ bus: "input", bankStart: 0, strip: 1 }, ALL_BUSES)).toEqual({
			bus: "input",
			bank: 0,
			offset: 0,
		});
	});

	it("coerces the strings the property inspector stores", () => {
		expect(channelView({ bus: "playback", bankStart: "8", strip: "4" }, ALL_BUSES)).toEqual({
			bus: "playback",
			bank: 8,
			offset: 3,
		});
	});

	/** A negative offset would address a channel below the bank start. */
	it("never produces a negative offset", () => {
		expect(channelView({ bus: "input", strip: 0 }, ALL_BUSES)?.offset).toBe(0);
	});

	it("substitutes a usable bus rather than addressing a channel that lacks the parameter", () => {
		expect(channelView({ bus: "input", strip: 1 }, OUTPUTS_ONLY)?.bus).toBe("output");
	});

	it("has no slice to name when the button follows the selection", () => {
		expect(channelView({ bus: FOLLOW, strip: 3 }, ALL_BUSES)).toBeNull();
	});

	it("has no slice for a button with no bus chosen", () => {
		expect(channelView({ strip: 2 }, ALL_BUSES)).toBeNull();
	});

	/**
	 * The bank start moves the page-1 bank as well as the page-2 channel, so a
	 * button that did not ask for one must not carry one: the offset is then a
	 * position in whatever bank is shown, exactly as a strip button's is.
	 */
	it("carries no bank start unless the user pinned one", () => {
		expect(channelView({ bus: "output", strip: 3 }, ALL_BUSES)).toEqual({
			bus: "output",
			offset: 2,
		});
	});
});
