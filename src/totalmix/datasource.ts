import streamDeck from "@elgato/streamdeck";
import * as addr from "./addresses.js";
import type { TotalMixConnection } from "./connection.js";
import { num } from "./settings.js";

/**
 * Supplies the property inspector's strip dropdown with real channel names.
 *
 * sdpi-components' datasource protocol: the PI sends { event: "<name>" } via
 * sendToPlugin, and expects { event: "<name>", items: [{ value, label }] } back.
 * We answer with the tracknames TotalMix mirrors for the visible bank, so the
 * user picks "3 · Phones" instead of guessing that Phones is fader 3.
 *
 * If the action pins a bus/bank, that view is asserted first and given a moment
 * to arrive, so the listed names match what the button will actually control.
 * Strips TotalMix hasn't named (or beyond the mirrored bank) fall back to plain
 * numbers — the dropdown is never worse than the slider it replaces.
 */
/**
 * Extracts the datasource event name from whatever shape the PI sent. sdpi's
 * exact payload framing has varied ("getStrips" bare, { event }, or nested), and
 * a mismatch here silently kills the dropdown, so accept all of them.
 */
export function datasourceEvent(payload: unknown): string | undefined {
	if (typeof payload === "string") return payload;
	if (payload && typeof payload === "object") {
		const p = payload as { event?: unknown; payload?: { event?: unknown } };
		if (typeof p.event === "string") return p.event;
		if (p.payload && typeof p.payload.event === "string") return p.payload.event;
	}
	return undefined;
}

export async function replyStripDatasource(
	tm: TotalMixConnection,
	event: string,
	settings: { bus?: unknown; bankStart?: unknown },
	forceInputBus: boolean,
): Promise<void> {
	const bus = forceInputBus ? "input" : settings.bus;
	if (bus === "input" || bus === "playback" || bus === "output") {
		tm.toggle(addr.bus(bus));
	}
	if (settings.bankStart !== undefined && String(settings.bankStart).trim() !== "") {
		tm.send(addr.SET_BANK_START, num(settings.bankStart, 0));
	}

	// Give the page re-send triggered by the pin a moment to land in the cache.
	await new Promise((r) => setTimeout(r, 250));

	const items = [];
	for (let i = 1; i <= 24; i++) {
		const name = tm.getString(addr.trackName(i));
		items.push({ value: String(i), label: name ? `${i} · ${name}` : `Strip ${i}` });
	}

	const named = items.filter((i) => i.label.includes("·")).length;
	streamDeck.logger.info(`Datasource reply: ${items.length} strips, ${named} with names`);
	await streamDeck.ui.sendToPropertyInspector({ event, items });
}
