/**
 * The mute and solo wash painted over a dial's touch display.
 *
 * Shared by the classic and Global OSC volume actions, which render the same
 * layout and so must agree on its keys and colours. The two reach the state
 * differently — the classic protocol addresses a bank position, Global OSC an
 * absolute channel — so each decides *whether* to wash; this file owns what a
 * wash looks like.
 */

import type { FeedbackPayload } from "@elgato/streamdeck";

/** The states a dial's touch display can be washed in. */
export type Wash = "none" | "mute" | "solo";

/**
 * Wash colours, taken from the border of the lit buttons in the TotalMix UI.
 *
 * Kept as hexes because the rest of each palette is derived from them, so
 * retinting is a single edit here plus regenerating the images with
 * `node tools/make-wash.mjs --mute <hex> --solo <hex>` — the two must agree,
 * since the touch display takes a wash as an image file while the text and bar
 * colours go over the wire.
 */
export const MUTE_WASH_COLOUR = "#6094FF";
export const SOLO_WASH_COLOUR = "#F7931E";

const MUTE_WASH = "imgs/muteWash.png";
const SOLO_WASH = "imgs/soloWash.png";
/** A fully transparent image of the same size, so clearing the wash swaps one valid file for another. */
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

/**
 * Text colour that stays readable on a given background.
 *
 * Derived rather than fixed, so changing a wash colour cannot leave the dial
 * unreadable. The two candidates are white and a heavily darkened version of the
 * wash itself, and whichever contrasts more wins — a fixed luminance threshold
 * gets mid-tone blues wrong, choosing white at around 2.7:1 where dark ink would
 * have given 7:1.
 */
export function readableInk(background: string): string {
	const dark = shade(background, 0.14);
	return contrast(background, dark) >= contrast(background, NORMAL_INK) ? dark : NORMAL_INK;
}

/** Everything a washed dial needs, derived from the one colour. */
type Palette = { readonly image: string; readonly ink: string; readonly barBg: string };

function palette(colour: string, image: string): Palette {
	const groove = shade(colour, 0.5);
	return { image, ink: readableInk(colour), barBg: `0:${groove},1:${groove}` };
}

const PALETTES: Readonly<Record<Wash, Palette | null>> = {
	none: null,
	mute: palette(MUTE_WASH_COLOUR, MUTE_WASH),
	solo: palette(SOLO_WASH_COLOUR, SOLO_WASH),
};

/**
 * Builds the whole touch-display payload, wash included.
 *
 * Every colour is written on every render, including the unwashed ones, rather
 * than only when it changes: setFeedback is sticky, so a dial left with dark ink
 * from a washed render keeps it afterwards and turns unreadable against the
 * black display. Omitting a colour does not restore the default.
 *
 * The header is on the layout key "name" rather than "title" for the reason it
 * has to be: "title" is reserved, and Stream Deck overrides its colour and font
 * with the user's title settings, so a colour sent for it is silently discarded
 * and the header disappears into the wash.
 *
 * The wash is an image file rather than an inline SVG or a background colour,
 * and is swapped for a transparent one of the same size rather than disabled. A
 * file path is the form the touch display accepts most reliably; an inline SVG
 * is documented but makes Stream Deck reject the whole layout.
 *
 * @param bar Position of the indicator, 0..100.
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
			// Against a wash the bar's fill takes the ink colour: the normal blue
			// would otherwise be the one element still fighting the background.
			bar_fill_c: paint === null ? NORMAL_BAR_FILL : ink,
			bar_bg_c: paint?.barBg ?? NORMAL_BAR_BG,
		},
	};
}
