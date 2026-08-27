/**
 * What a Stream Deck+ dial's press and touch gestures do on a volume action.
 *
 * Split out from the actions because this is pure lookup — which gestures a
 * target can perform, and which one it falls back to — with no connection, no
 * OSC and no Stream Deck involved, so it can be tested directly. The actions own
 * the sending; this file owns the rules.
 *
 * Two vocabularies, one per protocol. They share the gesture names but not the
 * targets those names apply to: the classic protocol addresses a position in a
 * bank and reaches cue and phantom power from the fader page, while Global OSC
 * addresses an absolute channel, adds mix nodes, and has no pan. Conflating them
 * would offer each protocol gestures the other's targets cannot perform.
 *
 * The property inspectors offer the same lists. They cannot import TypeScript,
 * so their options are written out in the HTML and must be kept in step with the
 * tables below; the runtime is the authority, and an option a target cannot
 * perform falls back to the default rather than doing nothing surprising.
 */

/** Which of the two dial gestures is being resolved. */
export type GestureSlot = "press" | "touch";

export type Gesture =
	/** Whatever suits the target — the setting every button starts with. */
	| "auto"
	| "none"
	// The thing this dial points at.
	| "mute"
	| "solo"
	| "cue"
	| "phantom"
	| "infinity"
	| "unity"
	| "center"
	// Control room and global, whatever the dial points at.
	| "dim"
	| "mono"
	| "talkback"
	| "speakerB"
	| "extIn"
	| "muteFx"
	| "recall"
	| "globalMute"
	| "globalSolo"
	// FX only.
	| "bypass";

/**
 * Classic targets, collapsed to the classes that share gesture behaviour. Every
 * FX parameter behaves the same way, and "gain" differs from "strip" only in
 * that its own value is not a mix fader.
 */
export type ClassicKind = "main" | "strip" | "channel" | "gain" | "fx" | "pan";

/**
 * Global OSC targets. Pan is split from the fader kinds because the two pans
 * hang off different things: a channel's belongs to a channel, which has a mute,
 * while a mix node's belongs to a send, which has only a solo.
 */
export type GlobalKind = "main" | "channel" | "gain" | "mixNode" | "pan" | "mixPan";

/** A protocol's rules: what each gesture applies to, and what to do unasked. */
export type Vocabulary<K extends string> = {
	readonly kinds: readonly K[];
	readonly applies: Readonly<Partial<Record<Gesture, readonly K[]>>>;
	readonly fallback: (kind: K, slot: GestureSlot) => Gesture;
};

const CLASSIC_KINDS = ["main", "strip", "channel", "gain", "fx", "pan"] as const;

/**
 * Classic protocol.
 *
 * "mute" covers main deliberately: the protocol has no main-out mute, so the
 * action silences the fader and remembers the level instead. That is a property
 * of how the gesture is performed, not of whether it is offered.
 *
 * Press mutes, because that is what a monitor dial is pressed for. Touch resets
 * the dial to its own neutral: dim on the main out — the one control-room
 * gesture it actually has, and the thing the press used to do before mute took
 * it — centre on a pan, and -oo elsewhere, which silences a channel without
 * disturbing its mute state or its mute group.
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
		// -oo means "the bottom of this dial's own range", which is silence for a
		// fader and simply minimum for gain or an FX parameter. Pan is excluded:
		// its bottom is hard left, not an absence of anything.
		infinity: ["main", "strip", "channel", "gain", "fx"],
		// Unity is a fader position; gain has no dB scale of its own over this
		// protocol and an FX parameter has no unity to return to.
		unity: ["main", "strip", "channel"],
		// Pan's own neutral, the counterpart of unity on a fader.
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
	},
	fallback: (kind, slot) => {
		if (slot === "press") return kind === "fx" ? "bypass" : "mute";
		if (kind === "main") return "dim";
		return kind === "pan" ? "center" : "infinity";
	},
};

const GLOBAL_KINDS = ["main", "channel", "gain", "mixNode", "pan", "mixPan"] as const;

/**
 * Global OSC.
 *
 * Differs from the classic vocabulary in ways that follow the protocol rather
 * than taste. Its channel section carries mute and PFL but no cue, and its mix
 * nodes are sends: a node has a solo but no mute, because pulling it down is the
 * mute — so a node's press defaults to solo. The control room has no mute either
 * — dim, mono, talkback, speaker B, external in, mute FX and recall, and nothing
 * else — so "mute" on a main dial silences the fader here for the same reason it
 * does classically.
 */
export const GLOBAL: Vocabulary<GlobalKind> = {
	kinds: GLOBAL_KINDS,
	applies: {
		auto: GLOBAL_KINDS,
		none: GLOBAL_KINDS,

		mute: ["main", "channel", "gain", "pan"],
		solo: ["channel", "gain", "mixNode", "pan", "mixPan"],
		phantom: ["channel", "gain", "pan"],
		// A pan's bottom is hard left, not an absence of anything.
		infinity: ["main", "channel", "gain", "mixNode"],
		unity: ["main", "channel", "mixNode"],
		center: ["pan", "mixPan"],

		dim: GLOBAL_KINDS,
		mono: GLOBAL_KINDS,
		talkback: GLOBAL_KINDS,
		speakerB: GLOBAL_KINDS,
		extIn: GLOBAL_KINDS,
		muteFx: GLOBAL_KINDS,
		recall: GLOBAL_KINDS,
		globalMute: GLOBAL_KINDS,
		globalSolo: GLOBAL_KINDS,
	},
	fallback: (kind, slot) => {
		if (slot === "press") return kind === "mixNode" || kind === "mixPan" ? "solo" : "mute";
		if (kind === "main") return "dim";
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

/**
 * The gesture to actually perform.
 *
 * Falls back to the default for anything unset, unrecognised, or not applicable
 * to this target — settings outlive the target they were chosen under, so a
 * button switched from a strip to the main out must not be left with a phantom
 * power press that quietly does nothing.
 */
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

/** Hints shown under a dial, one per gesture. Short enough for the touch display. */
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
	extIn: "Ext. In",
	muteFx: "Mute FX",
	recall: "Recall",
	globalMute: "Mute all",
	globalSolo: "Solo all",
	bypass: "Bypass",
};
