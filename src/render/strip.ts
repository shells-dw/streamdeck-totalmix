/**
 * TotalMix-styled artwork for the Global OSC actions.
 *
 * Every function returns a complete SVG document. Keys use a 144×144 viewBox
 * (the @2x key size); the touch display uses 200×100. Colours come from
 * theme.ts. Fader and meter positions follow the mixer's own fader curve so
 * the 0 dB mark sits where it does in TotalMix.
 */

import { dbToFader } from "../osc/curves.js";
import { FONT, TM } from "./theme.js";
import { ellipsize, fitFont, n, rrect, svgDataUrl, text, unit } from "./svg.js";

export type StripWash = "none" | "mute" | "solo";

export interface FaderState {
	/** Channel name shown in the header. */
	name: string;
	/** Readout under the fader ("-12.0 dB", "-oo", "—"). */
	label: string;
	/** Fader position 0..1 (faderlin); undefined draws the cap at -oo, greyed. */
	position?: number;
	/** Peak level in dB (fader scale, 0 = unity mark); undefined hides the meter. */
	meterDb?: number;
	/** Held peak in dB; draws a hold line above the fill. */
	holdDb?: number;
	/** True hides the meter well altogether (protocols without usable meters). */
	noMeter?: boolean;
	mute: boolean;
	solo: boolean;
	/** Key placement: which way a press moves the fader. */
	nudge?: "up" | "down";
	/** Connection lost: artwork dims and the readout shows "—". */
	offline?: boolean;
}

/** Small lit/unlit pill under a control (M, S, EQ, D …). */
export interface Badge {
	label: string;
	lit: boolean;
	/** Lit face colour. */
	colour: string;
}

export interface KnobState {
	name: string;
	/** Centre readout ("56", "C", "L30", "1.00k"). */
	label: string;
	/** Arc fill 0..1; undefined draws an empty ring. */
	position?: number;
	/** Bipolar knobs sweep from the centre; others from the left stop. */
	bipolar: boolean;
	/** Arc colour; defaults to the selection blue. */
	arc?: string;
	/** Parameter name printed under the knob; empty omits it. */
	caption?: string;
	/** Pills along the bottom edge, left to right. */
	badges: Badge[];
	nudge?: "up" | "down";
	offline?: boolean;
}

/** Mute / solo badge pair used by the level controls. */
export const muteSoloBadges = (mute: boolean, solo: boolean): Badge[] => [
	{ label: "M", lit: mute, colour: TM.mute },
	{ label: "S", lit: solo, colour: TM.solo },
];

export type ButtonGlyph = "play" | "pause" | "stop" | "record" | "next" | "previous" | "undo" | "redo" | "window";

export interface ButtonState {
	/** Face caption ("M", "48V", "EQ"); ignored when a glyph is set. */
	label: string;
	/** Transport / edit symbol drawn instead of the label. */
	glyph?: ButtonGlyph;
	/** Small caption under the face (channel name); empty hides it. */
	caption: string;
	on: boolean;
	/** Lit face colour. */
	colour: string;
	offline?: boolean;
}

/** Scale marks in dB drawn beside the fader, top to bottom. */
const SCALE_DB = [0, -6, -10, -20, -40, -60] as const;

/** Marks that also carry a number on the key; the rest are ticks only. */
const SCALE_LABELLED: ReadonlySet<number> = new Set([0, -20, -60]);

/** Ink on a lit blue or orange face. */
const LIT_INK = "#0f1c2a";

/** Position along the fader for a level in dB, 0..1. */
const levelPos = (db: number): number => unit(dbToFader(db));

// --- Shared parts --------------------------------------------------------------

/** Readable ink on a lit face: white on saturated red, dark on blue and orange. */
const litInk = (colour: string): string => (colour === TM.hot ? "#ffffff" : LIT_INK);

/** Badge pill. */
function badge(x: number, y: number, w: number, h: number, b: Badge, offline: boolean): string {
	const lit = b.lit && !offline;
	const face = lit ? b.colour : TM.well;
	const ink = lit ? litInk(b.colour) : TM.textDim;
	const label = ellipsize(b.label, 6);
	const size = fitFont(label, w - 6, Math.round(h * 0.7), 8);
	return (
		rrect(x, y, w, h, Math.min(5, h / 4), face, offline ? 'opacity="0.5"' : "") +
		text(x + w / 2, y + h / 2 + size * 0.36, label, {
			size,
			fill: ink,
			weight: 700,
			family: FONT,
		})
	);
}

/** M / S pill. */
function pill(
	x: number,
	y: number,
	w: number,
	h: number,
	glyph: "M" | "S",
	lit: boolean,
	offline: boolean,
): string {
	return badge(x, y, w, h, { label: glyph, lit, colour: glyph === "M" ? TM.mute : TM.solo }, offline);
}

/** Row of equally sized badges starting at x with a 4 px gap. */
function badgeRowTight(x: number, y: number, each: number, h: number, badges: Badge[], offline: boolean): string {
	return badges.map((b, i) => badge(x + i * (each + 4), y, each, h, b, offline)).join("");
}

/** Row of badges spread across [x, x + w] with a fixed gap. */
function badgeRow(x: number, y: number, w: number, h: number, badges: Badge[], offline: boolean): string {
	if (badges.length === 0) return "";
	const gap = 8;
	// A lone badge keeps the width of one of a pair so it reads as a button, not a bar.
	const each = Math.min((w - gap * (badges.length - 1)) / badges.length, (w - gap) / 2);
	const rowW = each * badges.length + gap * (badges.length - 1);
	const start = x + (w - rowW) / 2;
	return badges.map((b, i) => badge(start + i * (each + gap), y, each, h, b, offline)).join("");
}

/** Fader cap: horizontal ridges on a vertical gradient, with a centre line. */
function capDefs(id: string, vertical: boolean): string {
	const dir = vertical ? 'x1="0" y1="0" x2="0" y2="1"' : 'x1="0" y1="0" x2="1" y2="0"';
	return (
		`<linearGradient id="${id}" ${dir}>` +
		`<stop offset="0" stop-color="${TM.capLight}"/>` +
		`<stop offset="0.5" stop-color="${TM.capMid}"/>` +
		`<stop offset="1" stop-color="${TM.capDark}"/>` +
		`</linearGradient>`
	);
}

/** Cap centred on (cx, cy). `vertical` is the travel direction. */
function cap(cx: number, cy: number, w: number, h: number, vertical: boolean, gradId: string): string {
	const body = rrect(cx - w / 2, cy - h / 2, w, h, 3, `url(#${gradId})`, `stroke="${TM.gap}" stroke-width="1"`);
	const ridges: string[] = [];
	if (vertical) {
		for (let i = -2; i <= 2; i++) {
			if (i === 0) continue;
			const y = cy + i * (h / 6);
			ridges.push(`<line x1="${n(cx - w / 2 + 3)}" y1="${n(y)}" x2="${n(cx + w / 2 - 3)}" y2="${n(y)}" stroke="${TM.capDark}" stroke-width="1"/>`);
		}
		ridges.push(`<line x1="${n(cx - w / 2 + 2)}" y1="${n(cy)}" x2="${n(cx + w / 2 - 2)}" y2="${n(cy)}" stroke="${TM.capLine}" stroke-width="2"/>`);
	} else {
		for (let i = -2; i <= 2; i++) {
			if (i === 0) continue;
			const x = cx + i * (w / 6);
			ridges.push(`<line x1="${n(x)}" y1="${n(cy - h / 2 + 3)}" x2="${n(x)}" y2="${n(cy + h / 2 - 3)}" stroke="${TM.capDark}" stroke-width="1"/>`);
		}
		ridges.push(`<line x1="${n(cx)}" y1="${n(cy - h / 2 + 2)}" x2="${n(cx)}" y2="${n(cy + h / 2 - 2)}" stroke="${TM.capLine}" stroke-width="2"/>`);
	}
	return body + ridges.join("");
}

/** Key header band: name, selection underline, optional nudge chevron. */
function header(name: string, offline: boolean, nudge: "up" | "down" | undefined): string {
	const shown = ellipsize(name, 12);
	return (
		`<rect x="0" y="0" width="144" height="26" fill="${TM.inset}"/>` +
		`<rect x="0" y="26" width="144" height="2" fill="${offline ? TM.textDim : TM.selected}"/>` +
		text(nudge ? 66 : 72, 19, shown, {
			size: fitFont(shown, nudge ? 104 : 128, 17, 10),
			fill: offline ? TM.textDim : TM.text,
			weight: 700,
			family: FONT,
		}) +
		chevron(130, 13, 12, nudge)
	);
}

/** Touch header band: name left. */
function touchHeader(name: string, offline: boolean): string {
	const shown = ellipsize(name, 18);
	return (
		`<rect x="0" y="0" width="200" height="24" fill="${TM.inset}"/>` +
		`<rect x="0" y="24" width="200" height="2" fill="${offline ? TM.textDim : TM.selected}"/>` +
		text(8, 18, shown, {
			size: fitFont(shown, 184, 15, 10),
			fill: offline ? TM.textDim : TM.text,
			weight: 700,
			anchor: "start",
			family: FONT,
		})
	);
}

/** Badges centred on cx, each at most 30 wide, 4 px apart. */
function badgeRowCentred(cx: number, y: number, maxW: number, h: number, badges: Badge[], offline: boolean): string {
	if (badges.length === 0) return "";
	const each = Math.min(30, (maxW - 4 * (badges.length - 1)) / badges.length);
	const rowW = each * badges.length + 4 * (badges.length - 1);
	return badgeRowTight(cx - rowW / 2, y, each, h, badges, offline);
}

/** Nudge chevron for key placements. */
function chevron(cx: number, cy: number, size: number, nudge: "up" | "down" | undefined): string {
	if (nudge === undefined) return "";
	const h = size / 2;
	const points =
		nudge === "up"
			? `${n(cx - size / 2)},${n(cy + h / 2)} ${n(cx)},${n(cy - h / 2)} ${n(cx + size / 2)},${n(cy + h / 2)}`
			: `${n(cx - size / 2)},${n(cy - h / 2)} ${n(cx)},${n(cy + h / 2)} ${n(cx + size / 2)},${n(cy - h / 2)}`;
	return `<polyline points="${points}" fill="none" stroke="${TM.textDim}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** Meter fill colour: red once the peak reaches 0 dB. */
const meterColour = (db: number): string => (db >= 0 ? TM.hot : TM.meter);

/**
 * Meter levels are drawn on a 1 dB grid (hold: 0.5 dB). Sub-dB changes are
 * invisible at key size and would only produce distinct images, each of which
 * costs a transfer to the deck.
 */
const qMeter = (db: number): number => Math.round(db);
const qHold = (db: number): number => Math.round(db * 2) / 2;

// --- Key: fader strip -----------------------------------------------------------

/**
 * 144×144 channel strip: header, M/S pills, meter, scale, fader, readout.
 * Layout (y): header 0–26, pills 30–50, body 56–116, readout 120–144.
 */
export function faderKeySvg(s: FaderState): string {
	const offline = s.offline === true;
	const top = 56;
	const bottom = 114;
	const travel = bottom - top;
	const yFor = (pos: number): number => bottom - unit(pos) * travel;

	const meterX = 14;
	const meterW = 10;
	const scaleX = 34;
	const faderCx = 100;
	const trackW = 6;
	const capW = 36;
	const capH = 18;

	const parts: string[] = [];
	parts.push(`<defs>${capDefs("capV", true)}</defs>`);
	parts.push(rrect(0, 0, 144, 144, 8, TM.strip));
	// Header band.
	parts.push(`<rect x="0" y="0" width="144" height="26" fill="${TM.inset}"/>`);
	parts.push(`<rect x="0" y="26" width="144" height="2" fill="${offline ? TM.textDim : TM.selected}"/>`);
	const name = ellipsize(s.name, 12);
	const nameSize = fitFont(name, s.nudge ? 104 : 128, 17, 10);
	parts.push(
		text(s.nudge ? 66 : 72, 19, name, {
			size: nameSize,
			fill: offline ? TM.textDim : TM.text,
			weight: 700,
			family: FONT,
		}),
	);
	parts.push(chevron(130, 13, 12, s.nudge));

	// M / S pills.
	parts.push(pill(10, 31, 58, 16, "M", s.mute && !offline, offline));
	parts.push(pill(76, 31, 58, 16, "S", s.solo && !offline, offline));

	// Meter well and fill.
	if (!s.noMeter) parts.push(rrect(meterX, top - 2, meterW, travel + 4, 2, TM.inset));
	if (!s.noMeter && s.meterDb !== undefined && !offline) {
		const meterDb = qMeter(s.meterDb);
		const h = unit(dbToFader(meterDb)) * travel;
		if (h > 0) {
			parts.push(rrect(meterX + 1, bottom - h, meterW - 2, h, 1, meterColour(meterDb)));
		}
		if (s.holdDb !== undefined) {
			const holdDb = qHold(s.holdDb);
			const y = bottom - unit(dbToFader(holdDb)) * travel;
			parts.push(`<rect x="${n(meterX + 1)}" y="${n(y - 1)}" width="${n(meterW - 2)}" height="2" fill="${holdDb >= 0 ? TM.hot : TM.meterPeak}"/>`);
		}
	}

	// Scale ticks with labels.
	for (const db of SCALE_DB) {
		const y = yFor(levelPos(db));
		const major = db === 0;
		parts.push(
			`<line x1="${n(scaleX)}" y1="${n(y)}" x2="${n(scaleX + (major ? 10 : 6))}" y2="${n(y)}" stroke="${major ? TM.text : TM.textDim}" stroke-width="${major ? 2 : 1}"/>`,
		);
		if (!SCALE_LABELLED.has(db)) continue;
		parts.push(
			text(scaleX + 14, y + 3.5, String(Math.abs(db)), {
				size: 9,
				fill: major ? TM.text : TM.textDim,
				weight: 600,
				anchor: "start",
				family: FONT,
			}),
		);
	}
	// Unity line across the track.
	const unityY = yFor(levelPos(0));
	parts.push(`<line x1="${n(faderCx - capW / 2)}" y1="${n(unityY)}" x2="${n(faderCx + capW / 2)}" y2="${n(unityY)}" stroke="${TM.textDim}" stroke-width="1"/>`);

	// Track and cap.
	parts.push(rrect(faderCx - trackW / 2, top - 4, trackW, travel + 8, 3, TM.track));
	const capY = yFor(s.position ?? 0);
	parts.push(`<g${offline || s.position === undefined ? ' opacity="0.45"' : ""}>${cap(faderCx, capY, capW, capH, true, "capV")}</g>`);

	// Readout band.
	parts.push(`<rect x="0" y="120" width="144" height="24" fill="${TM.well}"/>`);
	const label = offline ? "—" : s.label;
	parts.push(
		text(72, 137, label, {
			size: fitFont(label, 130, 16, 10),
			fill: offline ? TM.textDim : TM.text,
			weight: 700,
			family: FONT,
		}),
	);

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144" width="144" height="144">${parts.join("")}</svg>`;
}

// --- Touch display: fader ---------------------------------------------------------

/**
 * 200×100 horizontal strip: name and readout on top, fader across the middle,
 * M/S pills and meter along the bottom.
 */
export function faderTouchSvg(s: FaderState): string {
	const offline = s.offline === true;
	const left = 14;
	const right = 186;
	const travel = right - left;
	const xFor = (pos: number): number => left + unit(pos) * travel;
	const trackY = 48;
	const capW = 16;
	const capH = 28;

	const parts: string[] = [];
	parts.push(`<defs>${capDefs("capH", false)}</defs>`);
	parts.push(`<rect x="0" y="0" width="200" height="100" fill="${TM.strip}"/>`);
	parts.push(`<rect x="0" y="0" width="200" height="24" fill="${TM.inset}"/>`);
	parts.push(`<rect x="0" y="24" width="200" height="2" fill="${offline ? TM.textDim : TM.selected}"/>`);

	const name = ellipsize(s.name, 16);
	parts.push(
		text(8, 18, name, {
			size: fitFont(name, 110, 15, 10),
			fill: offline ? TM.textDim : TM.text,
			weight: 700,
			anchor: "start",
			family: FONT,
		}),
	);
	const label = offline ? "—" : s.label;
	parts.push(
		text(192, 18, label, {
			size: fitFont(label, 74, 15, 10),
			fill: offline ? TM.textDim : TM.text,
			weight: 700,
			anchor: "end",
			family: FONT,
		}),
	);

	// Scale ticks under the track.
	for (const db of SCALE_DB) {
		const x = xFor(levelPos(db));
		const major = db === 0;
		parts.push(
			`<line x1="${n(x)}" y1="${n(trackY + 16)}" x2="${n(x)}" y2="${n(trackY + (major ? 22 : 20))}" stroke="${major ? TM.text : TM.textDim}" stroke-width="${major ? 2 : 1}"/>`,
		);
	}
	// Track, unity mark and cap.
	parts.push(rrect(left - 4, trackY - 3, travel + 8, 6, 3, TM.track));
	const unityX = xFor(levelPos(0));
	parts.push(`<line x1="${n(unityX)}" y1="${n(trackY - capH / 2)}" x2="${n(unityX)}" y2="${n(trackY + capH / 2)}" stroke="${TM.textDim}" stroke-width="1"/>`);
	const capX = xFor(s.position ?? 0);
	parts.push(`<g${offline || s.position === undefined ? ' opacity="0.45"' : ""}>${cap(capX, trackY, capW, capH, false, "capH")}</g>`);

	// Pills and meter.
	parts.push(pill(8, 76, 26, 18, "M", s.mute && !offline, offline));
	parts.push(pill(38, 76, 26, 18, "S", s.solo && !offline, offline));
	const meterX = 74;
	const meterW = 118;
	if (!s.noMeter) parts.push(rrect(meterX, 80, meterW, 10, 2, TM.inset));
	if (!s.noMeter && s.meterDb !== undefined && !offline) {
		const meterDb = qMeter(s.meterDb);
		const w = unit(dbToFader(meterDb)) * (meterW - 2);
		if (w > 0) parts.push(rrect(meterX + 1, 81, w, 8, 1, meterColour(meterDb)));
		if (s.holdDb !== undefined) {
			const holdDb = qHold(s.holdDb);
			const hx = meterX + 1 + unit(dbToFader(holdDb)) * (meterW - 2);
			parts.push(`<rect x="${n(hx - 1)}" y="81" width="2" height="8" fill="${holdDb >= 0 ? TM.hot : TM.meterPeak}"/>`);
		}
	}
	if (!s.noMeter) {
		const meterUnity = meterX + 1 + levelPos(0) * (meterW - 2);
		parts.push(`<line x1="${n(meterUnity)}" y1="79" x2="${n(meterUnity)}" y2="91" stroke="${TM.text}" stroke-width="1"/>`);
	}

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="200" height="100">${parts.join("")}</svg>`;
}

// --- Knob (gain, pan) -----------------------------------------------------------

/** Arc path from `a0` to `a1` degrees (0 = up, clockwise) on a circle. */
function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
	const rad = (a: number): number => ((a - 90) * Math.PI) / 180;
	const x0 = cx + r * Math.cos(rad(a0));
	const y0 = cy + r * Math.sin(rad(a0));
	const x1 = cx + r * Math.cos(rad(a1));
	const y1 = cy + r * Math.sin(rad(a1));
	const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
	const sweep = a1 > a0 ? 1 : 0;
	return `M ${n(x0)} ${n(y0)} A ${n(r)} ${n(r)} 0 ${large} ${sweep} ${n(x1)} ${n(y1)}`;
}

/** Knob ring, 270° sweep from -135° to +135°, with the value arc and pointer. */
function knob(cx: number, cy: number, r: number, s: KnobState, labelSize: number): string {
	// labelSize 0 omits the centre readout (the touch layout prints it beside the knob).
	const offline = s.offline === true;
	const start = -135;
	const end = 135;
	const parts: string[] = [];
	parts.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r + 8)}" fill="${TM.well}"/>`);
	parts.push(`<path d="${arcPath(cx, cy, r, start, end)}" fill="none" stroke="${TM.track}" stroke-width="6" stroke-linecap="round"/>`);
	if (s.position !== undefined && !offline) {
		const pos = unit(s.position);
		const angle = start + pos * (end - start);
		const from = s.bipolar ? 0 : start;
		if (Math.abs(angle - from) > 0.5) {
			parts.push(`<path d="${arcPath(cx, cy, r, from, angle)}" fill="none" stroke="${s.arc ?? TM.selected}" stroke-width="6" stroke-linecap="round"/>`);
		}
		const rad = ((angle - 90) * Math.PI) / 180;
		parts.push(`<line x1="${n(cx + (r - 14) * Math.cos(rad))}" y1="${n(cy + (r - 14) * Math.sin(rad))}" x2="${n(cx + (r - 4) * Math.cos(rad))}" y2="${n(cy + (r - 4) * Math.sin(rad))}" stroke="${TM.text}" stroke-width="3" stroke-linecap="round"/>`);
	}
	if (labelSize > 0) {
		const label = offline ? "—" : s.label;
		parts.push(
			text(cx, cy + labelSize * 0.36, label, {
				size: fitFont(label, r * 1.5, labelSize, 10),
				fill: offline ? TM.textDim : TM.text,
				weight: 700,
				family: FONT,
			}),
		);
	}
	return parts.join("");
}

/**
 * 144×144 knob key. Without a caption (gain, pan) the knob sits centred with
 * the readout inside. With a caption (effect parameters) the knob moves left,
 * the readout goes beside it and the caption takes a full line, so both stay
 * legible at key size.
 */
export function knobKeySvg(s: KnobState): string {
	const offline = s.offline === true;
	const parts: string[] = [];
	parts.push(rrect(0, 0, 144, 144, 8, TM.strip));
	parts.push(header(s.name, offline, s.nudge));
	const caption = (s.caption ?? "").trim();
	if (caption === "") {
		parts.push(knob(72, 74, 32, s, 20));
	} else {
		parts.push(knob(38, 62, 22, s, 0));
		const label = offline ? "—" : s.label;
		parts.push(
			text(102, 70, label, {
				size: fitFont(label, 76, 24, 12),
				fill: offline ? TM.textDim : TM.text,
				weight: 700,
				family: FONT,
			}),
		);
		parts.push(
			text(72, 106, ellipsize(caption, 16), {
				size: fitFont(caption, 130, 18, 11),
				fill: offline ? TM.textDim : TM.text,
				weight: 600,
				family: FONT,
			}),
		);
	}
	parts.push(badgeRow(10, 118, 124, 18, s.badges, offline));
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144" width="144" height="144">${parts.join("")}</svg>`;
}

/** 200×100 knob touch display: knob left; readout, caption and badges right. */
export function knobTouchSvg(s: KnobState): string {
	const offline = s.offline === true;
	const parts: string[] = [];
	parts.push(`<rect x="0" y="0" width="200" height="100" fill="${TM.strip}"/>`);
	parts.push(touchHeader(s.name, offline));
	parts.push(knob(40, 62, 24, s, 0));
	const label = offline ? "—" : s.label;
	const caption = (s.caption ?? "").trim();
	const cx = 136;
	parts.push(
		text(cx, caption === "" ? 66 : 54, label, {
			size: fitFont(label, 112, 26, 12),
			fill: offline ? TM.textDim : TM.text,
			weight: 700,
			family: FONT,
		}),
	);
	if (caption !== "") {
		parts.push(
			text(cx, 74, ellipsize(caption, 18), {
				size: fitFont(caption, 112, 15, 9),
				fill: offline ? TM.textDim : TM.text,
				weight: 600,
				family: FONT,
			}),
		);
	}
	parts.push(badgeRowCentred(cx, 80, 100, 16, s.badges, offline));
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="200" height="100">${parts.join("")}</svg>`;
}

// --- List (index parameters) --------------------------------------------------------

export interface ListState {
	name: string;
	/** Current entry ("Large Room", "+4 dBu"). */
	label: string;
	/** Parameter name. */
	caption: string;
	/** 0-based position and list length for the position dots; omitted hides them. */
	index?: number;
	count?: number;
	/** Select keys: the shown entry is the active one; the box lights. */
	active?: boolean;
	badges: Badge[];
	nudge?: "up" | "down";
	offline?: boolean;
}

/** Row of position dots, the current one filled. */
function dots(cx: number, y: number, index: number | undefined, count: number | undefined, offline: boolean): string {
	if (index === undefined || count === undefined || count < 2 || count > 16) return "";
	const gap = count > 8 ? 6 : 8;
	const r = 2.5;
	const start = cx - ((count - 1) * gap) / 2;
	const out: string[] = [];
	for (let i = 0; i < count; i++) {
		const on = i === Math.round(index) && !offline;
		out.push(`<circle cx="${n(start + i * gap)}" cy="${n(y)}" r="${n(on ? r + 1 : r)}" fill="${on ? TM.selected : TM.textDim}"/>`);
	}
	return out.join("");
}

/** 144×144 list key: the entry in a TotalMix dropdown box, caption, dots, badges. */
export function listKeySvg(s: ListState): string {
	const offline = s.offline === true;
	const parts: string[] = [];
	parts.push(rrect(0, 0, 144, 144, 8, TM.strip));
	parts.push(header(s.name, offline, s.nudge));
	const active = s.active === true && !offline;
	parts.push(rrect(10, 38, 124, 40, 6, active ? TM.selected : TM.well, `stroke="${TM.gap}" stroke-width="1"`));
	const label = offline ? "—" : ellipsize(s.label, 14);
	parts.push(
		text(active ? 72 : 66, 66, label, {
			size: fitFont(label, active ? 112 : 96, 22, 11),
			fill: offline ? TM.textDim : active ? LIT_INK : TM.text,
			weight: 700,
			family: FONT,
		}),
	);
	// Dropdown chevron, as on the TotalMix list boxes; a lit select key has none.
	if (!active) {
		parts.push(`<polyline points="118,54 124,60 130,54" fill="none" stroke="${TM.textDim}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`);
	}
	parts.push(dots(72, 88, s.index, s.count, offline));
	parts.push(
		text(72, 108, ellipsize(s.caption, 16), {
			size: fitFont(s.caption, 130, 18, 11),
			fill: offline ? TM.textDim : TM.text,
			weight: 600,
			family: FONT,
		}),
	);
	parts.push(badgeRow(10, 118, 124, 18, s.badges, offline));
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144" width="144" height="144">${parts.join("")}</svg>`;
}

/** 200×100 list touch display: dropdown box left, caption and badges right. */
export function listTouchSvg(s: ListState): string {
	const offline = s.offline === true;
	const parts: string[] = [];
	parts.push(`<rect x="0" y="0" width="200" height="100" fill="${TM.strip}"/>`);
	parts.push(touchHeader(s.name, offline));
	parts.push(rrect(8, 36, 184, 34, 6, TM.well, `stroke="${TM.gap}" stroke-width="1"`));
	const label = offline ? "—" : ellipsize(s.label, 18);
	parts.push(
		text(92, 60, label, {
			size: fitFont(label, 140, 22, 11),
			fill: offline ? TM.textDim : TM.text,
			weight: 700,
			family: FONT,
		}),
	);
	parts.push(`<polyline points="172,49 178,55 184,49" fill="none" stroke="${TM.textDim}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`);
	parts.push(
		text(8, 90, ellipsize(s.caption, 16), {
			size: fitFont(s.caption, 86, 15, 9),
			fill: offline ? TM.textDim : TM.text,
			weight: 600,
			anchor: "start",
			family: FONT,
		}),
	);
	parts.push(dots(s.badges.length > 0 ? 118 : 146, 86, s.index, s.count, offline));
	parts.push(badgeRowCentred(174, 80, 36, 16, s.badges, offline));
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="200" height="100">${parts.join("")}</svg>`;
}

// --- Button (toggle) --------------------------------------------------------------

/** Transport and edit symbols, centred on (cx, cy) in a 44 px box. */
function glyph(kind: ButtonGlyph, cx: number, cy: number, ink: string): string {
	const r = 22;
	switch (kind) {
		case "play":
			return `<polygon points="${n(cx - r * 0.7)},${n(cy - r)} ${n(cx - r * 0.7)},${n(cy + r)} ${n(cx + r)},${n(cy)}" fill="${ink}"/>`;
		case "pause":
			return rrect(cx - r * 0.8, cy - r, r * 0.55, r * 2, 3, ink) + rrect(cx + r * 0.25, cy - r, r * 0.55, r * 2, 3, ink);
		case "stop":
			return rrect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7, 4, ink);
		case "record":
			return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * 0.85)}" fill="${ink}"/>`;
		case "next":
			return (
				`<polygon points="${n(cx - r)},${n(cy - r * 0.8)} ${n(cx - r)},${n(cy + r * 0.8)} ${n(cx + r * 0.3)},${n(cy)}" fill="${ink}"/>` +
				rrect(cx + r * 0.45, cy - r * 0.8, r * 0.4, r * 1.6, 2, ink)
			);
		case "previous":
			return (
				`<polygon points="${n(cx + r)},${n(cy - r * 0.8)} ${n(cx + r)},${n(cy + r * 0.8)} ${n(cx - r * 0.3)},${n(cy)}" fill="${ink}"/>` +
				rrect(cx - r * 0.85, cy - r * 0.8, r * 0.4, r * 1.6, 2, ink)
			);
		case "undo":
		case "redo": {
			const flip = kind === "redo" ? -1 : 1;
			const a = cx - flip * r * 0.9;
			return (
				`<path d="M ${n(cx + flip * r * 0.9)} ${n(cy + r * 0.6)} A ${n(r * 0.9)} ${n(r * 0.9)} 0 1 ${flip === 1 ? 0 : 1} ${n(a)} ${n(cy - r * 0.1)}" fill="none" stroke="${ink}" stroke-width="6" stroke-linecap="round"/>` +
				`<polygon points="${n(a - flip * 10)},${n(cy - r * 0.1)} ${n(a + flip * 10)},${n(cy - r * 0.1)} ${n(a)},${n(cy - r * 0.1 - 14)}" fill="${ink}"/>`
			);
		}
		case "window":
			return (
				rrect(cx - r, cy - r * 0.75, r * 2, r * 1.5, 4, "none", `stroke="${ink}" stroke-width="5"`) +
				rrect(cx - r, cy - r * 0.75, r * 2, 10, 4, ink)
			);
	}
}

/** 144×144 TotalMix-style button with an optional caption. */
export function buttonKeySvg(s: ButtonState): string {
	const offline = s.offline === true;
	const lit = s.on && !offline;
	const hasCaption = s.caption.trim() !== "";
	const faceY = 12;
	const faceH = hasCaption ? 92 : 120;
	const parts: string[] = [];
	parts.push(rrect(0, 0, 144, 144, 8, TM.strip));
	parts.push(
		rrect(12, faceY, 120, faceH, 10, lit ? s.colour : TM.well, `stroke="${TM.gap}" stroke-width="1"${offline ? ' opacity="0.5"' : ""}`),
	);
	const ink = lit ? litInk(s.colour) : TM.textDim;
	if (s.glyph !== undefined) {
		parts.push(glyph(s.glyph, 72, faceY + faceH / 2, ink));
	} else {
		const label = ellipsize(s.label, 8);
		const size = fitFont(label, 104, label.length <= 2 ? 56 : 40, 14);
		parts.push(
			text(72, faceY + faceH / 2 + size * 0.36, label, {
				size,
				fill: ink,
				weight: 700,
				family: FONT,
			}),
		);
	}
	if (hasCaption) {
		const caption = ellipsize(s.caption, 14);
		parts.push(
			text(72, 132, caption, {
				size: fitFont(caption, 128, 15, 9),
				fill: offline ? TM.textDim : TM.text,
				weight: 600,
				family: FONT,
			}),
		);
	}
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144" width="144" height="144">${parts.join("")}</svg>`;
}

// --- Data URLs ---------------------------------------------------------------------

export const faderKeyImage = (s: FaderState): string => svgDataUrl(faderKeySvg(s));
export const faderTouchImage = (s: FaderState): string => svgDataUrl(faderTouchSvg(s));
export const knobKeyImage = (s: KnobState): string => svgDataUrl(knobKeySvg(s));
export const knobTouchImage = (s: KnobState): string => svgDataUrl(knobTouchSvg(s));
export const buttonKeyImage = (s: ButtonState): string => svgDataUrl(buttonKeySvg(s));
export const listKeyImage = (s: ListState): string => svgDataUrl(listKeySvg(s));
export const listTouchImage = (s: ListState): string => svgDataUrl(listTouchSvg(s));
