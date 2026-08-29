/** Small SVG string helpers shared by the renderers. No DOM, no dependencies. */

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Escapes text for use inside an SVG text node or attribute. */
export function esc(text: string): string {
	return text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

/** Average glyph advance as a fraction of font size for the Arial-class fonts used here. */
const GLYPH_EM = 0.56;

/**
 * Largest font size at or below `max` whose estimated line width fits `width`,
 * never smaller than `min`. Estimation avoids text measurement, which the
 * plugin host does not provide.
 */
export function fitFont(text: string, width: number, max: number, min: number): number {
	const chars = Math.max(1, [...text].length);
	const fits = width / (chars * GLYPH_EM);
	return Math.max(min, Math.min(max, Math.floor(fits)));
}

/** Truncates to `maxChars` with an ellipsis. */
export function ellipsize(text: string, maxChars: number): string {
	const chars = [...text];
	if (chars.length <= maxChars) return text;
	return `${chars.slice(0, Math.max(1, maxChars - 1)).join("")}…`;
}

/** Fixed-precision number for attribute values. */
export const n = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(2));

/** 0..1 clamp exported for the renderers. */
export const unit = clamp01;

/** Base64 data URL; accepted by setImage and by pixmap layout items. */
export function svgDataUrl(svg: string): string {
	return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

/** Text element with the common attributes. */
export function text(
	x: number,
	y: number,
	value: string,
	opts: {
		size: number;
		fill: string;
		weight?: number;
		anchor?: "start" | "middle" | "end";
		family: string;
	},
): string {
	return (
		`<text x="${n(x)}" y="${n(y)}" font-family="${opts.family}" font-size="${n(opts.size)}"` +
		` font-weight="${opts.weight ?? 600}" fill="${opts.fill}"` +
		` text-anchor="${opts.anchor ?? "middle"}">${esc(value)}</text>`
	);
}

/** Rounded rectangle. */
export function rrect(
	x: number,
	y: number,
	w: number,
	h: number,
	r: number,
	fill: string,
	extra = "",
): string {
	return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(r)}" fill="${fill}"${extra ? ` ${extra}` : ""}/>`;
}
