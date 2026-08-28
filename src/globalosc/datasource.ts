import streamDeck from "@elgato/streamdeck";
import { asBool } from "../osc/codec.js";
import { num, str } from "../totalmix/settings.js";
import * as g from "./addresses.js";
import type { GlobalConnection } from "./connection.js";

/** Global OSC slot defaults: TotalMix Remote Controller 2 (7002/9002). */
export function globalConnectionOptions(s: {
	host?: unknown;
	sendPort?: unknown;
	receivePort?: unknown;
}): { host: string; sendPort: number; receivePort: number } {
	return {
		host: str(s.host, "127.0.0.1"),
		sendPort: num(s.sendPort, 7002),
		receivePort: num(s.receivePort, 9002),
	};
}

export type ChannelItem = { value: string; label: string };

/** Channel count assumed before any /{bus}/{n}/name has been received. */
const FALLBACK_CHANNEL_COUNT = 24;

/**
 * Channel dropdown items for one bus from cached /{bus}/{n}/name and
 * /{bus}/{n}/stereo. Values are 0-based wire numbers, labels 1-based.
 * Stereo right halves (n+1) are listed only when includeRightHalves is set,
 * for the L/R-split parameters.
 */
export function buildChannelItems(
	gm: GlobalConnection,
	bus: g.GlobalBus,
	includeRightHalves: boolean,
): ChannelItem[] {
	const namePattern = new RegExp(`^/${bus}/(\\d+)/name$`);
	let maxChannel = -1;
	for (const address of gm.addresses(namePattern)) {
		const m = namePattern.exec(address);
		if (m) maxChannel = Math.max(maxChannel, Number(m[1]));
	}
	if (maxChannel < 0) maxChannel = FALLBACK_CHANNEL_COUNT - 1;

	const items: ChannelItem[] = [];
	for (let n = 0; n <= maxChannel; n++) {
		const name = gm.getString(g.channelName(bus, n));
		const stereo = asBool(gm.get(g.channelStereo(bus, n)) ?? 0);

		items.push({ value: String(n), label: name ? `${n + 1} · ${name}` : `${n + 1}` });

		if (stereo) {
			if (includeRightHalves) {
				items.push({ value: String(n + 1), label: name ? `${n + 2} · ${name} (R)` : `${n + 2} (R)` });
			}
			n++;
		}
	}
	return items;
}

/** Datasource reply; the short wait lets a just-opened socket's /sendall dump land. */
export async function replyGlobalChannelDatasource(
	gm: GlobalConnection,
	event: string,
	bus: g.GlobalBus,
	includeRightHalves: boolean,
): Promise<void> {
	await new Promise((r) => setTimeout(r, 250));
	const items = buildChannelItems(gm, bus, includeRightHalves);
	const named = items.filter((i) => i.label.includes("·")).length;
	streamDeck.logger.info(
		`Global datasource reply (${event}, ${bus}): ${items.length} channels, ${named} named`,
	);
	await streamDeck.ui.sendToPropertyInspector({ event, items });
}
