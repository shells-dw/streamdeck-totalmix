import streamDeck from "@elgato/streamdeck";
import { num, str } from "./settings.js";

/**
 * Defaults for newly added buttons, stored in Stream Deck global settings.
 * Copied into a button's own settings on first appearance only, so buttons
 * can still address different Remote Controller slots.
 */

/** Raw shape as written by the property inspector (DOM values, hence `unknown`). */
export interface StoredDefaults {
	/** Classic OSC slot (Remote Controller 1 by default). */
	defaultHost?: unknown;
	defaultSendPort?: unknown;
	defaultReceivePort?: unknown;

	/** Global OSC slot (Remote Controller 2 by default), TotalMix FX 2.1+. */
	defaultGlobalHost?: unknown;
	defaultGlobalSendPort?: unknown;
	defaultGlobalReceivePort?: unknown;

	/** dB per detent for new volume dials. */
	defaultStepDb?: unknown;

	/** Percent of range per detent for new effect-parameter dials. */
	defaultFxPercent?: unknown;

	/** dB per detent for new dials on the effect parameters displayed in dB. */
	defaultFxStepDb?: unknown;
}

/** Which set of connection keys an action reads. */
export type Slot = "classic" | "global";

/** Factory values: TotalMix's default Remote Controller ports. */
export const BUILT_IN = {
	classic: { host: "127.0.0.1", sendPort: 7001, receivePort: 9001 },
	global: { host: "127.0.0.1", sendPort: 7002, receivePort: 9002 },
	stepDb: 1.5,
	fxPercent: 2,
	fxStepDb: 1,
} as const;

/** Resolved default set. */
export interface ResolvedDefaults {
	host: string;
	sendPort: number;
	receivePort: number;
	stepDb: number;
	fxPercent: number;
	fxStepDb: number;
}

/** Cached global-settings read (the in-flight promise, shared by concurrent appearances). */
let cache: Promise<StoredDefaults> | null = null;

let subscribed = false;

/** Replaces the cache on every didReceiveGlobalSettings. */
function subscribe(): void {
	if (subscribed) return;
	subscribed = true;
	try {
		// SDK generic needs an index signature; narrowed here instead.
		streamDeck.settings.onDidReceiveGlobalSettings((ev) => {
			cache = Promise.resolve((ev.settings ?? {}) as StoredDefaults);
		});
	} catch {
		// Without the event the cache lives until restart.
	}
}

/** Reads the stored defaults, from cache where possible. */
export async function storedDefaults(): Promise<StoredDefaults> {
	subscribe();
	if (cache === null) {
		cache = streamDeck.settings
			.getGlobalSettings()
			.then((s) => s as StoredDefaults)
			.catch((err: unknown) => {
				cache = null;
				streamDeck.logger.warn(`Could not read global defaults: ${String(err)}`);
				return {} as StoredDefaults;
			});
	}
	return cache;
}

/** Resolves the defaults for one slot, applying built-ins where unset. */
export async function getDefaults(slot: Slot): Promise<ResolvedDefaults> {
	const stored = await storedDefaults();
	const base = BUILT_IN[slot];

	return slot === "global"
		? {
				host: str(stored.defaultGlobalHost, base.host),
				sendPort: num(stored.defaultGlobalSendPort, base.sendPort),
				receivePort: num(stored.defaultGlobalReceivePort, base.receivePort),
				stepDb: num(stored.defaultStepDb, BUILT_IN.stepDb),
				fxPercent: num(stored.defaultFxPercent, BUILT_IN.fxPercent),
				fxStepDb: num(stored.defaultFxStepDb, BUILT_IN.fxStepDb),
			}
		: {
				host: str(stored.defaultHost, base.host),
				sendPort: num(stored.defaultSendPort, base.sendPort),
				receivePort: num(stored.defaultReceivePort, base.receivePort),
				stepDb: num(stored.defaultStepDb, BUILT_IN.stepDb),
				fxPercent: num(stored.defaultFxPercent, BUILT_IN.fxPercent),
				fxStepDb: num(stored.defaultFxStepDb, BUILT_IN.fxStepDb),
			};
}

/** Drops the cache. Used by tests. */
export function resetDefaultsCache(): void {
	cache = null;
	subscribed = false;
}

/** Subset of an action needed to persist settings. */
export interface SeedTarget {
	setSettings(settings: never): Promise<void>;
}

/** Optional fields to seed alongside the connection. */
export interface SeedOptions {
	/** Seed stepDb (volume actions). */
	stepDb?: boolean;
	/** Seed fxPercent and fxStepDb (classic volume). */
	fxSteps?: boolean;
}

/**
 * Fills a button's `undefined` connection fields from the stored defaults;
 * `target` is mutated in place. Empty strings are left alone.
 * @returns Whether anything was written.
 */
export async function seedDefaults<T extends object>(
	action: SeedTarget,
	target: T,
	slot: Slot,
	opts: SeedOptions = {},
): Promise<boolean> {
	const settings = target as Record<string, unknown>;

	const missing =
		settings.host === undefined ||
		settings.sendPort === undefined ||
		settings.receivePort === undefined ||
		(opts.stepDb === true && settings.stepDb === undefined) ||
		(opts.fxSteps === true &&
			(settings.fxPercent === undefined || settings.fxStepDb === undefined));

	if (!missing) return false;

	const defaults = await getDefaults(slot);

	if (settings.host === undefined) settings.host = defaults.host;
	if (settings.sendPort === undefined) settings.sendPort = defaults.sendPort;
	if (settings.receivePort === undefined) settings.receivePort = defaults.receivePort;
	if (opts.stepDb === true && settings.stepDb === undefined) settings.stepDb = defaults.stepDb;
	if (opts.fxSteps === true) {
		if (settings.fxPercent === undefined) settings.fxPercent = defaults.fxPercent;
		if (settings.fxStepDb === undefined) settings.fxStepDb = defaults.fxStepDb;
	}

	await action.setSettings(settings as never);
	return true;
}
