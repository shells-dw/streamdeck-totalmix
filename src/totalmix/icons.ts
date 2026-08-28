import type { ToggleParameter } from "../actions/toggle.js";

/**
 * Per-parameter On/Off icons for the Toggle actions, applied with setImage()
 * because the manifest carries one generic pair. Paths are plugin-relative,
 * without extension (Stream Deck resolves .png and @2x).
 */

export interface IconPair {
	on: string;
	off: string;
}

const img = (name: string): string => `imgs/${name}`;

const pair = (base: string): IconPair => ({
	on: img(`${base}On`),
	off: img(`${base}Off`),
});

/** Fallback for parameters with no dedicated artwork. */
const GENERIC: IconPair = pair("mute");

const ICONS: Partial<Record<ToggleParameter, IconPair>> = {
	// Main / Control Room
	mainDim: pair("dim"),
	mainMono: pair("mono"),
	mainMuteFx: pair("muteFX"),
	mainSpeakerB: pair("speakerB"),
	mainTalkback: pair("talkback"),
	mainExtIn: pair("extIn"),
	mainRecall: { on: img("recall"), off: img("recall") },

	// Global
	globalMute: pair("mute"),
	globalSolo: pair("solo"),
	trim: pair("trim"),

	// Strip in the current bank
	stripMute: pair("mute"),
	stripSolo: pair("solo"),
	stripPhantom: pair("phantom"),
	stripCue: pair("cue"),

	// Selected channel
	channelMute: pair("mute"),
	channelSolo: pair("solo"),
	channelPhantom: pair("phantom"),
	channelEq: pair("Eq"),
	channelLowcut: pair("Eq"),
	channelComp: pair("Comp"),
	channelAutoLevel: pair("AutoLev"),
	channelPhase: pair("phase"),
	channelPhaseRight: pair("phaseRight"),
	// Two rings when the channel is stereo, one when it is mono.
	channelStereo: pair("stereo"),
	// Single-glyph artwork; state is carried by setState only.
	channelLoopback: { on: img("loopback"), off: img("loopback") },
	channelAutoset: { on: img("autoset"), off: img("autoset") },
	channelInstrument: { on: img("gain"), off: img("gain") },
	channelPad: { on: img("gain"), off: img("gain") },
	channelMsProc: { on: img("stereo"), off: img("stereo") },
	channelRecord: pair("rec"),

	// DURec transport.
	recordStart: pair("rec"),
	recordPlayPause: pair("play"),
	recordStop: pair("stop"),

	// Groups and snapshots have no dedicated artwork.
	muteGroup: pair("mute"),
	soloGroup: pair("solo"),
	faderGroup: pair("mixer"),
	snapshot: pair("mixer"),

	// Effects
	reverb: pair("mixer"),
	echo: pair("mixer"),
	roomEq: pair("Eq"),
};

export const iconFor = (parameter: ToggleParameter): IconPair => ICONS[parameter] ?? GENERIC;

/**
 * Key image for a nudge button: the arrow points the way a press moves the
 * value, so a pair of keys reads as up and down without needing titles.
 */
export const nudgeIcon = (nudge?: "up" | "down"): string =>
	nudge === "down" ? ACTION_ICONS.volumeLower : ACTION_ICONS.volumeRaise;

/** Icons used by other actions via setImage. */
export const ACTION_ICONS = {
	volume: img("volume"),
	volumeRaise: img("volumeRaise"),
	volumeLower: img("volumeLower"),
	gain: img("gain"),
	pan: img("pan"),
	mixer: img("mixerOn"),
	loopback: img("loopback"),
	stereo: img("stereo"),
	autoset: img("autoset"),
	defaultImage: img("actionDefaultImage"),
} as const;
