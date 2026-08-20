import streamDeck from "@elgato/streamdeck";
import * as addr from "./addresses.js";
import { totalMix } from "./connection.js";
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
export async function replyStripDatasource(
	event: string,
	settings: { bus?: unknown; bankStart?: unknown },
	forceInputBus: boolean,
): Promise<void> {
	const bus = forceInputBus ? "input" : settings.bus;
	if (bus === "input" || bus === "playback" || bus === "output") {
		totalMix.toggle(addr.bus(bus));
	}
	if (settings.bankStart !== undefined && String(settings.bankStart).trim() !== "") {
		totalMix.send(addr.SET_BANK_START, num(settings.bankStart, 0));
	}

	// Give the page re-send triggered by the pin a moment to land in the cache.
	await new Promise((r) => setTimeout(r, 250));

	const items = [];
	for (let i = 1; i <= 24; i++) {
		const name = totalMix.getString(addr.trackName(i));
		items.push({ value: String(i), label: name ? `${i} · ${name}` : `Strip ${i}` });
	}

	await streamDeck.ui.sendToPropertyInspector({ event, items });
}
