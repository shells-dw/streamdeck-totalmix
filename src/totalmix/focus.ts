import * as addr from "./addresses.js";
import type { TotalMixConnection, ViewRequirement } from "./connection.js";
import { num } from "./settings.js";

/**
 * Channel selection for page-2/4 parameters. Those addresses carry no channel
 * number; the channel is bus + /setBankStart + /setOffsetInBank (in faders).
 */

/** Setting value meaning "act on the channel TotalMix has selected". */
export const FOLLOW = "follow";

export const ALL_BUSES = ["input", "playback", "output"] as const;
/** Bus restrictions per the RME table; since 1.96 TotalMix re-sends 0 for non-applicable parameters. */
export const INPUTS_ONLY = ["input"] as const;
export const OUTPUTS_ONLY = ["output"] as const;
export const SOURCES = ["input", "playback"] as const;

/** Settings subset that decides the channel. */
export interface ChannelPin {
	bus?: unknown;
	bankStart?: unknown;
	strip?: unknown;
}

/** Bus a button acts on, or FOLLOW when unset. An unsupported stored bus resolves to the first allowed one. */
export function resolveBus(s: ChannelPin, allowed: readonly addr.Bus[]): addr.Bus | typeof FOLLOW {
	if (s.bus === "input" || s.bus === "playback" || s.bus === "output") {
		return allowed.includes(s.bus) ? s.bus : (allowed[0] ?? "input");
	}
	return FOLLOW;
}

export function pinnedBus(s: ChannelPin): addr.Bus | undefined {
	return s.bus === "input" || s.bus === "playback" || s.bus === "output" ? s.bus : undefined;
}

export function pinnedBank(s: ChannelPin): number | undefined {
	return s.bankStart !== undefined && String(s.bankStart).trim() !== ""
		? num(s.bankStart, 0)
		: undefined;
}

/** Cache slice for the channel, or null when following TotalMix's selection. Bank only when pinned. */
export function channelView(s: ChannelPin, allowed: readonly addr.Bus[]): ViewRequirement | null {
	const bus = resolveBus(s, allowed);
	if (bus === FOLLOW) return null;
	const bank = pinnedBank(s);
	return {
		bus,
		...(bank !== undefined ? { bank } : {}),
		offset: Math.max(0, num(s.strip, 1) - 1),
	};
}

/**
 * Selects the bus and channel for a page-2 or page-4 write. Page 2 uses the
 * page-2 bus selector (moves the slot onto page 2); page 4 has none, so the
 * bus goes through page 1 and the caller's write moves the page. Bank start
 * is sent only when pinned, since it also moves the page-1 bank.
 */
export function focusChannel(
	tm: TotalMixConnection,
	s: ChannelPin,
	allowed: readonly addr.Bus[],
	page: 2 | 4 = 2,
): void {
	const req = channelView(s, allowed);
	if (req?.bus === undefined) return;
	if (page === 2) tm.sendOffPage(addr.busPage2(req.bus), 1.0);
	else tm.send(addr.bus(req.bus), 1.0);
	if (req.bank !== undefined) tm.send(addr.SET_BANK_START, req.bank);
	tm.send(addr.SET_OFFSET_IN_BANK, req.offset ?? 0);
}
