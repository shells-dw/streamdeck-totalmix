/**
 * Minimal OSC 1.0 codec for the subset TotalMix FX uses: single-argument
 * messages (float or string), optionally inside immediate bundles.
 * Big-endian; strings null-terminated and padded to 4 bytes.
 */

export type OscValue = number | string | boolean | null;

export interface OscMessage {
	readonly address: string;
	readonly value: OscValue;
	/** Number of arguments present. TotalMix always sends exactly one. */
	readonly argCount: number;
}

const MAX_BUNDLE_DEPTH = 8;
const BUNDLE_TAG = "#bundle\0";

const pad4 = (n: number): number => (n + 3) & ~3;

/** TotalMix sends a bare "/" as a keepalive. */
export const isHeartbeat = (m: OscMessage): boolean => m.address === "/";

/** True for a "...Val" display-string address, e.g. "/1/volume1Val". */
export const isDisplayValue = (m: OscMessage): boolean => m.address.endsWith("Val");

/** Numeric view: booleans coerce to 1/0, strings and null to 0. */
export function asNumber(v: OscValue): number {
	if (typeof v === "number") return v;
	if (typeof v === "boolean") return v ? 1 : 0;
	return 0;
}

/** TotalMix treats anything at or above 0.5 as on. */
export const asBool = (v: OscValue): boolean =>
	typeof v === "string" ? false : asNumber(v) >= 0.5;

interface Cursor {
	pos: number;
}

/** Reads a null-terminated, 4-byte-padded OSC string; null when unterminated. */
function readString(buf: Buffer, c: Cursor): string | null {
	if (c.pos >= buf.length) return null;

	const nul = buf.indexOf(0, c.pos);
	if (nul < 0) return null;

	const s = buf.toString("utf8", c.pos, nul);
	const advance = pad4(nul - c.pos + 1);

	// Padding past the datagram end: keep the string, stop further reads.
	c.pos = c.pos + advance > buf.length ? buf.length : c.pos + advance;
	return s;
}

/** Reads one argument by type tag; undefined when unreadable (caller must stop). */
function readArg(buf: Buffer, c: Cursor, tag: string): OscValue | undefined {
	switch (tag) {
		case "f":
			if (c.pos + 4 > buf.length) return undefined;
			{
				const v = buf.readFloatBE(c.pos);
				c.pos += 4;
				return v;
			}
		case "i":
			if (c.pos + 4 > buf.length) return undefined;
			{
				const v = buf.readInt32BE(c.pos);
				c.pos += 4;
				return v;
			}
		case "s":
		case "S":
			return readString(buf, c) ?? undefined;
		case "T":
			return true;
		case "F":
			return false;
		case "b": {
			// Blob: int32 length + payload padded to 4; skipped.
			if (c.pos + 4 > buf.length) return undefined;
			const len = buf.readInt32BE(c.pos);
			c.pos += 4;
			if (len < 0 || c.pos + pad4(len) > buf.length) return undefined;
			c.pos += pad4(len);
			return null;
		}
		// Unused fixed-width types, stepped over.
		case "h":
		case "d":
		case "t":
			if (c.pos + 8 > buf.length) return undefined;
			c.pos += 8;
			return null;
		case "c":
		case "r":
		case "m":
			if (c.pos + 4 > buf.length) return undefined;
			c.pos += 4;
			return null;
		// Zero-width types.
		case "N":
		case "I":
			return null;
		default:
			return undefined;
	}
}

function parseMessage(buf: Buffer, out: OscMessage[]): void {
	const c: Cursor = { pos: 0 };

	const address = readString(buf, c);
	if (address === null) return;

	// No type tag string: argument-less message (e.g. the "/" heartbeat).
	if (c.pos >= buf.length) {
		out.push({ address, value: null, argCount: 0 });
		return;
	}

	const tags = readString(buf, c);
	if (tags === null || tags[0] !== ",") return;

	let value: OscValue = null;
	let argCount = 0;

	for (let i = 1; i < tags.length; i++) {
		const v = readArg(buf, c, tags[i]!);
		// Unparseable argument: keep the message with what was read.
		if (v === undefined) break;
		if (argCount === 0) value = v;
		argCount++;
	}

	out.push({ address, value, argCount });
}

function parseInto(buf: Buffer, out: OscMessage[], depth: number): void {
	if (depth > MAX_BUNDLE_DEPTH || buf.length < 4) return;

	if (buf.length >= 8 && buf.toString("latin1", 0, 8) === BUNDLE_TAG) {
		// "#bundle\0" + 8-byte timetag (ignored; TotalMix sends immediate bundles).
		let pos = 16;

		while (pos + 4 <= buf.length) {
			const size = buf.readInt32BE(pos);
			pos += 4;
			// Reject element sizes that exceed the datagram.
			if (size <= 0 || pos + size > buf.length) return;
			parseInto(buf.subarray(pos, pos + size), out, depth + 1);
			pos += size;
		}
		return;
	}

	if (buf[0] !== 0x2f /* '/' */) return;
	parseMessage(buf, out);
}

/** Parses one datagram into a flat message list. Never throws; stops at the first corruption. */
export function parsePacket(buf: Buffer): OscMessage[] {
	const out: OscMessage[] = [];
	try {
		parseInto(buf, out, 0);
	} catch {
		// Bounds-checked above; guard kept so the socket listener cannot die.
	}
	return out;
}

function writeString(s: string): Buffer {
	const raw = Buffer.from(s, "utf8");
	const buf = Buffer.alloc(pad4(raw.length + 1));
	raw.copy(buf, 0);
	return buf;
}

/** Message with one float argument. */
export function encodeFloat(address: string, value: number): Buffer {
	const addr = writeString(address);
	const tags = writeString(",f");
	const arg = Buffer.alloc(4);
	arg.writeFloatBE(value, 0);
	return Buffer.concat([addr, tags, arg]);
}

export function encodeInt(address: string, value: number): Buffer {
	const addr = writeString(address);
	const tags = writeString(",i");
	const arg = Buffer.alloc(4);
	arg.writeInt32BE(value, 0);
	return Buffer.concat([addr, tags, arg]);
}

/** Message with no arguments (bare address plus empty type tag). */
export function encodeBare(address: string): Buffer {
	return Buffer.concat([writeString(address), writeString(",")]);
}

/**
 * Address with no type tag string. Not strict OSC 1.0, but the form TotalMix
 * uses for page selection (a page dump bundle starts with "/1\0\0").
 */
export function encodeAddress(address: string): Buffer {
	return writeString(address);
}

/** 1.0 on a kOSCScaleToggle address flips the parameter. */
export const encodeToggle = (address: string): Buffer => encodeFloat(address, 1.0);
