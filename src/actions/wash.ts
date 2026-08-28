/** Touch-display wash (mute/solo/fxOn) for layouts/volume.json, shared by all dial actions. */

import type { FeedbackPayload } from "@elgato/streamdeck";

/** "mute"/"solo" wash the background; "fxOn" only tints text and bar. */
export type Wash = "none" | "mute" | "solo" | "fxOn";

/**
 * Wash colours (TotalMix's lit-button borders). The palettes derive from them;
 * imgs/muteWash.png and imgs/soloWash.png must use the same colours.
 */
export const MUTE_WASH_COLOUR = "#6094FF";
export const SOLO_WASH_COLOUR = "#F7931E";

/** Ink for an enabled effect section. */
export const FX_ON_COLOUR = "#F7931E";

const MUTE_WASH = "imgs/muteWash.png";
const SOLO_WASH = "imgs/soloWash.png";
/** Transparent image of the same size; clearing the wash swaps files. */
const CLEAR_WASH = "imgs/clearWash.png";

const NORMAL_INK = "#FFFFFF";
const NORMAL_BAR_FILL = "#2ea3f2";
const NORMAL_BAR_BG = "0:#1b1b1b,1:#1b1b1b";

/** Scales a hex colour's channels, keeping its hue. */
function shade(hex: string, factor: number): string {
	const n = Number.parseInt(hex.slice(1), 16);
	const channel = (shift: number): number =>
		Math.max(0, Math.min(255, Math.round(((n >> shift) & 0xff) * factor)));
	return `#${((1 << 24) | (channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).slice(1)}`;
}

/** WCAG relative luminance of a hex colour. */
function luminance(hex: string): number {
	const n = Number.parseInt(hex.slice(1), 16);
	const linear = [16, 8, 0]
		.map((shift) => ((n >> shift) & 0xff) / 255)
		.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
	return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
}

/** WCAG contrast ratio between two hex colours, 1 (identical) to 21 (black on white). */
function contrast(a: string, b: string): number {
	const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
	return (high + 0.05) / (low + 0.05);
}

/** White or a darkened shade of the background, whichever has the higher WCAG contrast. */
export function readableInk(background: string): string {
	const dark = shade(background, 0.14);
	return contrast(background, dark) >= contrast(background, NORMAL_INK) ? dark : NORMAL_INK;
}

/** Derived palette for one wash. */
type Palette = { readonly image: string; readonly ink: string; readonly barBg: string };

function palette(colour: string, image: string): Palette {
	const groove = shade(colour, 0.5);
	return { image, ink: readableInk(colour), barBg: `0:${groove},1:${groove}` };
}

const PALETTES: Readonly<Record<Wash, Palette | null>> = {
	none: null,
	mute: palette(MUTE_WASH_COLOUR, MUTE_WASH),
	solo: palette(SOLO_WASH_COLOUR, SOLO_WASH),
	// Transparent background; ink sits on the display's black.
	fxOn: { image: CLEAR_WASH, ink: FX_ON_COLOUR, barBg: NORMAL_BAR_BG },
};

/**
 * Full touch-display payload. Every colour is written on every render because
 * setFeedback is sticky. The header uses layout key "name": "title" is
 * reserved and its colour is overridden by the user's title settings. The
 * wash is a PNG path; inline SVG makes Stream Deck reject the layout.
 * @param bar Indicator position, 0..100.
 */
export function washFeedback(name: string, label: string, bar: number, wash: Wash): FeedbackPayload {
	const paint = PALETTES[wash];
	const ink = paint?.ink ?? NORMAL_INK;

	return {
		bg: paint?.image ?? CLEAR_WASH,
		name: { value: name, color: ink },
		value: { value: label, color: ink },
		indicator: {
			value: bar,
			// Bar fill takes the ink colour on a wash.
			bar_fill_c: paint === null ? NORMAL_BAR_FILL : ink,
			bar_bg_c: paint?.barBg ?? NORMAL_BAR_BG,
		},
	};
}
