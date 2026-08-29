import { describe, expect, it } from "vitest";
import {
	CLASSIC,
	GESTURE_LABELS,
	GLOBAL,
	GLOBAL_FX,
	defaultGesture,
	resolveGesture,
	type ClassicKind,
	type Gesture,
	type GlobalFxKind,
	type GlobalKind,
	type Vocabulary,
} from "./gestures.js";

describe("classic defaults", () => {
	it("presses to mute everywhere a mute exists", () => {
		for (const kind of ["main", "strip", "channel", "gain", "pan"] as const) {
			expect(defaultGesture(kind, "press", CLASSIC)).toBe("mute");
		}
	});

	it("presses to bypass on an FX parameter, which has no mute", () => {
		expect(defaultGesture("fx", "press", CLASSIC)).toBe("bypass");
	});

	it("taps to dim on the main out, since that is the gesture it has", () => {
		expect(defaultGesture("main", "touch", CLASSIC)).toBe("dim");
	});

	it("taps to -oo on the level targets, leaving the mute state alone", () => {
		for (const kind of ["strip", "channel", "gain"] as const) {
			expect(defaultGesture(kind, "touch", CLASSIC)).toBe("infinity");
		}
	});

	it("taps to centre on a pan, which is its neutral rather than -oo", () => {
		expect(defaultGesture("pan", "touch", CLASSIC)).toBe("center");
	});

	/**
	 * An effect parameter's bottom is rarely where anyone wants it back: a low
	 * cut at 20 Hz or an EQ gain at full cut is not a resting position, so the
	 * tap returns it to neutral instead.
	 */
	it("taps back to neutral on an effect parameter", () => {
		expect(defaultGesture("fx", "touch", CLASSIC)).toBe("neutral");
	});
});

describe("Global OSC effect parameter gestures", () => {
	/**
	 * Before this vocabulary existed both gestures switched the section, which
	 * left the touch strip doing nothing the press did not already do.
	 */
	it("presses to bypass and taps to park at neutral", () => {
		expect(defaultGesture("fx", "press", GLOBAL_FX)).toBe("bypass");
		expect(defaultGesture("fx", "touch", GLOBAL_FX)).toBe("neutralToggle");
	});

	it("falls back to bypass on a parameter with no neutral", () => {
		expect(defaultGesture("fxPlain", "touch", GLOBAL_FX)).toBe("bypass");
		expect(resolveGesture("neutralToggle", "fxPlain", "press", GLOBAL_FX)).toBe("bypass");
	});

	it("keeps the neutral toggle on parameters that have a neutral", () => {
		expect(resolveGesture("neutralToggle", "fx", "press", GLOBAL_FX)).toBe("neutralToggle");
	});

	/** The plain reset is the toggle's first press, so it is not offered twice. */
	it("offers no separate plain neutral", () => {
		expect(GLOBAL_FX.applies.neutral).toBeUndefined();
		expect(resolveGesture("neutral", "fx", "touch", GLOBAL_FX)).toBe("neutralToggle");
	});

	it("offers the control room and global switches on both kinds", () => {
		for (const kind of ["fx", "fxPlain"] as const satisfies readonly GlobalFxKind[]) {
			for (const gesture of ["dim", "mono", "talkback", "recall", "globalMute"] as const) {
				expect(resolveGesture(gesture, kind, "press", GLOBAL_FX)).toBe(gesture);
			}
		}
	});
});

describe("Global OSC defaults", () => {
	it("presses to mute on a channel, gain and either control-room output target", () => {
		for (const kind of ["main", "activeMonitor", "channel", "gain"] as const) {
			expect(defaultGesture(kind, "press", GLOBAL)).toBe("mute");
		}
	});

	it("presses to solo on a mix node, which has no mute of its own", () => {
		// A node is a send: pulling it down is the mute, so solo is the switch.
		expect(defaultGesture("mixNode", "press", GLOBAL)).toBe("solo");
		expect(GLOBAL.applies.mute).not.toContain("mixNode");
	});

	it("taps to dim on the main out and -oo elsewhere", () => {
		expect(defaultGesture("main", "touch", GLOBAL)).toBe("dim");
		expect(defaultGesture("activeMonitor", "touch", GLOBAL)).toBe("dim");
		for (const kind of ["channel", "gain", "mixNode"] as const) {
			expect(defaultGesture(kind, "touch", GLOBAL)).toBe("infinity");
		}
	});

	it("centres a pan on touch, on a channel's and on a mix node's", () => {
		expect(defaultGesture("pan", "touch", GLOBAL)).toBe("center");
		expect(defaultGesture("mixPan", "touch", GLOBAL)).toBe("center");
	});

	it("presses a channel pan to mute and a mix pan to solo, following what owns each", () => {
		expect(defaultGesture("pan", "press", GLOBAL)).toBe("mute");
		expect(defaultGesture("mixPan", "press", GLOBAL)).toBe("solo");
		expect(GLOBAL.applies.mute).not.toContain("mixPan");
	});

	it("offers neither cue nor bypass, which the protocol does not carry", () => {
		// Pan it does have: /{bus}/{ch}/balpan and /mix/{src}/{in}/{out}/balpan.
		expect(GLOBAL.applies.cue).toBeUndefined();
		expect(GLOBAL.applies.bypass).toBeUndefined();
	});

	it("offers ARC-style Mute Main Out on every Global Volume target", () => {
		expect(GLOBAL.applies.muteMainOut).toEqual(GLOBAL.kinds);
		for (const kind of GLOBAL.kinds) {
			expect(resolveGesture("muteMainOut", kind, "press", GLOBAL)).toBe("muteMainOut");
		}
		expect(CLASSIC.applies.muteMainOut).toBeUndefined();
	});

	it("does not offer -oo on a pan, whose bottom is hard left rather than silence", () => {
		expect(GLOBAL.applies.infinity).not.toContain("pan");
		expect(GLOBAL.applies.infinity).not.toContain("mixPan");
	});
});

describe("resolveGesture", () => {
	it("falls back to the default when unset", () => {
		expect(resolveGesture(undefined, "channel", "press", CLASSIC)).toBe("mute");
		expect(resolveGesture("", "channel", "touch", CLASSIC)).toBe("infinity");
		expect(resolveGesture("auto", "main", "touch", CLASSIC)).toBe("dim");
	});

	it("honours an applicable choice", () => {
		expect(resolveGesture("solo", "strip", "press", CLASSIC)).toBe("solo");
		expect(resolveGesture("talkback", "fx", "touch", CLASSIC)).toBe("talkback");
		expect(resolveGesture("none", "main", "press", CLASSIC)).toBe("none");
		expect(resolveGesture("unity", "mixNode", "press", GLOBAL)).toBe("unity");
	});

	it("falls back when the setting outlives the target it was chosen under", () => {
		// A strip button set to phantom power, then switched to the main out.
		expect(resolveGesture("phantom", "main", "press", CLASSIC)).toBe("mute");
		// Unity is a fader position; gain has no dB scale of its own over OSC.
		expect(resolveGesture("unity", "gain", "touch", CLASSIC)).toBe("infinity");
		// Hard left is not an absence of signal, so -oo is not offered on a pan.
		expect(resolveGesture("infinity", "pan", "touch", CLASSIC)).toBe("center");
		// Centre is meaningless on a fader.
		expect(resolveGesture("center", "channel", "touch", CLASSIC)).toBe("infinity");
	});

	it("does not let one protocol's gestures leak into the other", () => {
		// Both are real classic gestures and neither exists in Global OSC.
		expect(resolveGesture("cue", "channel", "press", GLOBAL)).toBe("mute");
		expect(resolveGesture("center", "channel", "touch", GLOBAL)).toBe("infinity");
		expect(resolveGesture("cue", "pan", "press", GLOBAL)).toBe("mute");
		// And a mix node is not a classic target at all.
		expect(resolveGesture("mute", "mixNode", "press", GLOBAL)).toBe("solo");
	});

	it("falls back on a value written by a future or broken build", () => {
		expect(resolveGesture("teleport", "channel", "press", CLASSIC)).toBe("mute");
		expect(resolveGesture("teleport", "channel", "press", GLOBAL)).toBe("mute");
	});
});

/** Runs the same structural checks over whichever vocabulary is handed in. */
function checkVocabulary<K extends string>(name: string, vocabulary: Vocabulary<K>): void {
	describe(`${name} vocabulary`, () => {
		it("only ever falls back to a gesture the target can perform", () => {
			for (const kind of vocabulary.kinds) {
				for (const slot of ["press", "touch"] as const) {
					const chosen = defaultGesture(kind, slot, vocabulary);
					expect(vocabulary.applies[chosen]).toContain(kind);
				}
			}
		});

		it("never returns auto, so callers do not have to handle it", () => {
			const settings = [undefined, "auto", "nonsense", ...Object.keys(vocabulary.applies)];
			for (const kind of vocabulary.kinds) {
				for (const slot of ["press", "touch"] as const) {
					for (const setting of settings) {
						expect(resolveGesture(setting, kind, slot, vocabulary)).not.toBe("auto");
					}
				}
			}
		});

		it("resolves every listed gesture to itself on every target that claims it", () => {
			for (const [gesture, kinds] of Object.entries(vocabulary.applies) as [
				Gesture,
				readonly K[],
			][]) {
				if (gesture === "auto") continue;
				for (const kind of kinds) {
					expect(resolveGesture(gesture, kind, "press", vocabulary)).toBe(gesture);
				}
			}
		});

		it("has a label for every gesture it offers", () => {
			for (const gesture of Object.keys(vocabulary.applies) as Gesture[]) {
				expect(GESTURE_LABELS[gesture]).toBeTruthy();
			}
		});
	});
}

checkVocabulary<ClassicKind>("classic", CLASSIC);
checkVocabulary<GlobalKind>("Global OSC", GLOBAL);
checkVocabulary<GlobalFxKind>("Global OSC effects", GLOBAL_FX);
