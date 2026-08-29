/**
 * TotalMix FX colour tokens (dark theme), sampled from the mixer window.
 * The strip renderers derive every colour from this table.
 */

export const TM = {
	/** Channel strip body. */
	strip: "#2d3c47",
	/** Recessed areas inside a strip (meter well, header band). */
	inset: "#283640",
	/** Bottom bar / value readout band and unlit button faces. */
	well: "#1d2a34",
	/** Fader track groove. */
	track: "#101b24",
	/** Gap between strips. */
	gap: "#000000",

	/** Regular strip text (channel names, readouts). */
	text: "#c6d1de",
	/** Secondary text (unlit button captions, scale numbers). */
	textDim: "#688b9f",
	/** Header of the selected channel. */
	selected: "#3c8cff",

	/** Lit MUTE face and mute-group highlight. */
	mute: "#6094ff",
	/** Lit SOLO / PFL face. */
	solo: "#f7931e",
	/** Lit FX-section text (EQ, D, low cut, Room EQ). */
	fxOn: "#e0873f",
	/** 48V, record and clip. */
	hot: "#ff3b30",
	/** Meter fill. */
	meter: "#34bfd8",
	/** Meter peak-hold segment. */
	meterPeak: "#14cf20",

	/** Fader cap gradient stops, top to bottom. */
	capLight: "#c4c4c4",
	capMid: "#8f8f8f",
	capDark: "#4a4a4a",
	/** Cap centre line. */
	capLine: "#1a1a1a",
} as const;

/** Font stack the Stream Deck renderer resolves on both platforms. */
export const FONT = "Arial, Helvetica, sans-serif";
