import streamDeck from "@elgato/streamdeck";
import * as addr from "./addresses.js";
import type { TotalMixConnection } from "./connection.js";
import { num } from "./settings.js";

/**
 * sdpi-components datasource protocol: the PI sends { event }, the plugin
 * replies { event, items: [{ value, label }] }.
 */

/** Extracts the datasource event name; the PI payload shape has varied. */
export function datasourceEvent(payload: unknown): string | undefined {
	if (typeof payload === "string") return payload;
	if (payload && typeof payload === "object") {
		const p = payload as { event?: unknown; payload?: { event?: unknown } };
		if (typeof p.event === "string") return p.event;
		if (p.payload && typeof p.payload.event === "string") return p.payload.event;
	}
	return undefined;
}

/**
 * Replies with the 24 page-1 strips, labelled with cached tracknames. Pins
 * bus/bank first when the settings name them, then waits for the page dump.
 */
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
