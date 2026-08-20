/**
 * Minimal OSC 1.0 codec covering exactly what TotalMix FX speaks: bundles of
 * single-argument messages carrying a float or a string.
 *
 * Deliberately hand-rolled rather than taking a dependency. The .NET and Node OSC
 * package ecosystems are both chains of abandoned forks, and the subset TotalMix
 * uses is small enough that owning it is cheaper than migrating off an orphan
 * later. Correctness is pinned by tests, including a real captured session.
 *
 * Wire format: big-endian; strings null-terminated and padded with nulls to a
 * 4-byte boundary.
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

/**
 * True for the display-string mirror of a parameter, e.g. "/1/volume1Val".
 * These carry TotalMix's own formatting and should be shown verbatim rather than
 * recomputed locally.
 */
export const isDisplayValue = (m: OscMessage): boolean => m.address.endsWith("Val");

/**
 * Numeric view of a value. TotalMix expresses on/off as 0.0/1.0, so booleans
 * coerce. Strings deliberately do NOT coerce: a display string like "-6.0 dB"
 * is not a value, and silently parsing it would mask a mis-modelled address.
 */
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

/**
 * Reads a null-terminated, 4-byte-padded OSC string, advancing past the padding.
 * Returns null when the buffer holds no terminator (malformed).
 */
function readString(buf: Buffer, c: Cursor): string | null {
	if (c.pos >= buf.length) return null;

	const nul = buf.indexOf(0, c.pos);
	if (nul < 0) return null;

	const s = buf.toString("utf8", c.pos, nul);
	const advance = pad4(nul - c.pos + 1);

	// Padding claiming to run past the datagram: keep the string but park the
	// cursor at the end so no further argument is attempted.
	c.pos = c.pos + advance > buf.length ? buf.length : c.pos + advance;
	return s;
}

/**
 * Reads one argument by type tag. Returns `undefined` when the argument cannot
 * be read or its width is unknown — the caller must then stop, since alignment
 * is no longer recoverable.
 */
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
			// Blob: int32 length, payload padded to 4. Unused by TotalMix, but
			// skipped correctly so any following argument stays aligned.
			if (c.pos + 4 > buf.length) return undefined;
			const len = buf.readInt32BE(c.pos);
			c.pos += 4;
			if (len < 0 || c.pos + pad4(len) > buf.length) return undefined;
			c.pos += pad4(len);
			return null;
		}
		// Fixed-width types we don't use but must step over accurately.
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

	// No type tag string: treat as an argument-less signal. TotalMix's "/"
	// heartbeat can arrive this way.
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
		// Unparseable argument: keep what we have rather than dropping the whole
		// message, since the address alone is often actionable.
		if (v === undefined) break;
		if (argCount === 0) value = v;
		argCount++;
	}

	out.push({ address, value, argCount });
}

function parseInto(buf: Buffer, out: OscMessage[], depth: number): void {
	if (depth > MAX_BUNDLE_DEPTH || buf.length < 4) return;

	if (buf.length >= 8 && buf.toString("latin1", 0, 8) === BUNDLE_TAG) {
		// 8 bytes "#bundle\0" + 8 byte timetag. The timetag is ignored: TotalMix
		// sends immediate bundles and we have no use for scheduling.
		let pos = 16;

		while (pos + 4 <= buf.length) {
			const size = buf.readInt32BE(pos);
			pos += 4;
			// Guard against a negative or oversized length claiming more than the
			// datagram holds — the classic malformed-packet read overrun.
			if (size <= 0 || pos + size > buf.length) return;
			parseInto(buf.subarray(pos, pos + size), out, depth + 1);
			pos += size;
		}
		return;
	}

	if (buf[0] !== 0x2f /* '/' */) return;
	parseMessage(buf, out);
}

/**
 * Parses one UDP datagram into a flat list of messages (bundles flattened).
 *
 * Never throws. A truncated or corrupt datagram yields whatever was parsed before
 * the damage and then stops
 */
export function parsePacket(buf: Buffer): OscMessage[] {
	const out: OscMessage[] = [];
	try {
		parseInto(buf, out, 0);
	} catch {
		// Defensive: the code above is bounds-checked, but a listener must never
		// die on input it did not expect.
	}
	return out;
}

function writeString(s: string): Buffer {
	const raw = Buffer.from(s, "utf8");
	const buf = Buffer.alloc(pad4(raw.length + 1));
	raw.copy(buf, 0);
	return buf;
}

/**
 * Builds a single message with one float argument — the only form TotalMix needs
 * for faders, toggles and navigation.
 */
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
 * Sends 1.0, which is how every kOSCScaleToggle parameter is flipped. Deliberately
 * does not read current state: the toggle semantics make a read-modify-write both
 * unnecessary and racy.
 */
export const encodeToggle = (address: string): Buffer => encodeFloat(address, 1.0);
