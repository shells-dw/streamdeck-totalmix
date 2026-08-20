/**
 * Property-inspector values arrive as strings.
 *
 * sdpi-textfield and sdpi-range persist what the DOM gives them, so a port typed
 * as 9001 is stored as "9001" and a slider position as "3". The action settings
 * types in this codebase say `number` — which is what we want to work with, but
 * not what we receive. Every numeric setting must pass through here at the point
 * of use.
 *
 * This is not cosmetic. A string port makes `connect()` believe the port changed
 * on every action appearance ("9001" !== 9001), tearing down and reopening the
 * shared socket each time — and a send racing a mid-close socket throws, killing
 * the key press silently.
 */

export function num(v: unknown, fallback: number): number {
	if (typeof v === "number" && Number.isFinite(v)) return v;
	if (typeof v === "string" && v.trim() !== "") {
		const n = Number(v);
		if (Number.isFinite(n)) return n;
	}
	return fallback;
}

export function str(v: unknown, fallback: string): string {
	return typeof v === "string" && v.trim() !== "" ? v.trim() : fallback;
}

/** Connection fields shared by every action's settings. */
export interface ConnectionSettings {
	host?: unknown;
	sendPort?: unknown;
	receivePort?: unknown;
}

export function connectionOptions(s: ConnectionSettings): {
	host: string;
	sendPort: number;
	receivePort: number;
} {
	return {
		host: str(s.host, "127.0.0.1"),
		sendPort: num(s.sendPort, 7001),
		receivePort: num(s.receivePort, 9001),
	};
}
