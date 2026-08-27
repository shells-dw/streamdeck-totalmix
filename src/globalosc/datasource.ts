import streamDeck from "@elgato/streamdeck";
import { asBool } from "../osc/codec.js";
import { num, str } from "../totalmix/settings.js";
import * as g from "./addresses.js";
import type { GlobalConnection } from "./connection.js";

/**
 * Connection settings for global actions. Same shape as the classic helper but
 * with the Global OSC slot's defaults (TotalMix Remote Controller 2: 7002/9002),
 * so classic and global buttons coexist on separate sockets out of the box.
 */
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

/** Channels to list when TotalMix has not (yet) told us anything. */
const FALLBACK_CHANNEL_COUNT = 24;

/**
 * Builds the channel dropdown for a bus from what TotalMix actually sent after
 * /sendall: names from /{bus}/{n}/name, stereo-ness from /{bus}/{n}/stereo.
 *
 * Values are the 0-based wire channel numbers the protocol wants; labels show
 * the 1-based numbers users see in TotalMix (the table's own example reads
 * "/output/2/faderlin sets fader of output 2 (channel 3)").
 *
 * Stereo pairs are addressed by their left number, so right halves are hidden —
 * except when includeRightHalves is set (for the L/R-split parameters phase and
 * gain, where right = left + 1 is a real, separately addressable target).
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
			// The pair's right half occupies the next number; skip it so the loop
			// doesn't list it a second time as an unnamed mono channel.
			n++;
		}
	}
	return items;
}

/**
 * Same datasource plumbing as the classic actions: the PI sends { event }, the
 * plugin replies
 * { event, items }. The connection is primed via /sendall on connect; the short
 * wait lets a just-opened socket's dump land before the list is built.
 */
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
