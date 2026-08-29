/**
 * Dial press/touch gesture rules for the volume actions: which gestures a
 * target kind supports and the default per slot. One vocabulary per protocol.
 * The property inspectors list the same options in HTML; an inapplicable
 * option falls back to the default here.
 */

/** Which of the two dial gestures is being resolved. */
export type GestureSlot = "press" | "touch";

export type Gesture =
	/** Target default. */
	| "auto"
	| "none"
	// On the dial's own target.
	| "mute"
	| "solo"
	| "cue"
	| "phantom"
	| "infinity"
	| "unity"
	| "center"
	// Control room and global, independent of target.
	| "dim"
	| "mono"
	| "talkback"
	| "speakerB"
	| "muteMainOut"
	| "extIn"
	| "muteFx"
	| "recall"
	| "globalMute"
	| "globalSolo"
	// FX only.
	| "bypass"
	| "neutral"
	| "neutralToggle";

/** Classic target classes with distinct gesture rules. */
export type ClassicKind = "main" | "strip" | "channel" | "gain" | "fx" | "pan";

/** Global OSC target classes. A channel pan has a mute; a mix-node pan only a solo. */
export type GlobalKind =
	| "main"
	| "activeMonitor"
	| "channel"
	| "gain"
	| "mixNode"
	| "pan"
	| "mixPan";

/** Per-protocol rules: applicable kinds per gesture, and the default per kind and slot. */
export type Vocabulary<K extends string> = {
	readonly kinds: readonly K[];
	readonly applies: Readonly<Partial<Record<Gesture, readonly K[]>>>;
	readonly fallback: (kind: K, slot: GestureSlot) => Gesture;
};

const CLASSIC_KINDS = ["main", "strip", "channel", "gain", "fx", "pan"] as const;

/**
 * Classic protocol. "mute" on main is implemented as fader to -oo (the table
 * has no main-out mute). Defaults: press = mute (bypass for FX); touch = dim
 * on main, centre on pan, neutral on FX, -oo otherwise.
 */
export const CLASSIC: Vocabulary<ClassicKind> = {
	kinds: CLASSIC_KINDS,
	applies: {
		auto: CLASSIC_KINDS,
		none: CLASSIC_KINDS,

		mute: ["main", "strip", "channel", "gain", "pan"],
		solo: ["strip", "channel", "gain", "pan"],
		cue: ["strip", "channel", "gain", "pan"],
		phantom: ["strip", "channel", "gain", "pan"],
		// Bottom of the dial's range; excluded for pan (hard left).
		infinity: ["main", "strip", "channel", "gain", "fx"],
		// Fader position only; gain has no dB scale in this protocol.
		unity: ["main", "strip", "channel"],
		center: ["pan"],

		dim: CLASSIC_KINDS,
		mono: CLASSIC_KINDS,
		talkback: CLASSIC_KINDS,
		speakerB: CLASSIC_KINDS,
		extIn: CLASSIC_KINDS,
		muteFx: CLASSIC_KINDS,
		recall: CLASSIC_KINDS,
		globalMute: CLASSIC_KINDS,
		globalSolo: CLASSIC_KINDS,

		bypass: ["fx"],
		neutral: ["fx"],
		neutralToggle: ["fx"],
	},
	fallback: (kind, slot) => {
		if (slot === "press") return kind === "fx" ? "bypass" : "mute";
		if (kind === "main") return "dim";
		if (kind === "fx") return "neutral";
		return kind === "pan" ? "center" : "infinity";
	},
};

const GLOBAL_KINDS = [
	"main",
	"activeMonitor",
	"channel",
	"gain",
	"mixNode",
	"pan",
	"mixPan",
] as const;

/**
 * Global OSC effect parameters. "fx" carries a neutral value (dB parameters
 * return to 0 dB, selections to their first position); "fxPlain" covers
 * frequencies and raw values, where no neutral is defined.
 */
export type GlobalFxKind = "fx" | "fxPlain";

const GLOBAL_FX_KINDS = ["fx", "fxPlain"] as const;

/** Global OSC FX dials: press bypasses the section, touch parks a value at neutral and brings it back. */
export const GLOBAL_FX: Vocabulary<GlobalFxKind> = {
	kinds: GLOBAL_FX_KINDS,
	applies: {
		auto: GLOBAL_FX_KINDS,
		none: GLOBAL_FX_KINDS,

		bypass: GLOBAL_FX_KINDS,
		// One neutral gesture here: the toggle covers the plain reset, since its
		// first press writes neutral and only a second press restores.
		neutralToggle: ["fx"],

		dim: GLOBAL_FX_KINDS,
		mono: GLOBAL_FX_KINDS,
		talkback: GLOBAL_FX_KINDS,
		speakerB: GLOBAL_FX_KINDS,
		extIn: GLOBAL_FX_KINDS,
		muteFx: GLOBAL_FX_KINDS,
		recall: GLOBAL_FX_KINDS,
		globalMute: GLOBAL_FX_KINDS,
		globalSolo: GLOBAL_FX_KINDS,
	},
	fallback: (kind, slot) => {
		if (slot === "press") return "bypass";
		return kind === "fx" ? "neutralToggle" : "bypass";
	},
};

/**
 * Global OSC. Channels have mute and pfl but no cue; mix nodes have solo only,
 * so their press defaults to solo. The existing "mute" gesture on a control-
 * room target remains fader to -oo; "muteMainOut" is the separate ARC-style
 * operation that writes the assigned outputs' real mute parameters.
 */
export const GLOBAL: Vocabulary<GlobalKind> = {
	kinds: GLOBAL_KINDS,
	applies: {
		auto: GLOBAL_KINDS,
		none: GLOBAL_KINDS,

		mute: ["main", "activeMonitor", "channel", "gain", "pan"],
		solo: ["channel", "gain", "mixNode", "pan", "mixPan"],
		phantom: ["channel", "gain", "pan"],
		infinity: ["main", "activeMonitor", "channel", "gain", "mixNode"],
		unity: ["main", "activeMonitor", "channel", "mixNode"],
		center: ["pan", "mixPan"],

		dim: GLOBAL_KINDS,
		mono: GLOBAL_KINDS,
		talkback: GLOBAL_KINDS,
		speakerB: GLOBAL_KINDS,
		muteMainOut: GLOBAL_KINDS,
		extIn: GLOBAL_KINDS,
		muteFx: GLOBAL_KINDS,
		recall: GLOBAL_KINDS,
		globalMute: GLOBAL_KINDS,
		globalSolo: GLOBAL_KINDS,
	},
	fallback: (kind, slot) => {
		if (slot === "press") return kind === "mixNode" || kind === "mixPan" ? "solo" : "mute";
		if (kind === "main" || kind === "activeMonitor") return "dim";
		return kind === "pan" || kind === "mixPan" ? "center" : "infinity";
	},
};

/** What a gesture does when the user has not chosen. */
export function defaultGesture<K extends string>(
	kind: K,
	slot: GestureSlot,
	vocabulary: Vocabulary<K>,
): Gesture {
	return vocabulary.fallback(kind, slot);
}

/** Resolves a stored setting; unset, unknown or inapplicable values fall back to the default. */
export function resolveGesture<K extends string>(
	setting: string | undefined,
	kind: K,
	slot: GestureSlot,
	vocabulary: Vocabulary<K>,
): Gesture {
	if (setting === undefined || setting === "" || setting === "auto") {
		return defaultGesture(kind, slot, vocabulary);
	}

	const kinds = vocabulary.applies[setting as Gesture];
	if (kinds === undefined || !kinds.includes(kind)) {
		return defaultGesture(kind, slot, vocabulary);
	}

	return setting as Gesture;
}

/** Trigger-description labels per gesture. */
export const GESTURE_LABELS: Readonly<Record<Gesture, string>> = {
	auto: "Default",
	none: "\u2014",
	mute: "Mute",
	solo: "Solo",
	cue: "Cue",
	phantom: "48V",
	infinity: "To -oo",
	unity: "To 0 dB",
	center: "Centre",
	dim: "Dim",
	mono: "Mono",
	talkback: "Talkback",
	speakerB: "Speaker B",
	muteMainOut: "Mute Main Out",
	extIn: "Ext. In",
	muteFx: "Mute FX",
	recall: "Recall",
	globalMute: "Mute all",
	globalSolo: "Solo all",
	bypass: "Bypass",
	neutral: "Neutral",
	neutralToggle: "Neutral / back",
};
