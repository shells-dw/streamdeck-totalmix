/**
 * Setting coercion. The property inspector stores DOM values, so numeric
 * settings arrive as strings ("9001"); every numeric read goes through num().
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

/** Classic OSC slot defaults: TotalMix Remote Controller 1 (7001/9001). */
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
