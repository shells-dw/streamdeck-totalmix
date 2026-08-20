import type { ToggleParameter } from "../actions/toggle.js";

/**
 * Icon lookup for the Toggle action.
 *
 * The v3 plugin shipped a separate action per parameter, so each could declare its
 * own On/Off images in the manifest. v4 collapses them into one action with a
 * parameter dropdown, which means the manifest can only carry a generic pair — so
 * the specific icon is applied at runtime with setImage().
 *
 * Paths are relative to the plugin folder and omit the extension: Stream Deck
 * resolves ".png" and the "@2x" variant itself.
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

	// Groups and snapshots have no dedicated artwork in the v3 set; the mixer
	// glyph reads better than a mute symbol for these.
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

/** Icons used by the other actions, for setImage where a static state won't do. */
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
