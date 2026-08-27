import streamDeck from "@elgato/streamdeck";
import { num, str } from "./settings.js";

/**
 * Default connection settings for newly added buttons, stored in Stream Deck's
 * global settings under the plugin UUID.
 *
 * Values are copied into a button's own settings on first appearance and are not
 * consulted for that button again. Connections are pooled per host+port pair, so
 * per-button connection settings allow different buttons to address different
 * Remote Controller slots; live global overrides would collapse that to one slot.
 */

/**
 * Raw shape as written by the property inspector.
 *
 * Fields are `unknown` because sdpi-textfield persists DOM values: a port typed
 * as 7001 arrives as the string "7001". num() and str() coerce at the point of
 * use.
 */
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
}

/** Which set of connection keys an action reads. */
export type Slot = "classic" | "global";

/**
 * Factory values, used when no default is set. These match TotalMix's
 * out-of-the-box Remote Controller ports.
 */
export const BUILT_IN = {
	classic: { host: "127.0.0.1", sendPort: 7001, receivePort: 9001 },
	global: { host: "127.0.0.1", sendPort: 7002, receivePort: 9002 },
	stepDb: 1.5,
} as const;

/** A resolved default set: concrete values, ready to write into a button. */
export interface ResolvedDefaults {
	host: string;
	sendPort: number;
	receivePort: number;
	stepDb: number;
}

/**
 * Cached read of the global settings blob. Holds the in-flight promise rather
 * than its result, so buttons appearing together share one websocket round trip.
 */
let cache: Promise<StoredDefaults> | null = null;

/** Whether the invalidation listener has been attached. */
let subscribed = false;

/**
 * Replaces the cache whenever Stream Deck pushes global settings, which it does
 * both in reply to a get and whenever the property inspector saves.
 */
function subscribe(): void {
	if (subscribed) return;
	subscribed = true;
	try {
		// The SDK generic requires JsonObject, which needs an index signature.
		// StoredDefaults has none, so the blob is read untyped and narrowed here.
		streamDeck.settings.onDidReceiveGlobalSettings((ev) => {
			cache = Promise.resolve((ev.settings ?? {}) as StoredDefaults);
		});
	} catch {
		// Without the event the cache lives until the plugin restarts.
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
				// A cached failure would pin every later button to the built-ins.
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
			}
		: {
				host: str(stored.defaultHost, base.host),
				sendPort: num(stored.defaultSendPort, base.sendPort),
				receivePort: num(stored.defaultReceivePort, base.receivePort),
				stepDb: num(stored.defaultStepDb, BUILT_IN.stepDb),
			};
}

/** Drops the cache. Used by tests. */
export function resetDefaultsCache(): void {
	cache = null;
	subscribed = false;
}

/** The part of an action needed to persist a seed. */
export interface SeedTarget {
	setSettings(settings: never): Promise<void>;
}

/** Optional fields to seed alongside the connection. */
export interface SeedOptions {
	/** Seed the dB-per-detent preference. Volume actions only. */
	stepDb?: boolean;
}

/**
 * Fills a button's absent connection fields from the stored defaults.
 *
 * `target` is mutated in place so the caller can use the seeded values in the
 * same pass rather than re-reading them and racing the write.
 *
 * Only `undefined` fields are set. An empty string is a cleared field and is
 * left alone, which also makes seeding idempotent across appearances.
 *
 * @returns Whether anything was written.
 */
export async function seedDefaults<T extends object>(
	action: SeedTarget,
	target: T,
	slot: Slot,
	opts: SeedOptions = {},
): Promise<boolean> {
	// Action settings interfaces have no index signature, so widen once here.
	const settings = target as Record<string, unknown>;

	const missing =
		settings.host === undefined ||
		settings.sendPort === undefined ||
		settings.receivePort === undefined ||
		(opts.stepDb === true && settings.stepDb === undefined);

	// An existing button reappearing: no websocket round trip needed.
	if (!missing) return false;

	const defaults = await getDefaults(slot);

	if (settings.host === undefined) settings.host = defaults.host;
	if (settings.sendPort === undefined) settings.sendPort = defaults.sendPort;
	if (settings.receivePort === undefined) settings.receivePort = defaults.receivePort;
	if (opts.stepDb === true && settings.stepDb === undefined) settings.stepDb = defaults.stepDb;

	await action.setSettings(settings as never);
	return true;
}
