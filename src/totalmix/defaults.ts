import streamDeck from "@elgato/streamdeck";
import { num, str } from "./settings.js";

/**
 * Per-user defaults for newly added buttons, held in Stream Deck's global
 * settings.
 *
 * The problem this solves: someone running TotalMix on another machine, or using
 * Remote Controller slots other than the factory ones, previously had to open the
 * Connection section and retype the same host and ports on every single button
 * they ever added. v3 answered that with de.shells.totalmix.exe.config, a file
 * inside the plugin folder — which Stream Deck replaces wholesale on every plugin
 * update, so the settings vanished and the README had to apologise for it.
 *
 * Global settings live in Stream Deck's own storage instead, keyed to the plugin
 * UUID. They survive updates, they are typed form fields rather than hand-edited
 * JSON, and there is no path to resolve and get wrong.
 *
 * SEED, NOT OVERRIDE. These values are copied into a button's own settings the
 * first time it appears, and never consulted for that button again. That is
 * deliberate: connections are pooled per host+port pair precisely so that
 * different buttons can address different Remote Controller slots — a dial parked
 * on slot 1 watching playback alongside one on slot 3 watching inputs. Treating
 * these as live global overrides would force every button onto one slot and undo
 * that. So changing a default here leaves existing buttons exactly as they are.
 */

/**
 * The raw shape as written by the property inspector.
 *
 * Every field is `unknown` on purpose: sdpi-textfield persists whatever the DOM
 * gives it, so a port typed as 7001 arrives as the string "7001". Nothing here is
 * trusted to be the type its name suggests — num() and str() do that work at the
 * point of use, exactly as they do for per-action settings.
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
 * Factory values, used when the user has set no default. These mirror TotalMix's
 * own out-of-the-box Remote Controller ports and the constants the actions
 * already fall back to, so behaviour with an empty defaults form is byte-for-byte
 * what it was before this module existed.
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
 * Cached read of the global settings blob.
 *
 * Without this, thirty buttons appearing on a profile switch would each make a
 * round trip over the Stream Deck websocket before they could connect. The cache
 * holds the in-flight promise rather than its result, so concurrent appearances
 * share one request.
 */
let cache: Promise<StoredDefaults> | null = null;

/** Whether the invalidation listener has been attached. */
let subscribed = false;

/**
 * Keeps the cache honest when the user edits the defaults form.
 *
 * Stream Deck emits didReceiveGlobalSettings both in reply to our own get and
 * whenever the property inspector saves, so the freshest blob is always pushed to
 * us and can simply replace what we hold.
 */
function subscribe(): void {
	if (subscribed) return;
	subscribed = true;
	try {
		// The SDK's generic is constrained to JsonObject, which requires an index
		// signature. StoredDefaults deliberately has none — the whole point is
		// that only these seven keys are ours — so read the blob untyped and
		// narrow here, which is honest about it being untrusted anyway.
		streamDeck.settings.onDidReceiveGlobalSettings((ev) => {
			cache = Promise.resolve((ev.settings ?? {}) as StoredDefaults);
		});
	} catch {
		// An SDK build without the event is not a reason to lose the feature;
		// the cache simply lives until the plugin restarts.
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
				// Never cache a failure: a transient websocket problem at startup
				// would otherwise pin every future button to the built-ins.
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

/** Drops the cache. Tests use this; the plugin has no reason to. */
export function resetDefaultsCache(): void {
	cache = null;
	subscribed = false;
}

/** The slice of an action this module needs in order to persist a seed. */
export interface SeedTarget {
	setSettings(settings: never): Promise<void>;
}

/** Fields a caller can opt into seeding beyond the connection. */
export interface SeedOptions {
	/** Seed the dB-per-detent preference too. Volume actions only. */
	stepDb?: boolean;
}

/**
 * Fills in a button's unset fields from the user's defaults, once.
 *
 * `settings` is mutated in place so the caller can carry straight on with the
 * seeded values in the same pass — the alternative, re-reading them, would race
 * the write and connect the button on the wrong port for its first moments.
 *
 * Only fields that are genuinely absent are touched. A button whose host is an
 * empty string has been deliberately cleared by its owner and is left alone,
 * which is also what stops a seeded button being re-seeded on its next
 * appearance.
 *
 * @returns Whether anything was written.
 */
export async function seedDefaults<T extends object>(
	action: SeedTarget,
	target: T,
	slot: Slot,
	opts: SeedOptions = {},
): Promise<boolean> {
	// The action settings interfaces declare their fields optionally rather than
	// via an index signature, so widen once here instead of casting at all seven
	// call sites.
	const settings = target as Record<string, unknown>;

	const missing =
		settings.host === undefined ||
		settings.sendPort === undefined ||
		settings.receivePort === undefined ||
		(opts.stepDb === true && settings.stepDb === undefined);

	// The common case by a wide margin: an existing button reappearing. Bail
	// before touching the websocket at all.
	if (!missing) return false;

	const defaults = await getDefaults(slot);

	if (settings.host === undefined) settings.host = defaults.host;
	if (settings.sendPort === undefined) settings.sendPort = defaults.sendPort;
	if (settings.receivePort === undefined) settings.receivePort = defaults.receivePort;
	if (opts.stepDb === true && settings.stepDb === undefined) settings.stepDb = defaults.stepDb;

	await action.setSettings(settings as never);
	return true;
}
