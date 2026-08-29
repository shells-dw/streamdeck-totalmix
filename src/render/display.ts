/**
 * Artwork for the Display action: meters, device status, DSP load and DURec.
 * Same tokens and header as the strip renderers; 144×144 for keys, 200×100
 * for the touch display.
 */

import { dbToFader } from "../osc/curves.js";
import { FONT, TM } from "./theme.js";
import { ellipsize, fitFont, n, rrect, svgDataUrl, text, unit } from "./svg.js";

export type DisplayView =
	/** Channel peak meter with hold. */
	| { kind: "meter"; name: string; peakDb?: number; holdDb?: number }
	/** Free text, e.g. the device name. */
	| { kind: "text"; name: string; value: string }
	/** Lit / unlit state with a caption ("Connected"). */
	| { kind: "status"; name: string; value: string; on: boolean }
	/** Arc gauge, e.g. DSP load. */
	| { kind: "gauge"; name: string; value: string; fraction?: number }
	/** DURec time with the transport state beside it. */
	| { kind: "clock"; name: string; time: string; state?: string }
	/** DURec transport state as a glyph. */
	| { kind: "transport"; name: string; state?: string };

export interface DisplayState {
	view: DisplayView;
	offline?: boolean;
}

/** Scale marks along a meter, top to bottom. */
const METER_DB = [0, -6, -12, -20, -40, -60] as const;

const meterColour = (db: number): string => (db >= 0 ? TM.hot : TM.meter);

/** Levels drawn on a 1 dB grid (hold: 0.5 dB) so sub-dB changes don't produce new images. */
const qMeter = (db: number): number => Math.round(db);
const qHold = (db: number): number => Math.round(db * 2) / 2;

// --- Shared parts --------------------------------------------------------------

function header(name: string, offline: boolean): string {
	const shown = ellipsize(name, 12);
	return (
		`<rect x="0" y="0" width="144" height="26" fill="${TM.inset}"/>` +
		`<rect x="0" y="26" width="144" height="2" fill="${offline ? TM.textDim : TM.selected}"/>` +
		text(72, 19, shown, { size: fitFont(shown, 128, 17, 10), fill: offline ? TM.textDim : TM.text, weight: 700, family: FONT })
	);
}

function touchHeader(name: string, offline: boolean, right?: string): string {
	const shown = ellipsize(name, 18);
	return (
		`<rect x="0" y="0" width="200" height="24" fill="${TM.inset}"/>` +
		`<rect x="0" y="24" width="200" height="2" fill="${offline ? TM.textDim : TM.selected}"/>` +
		text(8, 18, shown, { size: fitFont(shown, right ? 110 : 184, 15, 10), fill: offline ? TM.textDim : TM.text, weight: 700, anchor: "start", family: FONT }) +
		(right ? text(192, 18, right, { size: fitFont(right, 74, 15, 10), fill: offline ? TM.textDim : TM.text, weight: 700, anchor: "end", family: FONT }) : "")
	);
}

/** Readout band along the bottom of a key. */
function readout(label: string, offline: boolean): string {
	return (
		`<rect x="0" y="120" width="144" height="24" fill="${TM.well}"/>` +
		text(72, 137, label, { size: fitFont(label, 130, 16, 10), fill: offline ? TM.textDim : TM.text, weight: 700, family: FONT })
	);
}

/** Transport glyph centred on (cx, cy); size is the half-extent. */
function transportGlyph(state: string | undefined, cx: number, cy: number, r: number, offline: boolean): string {
	const s = (state ?? "").toLowerCase();
	const lit = !offline;
	if (s.includes("rec")) return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * 0.85)}" fill="${lit ? TM.hot : TM.textDim}"/>`;
	if (s.includes("play")) return `<polygon points="${n(cx - r * 0.7)},${n(cy - r)} ${n(cx - r * 0.7)},${n(cy + r)} ${n(cx + r)},${n(cy)}" fill="${lit ? "#2ec84a" : TM.textDim}"/>`;
	if (s.includes("pause")) return rrect(cx - r * 0.8, cy - r, r * 0.55, r * 2, 3, lit ? TM.selected : TM.textDim) + rrect(cx + r * 0.25, cy - r, r * 0.55, r * 2, 3, lit ? TM.selected : TM.textDim);
	// Stop, idle and unknown states.
	return rrect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7, 4, TM.textDim);
}

/** Arc path from a0 to a1 degrees (0 = up, clockwise). */
function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
	const rad = (a: number): number => ((a - 90) * Math.PI) / 180;
	const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
	return `M ${n(cx + r * Math.cos(rad(a0)))} ${n(cy + r * Math.sin(rad(a0)))} A ${n(r)} ${n(r)} 0 ${large} 1 ${n(cx + r * Math.cos(rad(a1)))} ${n(cy + r * Math.sin(rad(a1)))}`;
}

/** Gauge ring; the fill turns orange past 75 % and red past 90 %. */
function gauge(cx: number, cy: number, r: number, fraction: number | undefined, offline: boolean): string {
	const parts: string[] = [];
	parts.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r + 8)}" fill="${TM.well}"/>`);
	parts.push(`<path d="${arcPath(cx, cy, r, -135, 135)}" fill="none" stroke="${TM.track}" stroke-width="7" stroke-linecap="round"/>`);
	if (fraction !== undefined && !offline) {
		const f = unit(fraction);
		const colour = f > 0.9 ? TM.hot : f > 0.75 ? TM.solo : TM.selected;
		if (f > 0.005) parts.push(`<path d="${arcPath(cx, cy, r, -135, -135 + f * 270)}" fill="none" stroke="${colour}" stroke-width="7" stroke-linecap="round"/>`);
	}
	return parts.join("");
}

/** Vertical meter well with fill and hold line; x/top/height describe the well. */
function meterV(x: number, top: number, w: number, h: number, peakDb: number | undefined, holdDb: number | undefined, offline: boolean): string {
	const parts: string[] = [rrect(x, top, w, h, 2, TM.inset)];
	if (offline) return parts.join("");
	if (peakDb !== undefined) peakDb = qMeter(peakDb);
	if (holdDb !== undefined) holdDb = qHold(holdDb);
	if (peakDb !== undefined) {
		const fill = unit(dbToFader(peakDb)) * (h - 2);
		if (fill > 0) parts.push(rrect(x + 1, top + h - 1 - fill, w - 2, fill, 1, meterColour(peakDb)));
	}
	if (holdDb !== undefined) {
		const y = top + h - 1 - unit(dbToFader(holdDb)) * (h - 2);
		parts.push(`<rect x="${n(x + 1)}" y="${n(y - 1)}" width="${n(w - 2)}" height="2" fill="${holdDb >= 0 ? TM.hot : TM.meterPeak}"/>`);
	}
	return parts.join("");
}

function meterH(x: number, y: number, w: number, h: number, peakDb: number | undefined, holdDb: number | undefined, offline: boolean): string {
	const parts: string[] = [rrect(x, y, w, h, 2, TM.inset)];
	if (offline) return parts.join("");
	if (peakDb !== undefined) peakDb = qMeter(peakDb);
	if (holdDb !== undefined) holdDb = qHold(holdDb);
	if (peakDb !== undefined) {
		const fill = unit(dbToFader(peakDb)) * (w - 2);
		if (fill > 0) parts.push(rrect(x + 1, y + 1, fill, h - 2, 1, meterColour(peakDb)));
	}
	if (holdDb !== undefined) {
		const hx = x + 1 + unit(dbToFader(holdDb)) * (w - 2);
		parts.push(`<rect x="${n(hx - 1)}" y="${n(y + 1)}" width="2" height="${n(h - 2)}" fill="${holdDb >= 0 ? TM.hot : TM.meterPeak}"/>`);
	}
	return parts.join("");
}

const fmtDb = (db: number | undefined): string => (db === undefined || db <= -60 ? "-oo" : `${qHold(db).toFixed(1)} dB`);

// --- Keys -------------------------------------------------------------------------

export function displayKeySvg(s: DisplayState): string {
	const offline = s.offline === true;
	const v = s.view;
	const parts: string[] = [rrect(0, 0, 144, 144, 8, TM.strip), header(v.name, offline)];

	switch (v.kind) {
		case "meter": {
			const top = 34;
			const bottom = 114;
			const h = bottom - top;
			// Wide meter left, scale to its right.
			parts.push(meterV(24, top, 40, h, v.peakDb, v.holdDb, offline));
			for (const db of METER_DB) {
				const y = bottom - unit(dbToFader(db)) * h;
				const major = db === 0;
				parts.push(`<line x1="70" y1="${n(y)}" x2="${major ? 80 : 76}" y2="${n(y)}" stroke="${major ? TM.text : TM.textDim}" stroke-width="${major ? 2 : 1}"/>`);
				parts.push(text(84, y + 3.5, String(Math.abs(db)), { size: 10, fill: major ? TM.text : TM.textDim, weight: 600, anchor: "start", family: FONT }));
			}
			parts.push(readout(offline ? "—" : fmtDb(v.holdDb ?? v.peakDb), offline));
			break;
		}
		case "text": {
			const value = offline ? "—" : v.value;
			parts.push(rrect(10, 40, 124, 70, 8, TM.well));
			parts.push(text(72, 82, ellipsize(value, 20), { size: fitFont(ellipsize(value, 20), 112, 22, 10), fill: offline ? TM.textDim : TM.text, weight: 700, family: FONT }));
			parts.push(`<circle cx="72" cy="126" r="5" fill="${offline ? TM.textDim : "#2ec84a"}"/>`);
			break;
		}
		case "status": {
			const on = v.on && !offline;
			parts.push(rrect(12, 40, 120, 68, 10, on ? "#2ec84a" : offline ? TM.well : TM.hot, `stroke="${TM.gap}" stroke-width="1"`));
			parts.push(`<circle cx="72" cy="74" r="16" fill="${on ? "#0f1c2a" : "#ffffff"}" opacity="${offline ? 0.4 : 1}"/>`);
			parts.push(text(72, 132, offline ? "—" : v.value, { size: fitFont(v.value, 128, 16, 10), fill: offline ? TM.textDim : TM.text, weight: 700, family: FONT }));
			break;
		}
		case "gauge": {
			parts.push(gauge(72, 78, 32, v.fraction, offline));
			const value = offline ? "—" : v.value;
			parts.push(text(72, 85, value, { size: fitFont(value, 50, 20, 10), fill: offline ? TM.textDim : TM.text, weight: 700, family: FONT }));
			break;
		}
		case "clock": {
			parts.push(transportGlyph(v.state, 72, 62, 16, offline));
			parts.push(readout(offline ? "—" : v.time, offline));
			parts.push(text(72, 104, offline ? "" : (v.state ?? ""), { size: 13, fill: TM.textDim, weight: 600, family: FONT }));
			break;
		}
		case "transport": {
			parts.push(rrect(12, 36, 120, 80, 10, TM.well, `stroke="${TM.gap}" stroke-width="1"`));
			parts.push(transportGlyph(v.state, 72, 76, 24, offline));
			parts.push(text(72, 136, offline ? "—" : (v.state ?? "—"), { size: 15, fill: offline ? TM.textDim : TM.text, weight: 700, family: FONT }));
			break;
		}
	}
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144" width="144" height="144">${parts.join("")}</svg>`;
}

// --- Touch display -------------------------------------------------------------------

export function displayTouchSvg(s: DisplayState): string {
	const offline = s.offline === true;
	const v = s.view;
	const parts: string[] = [`<rect x="0" y="0" width="200" height="100" fill="${TM.strip}"/>`];

	switch (v.kind) {
		case "meter": {
			parts.push(touchHeader(v.name, offline, offline ? "—" : fmtDb(v.holdDb ?? v.peakDb)));
			parts.push(meterH(12, 40, 176, 22, v.peakDb, v.holdDb, offline));
			for (const db of METER_DB) {
				const x = 13 + unit(dbToFader(db)) * 174;
				const major = db === 0;
				parts.push(`<line x1="${n(x)}" y1="66" x2="${n(x)}" y2="${major ? 74 : 71}" stroke="${major ? TM.text : TM.textDim}" stroke-width="${major ? 2 : 1}"/>`);
				parts.push(text(x, 88, String(Math.abs(db)), { size: 11, fill: major ? TM.text : TM.textDim, weight: 600, family: FONT }));
			}
			break;
		}
		case "text": {
			parts.push(touchHeader(v.name, offline));
			const value = offline ? "—" : v.value;
			parts.push(rrect(8, 36, 184, 52, 8, TM.well));
			parts.push(text(100, 69, ellipsize(value, 26), { size: fitFont(ellipsize(value, 26), 170, 22, 10), fill: offline ? TM.textDim : TM.text, weight: 700, family: FONT }));
			break;
		}
		case "status": {
			parts.push(touchHeader(v.name, offline));
			const on = v.on && !offline;
			parts.push(rrect(8, 36, 184, 52, 8, on ? "#2ec84a" : offline ? TM.well : TM.hot, `stroke="${TM.gap}" stroke-width="1"`));
			parts.push(text(100, 70, offline ? "—" : v.value, { size: 22, fill: on ? "#0f1c2a" : "#ffffff", weight: 700, family: FONT }));
			break;
		}
		case "gauge": {
			parts.push(touchHeader(v.name, offline));
			parts.push(gauge(44, 64, 22, v.fraction, offline));
			const value = offline ? "—" : v.value;
			parts.push(text(132, 74, value, { size: fitFont(value, 110, 30, 12), fill: offline ? TM.textDim : TM.text, weight: 700, family: FONT }));
			break;
		}
		case "clock": {
			parts.push(touchHeader(v.name, offline, offline ? "" : (v.state ?? "")));
			parts.push(transportGlyph(v.state, 32, 64, 14, offline));
			parts.push(text(124, 76, offline ? "—" : v.time, { size: fitFont(v.time, 130, 32, 14), fill: offline ? TM.textDim : TM.text, weight: 700, family: FONT }));
			break;
		}
		case "transport": {
			parts.push(touchHeader(v.name, offline));
			parts.push(transportGlyph(v.state, 44, 64, 20, offline));
			parts.push(text(132, 74, offline ? "—" : (v.state ?? "—"), { size: fitFont(v.state ?? "—", 110, 26, 12), fill: offline ? TM.textDim : TM.text, weight: 700, family: FONT }));
			break;
		}
	}
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="200" height="100">${parts.join("")}</svg>`;
}

export const displayKeyImage = (s: DisplayState): string => svgDataUrl(displayKeySvg(s));
export const displayTouchImage = (s: DisplayState): string => svgDataUrl(displayTouchSvg(s));
