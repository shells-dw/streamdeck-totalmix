import streamDeck, {
	action,
	SingletonAction,
	type DialAction,
	type DialDownEvent,
	type DialRotateEvent,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	type SendToPluginEvent,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";
import { asBool, asNumber } from "../osc/codec.js";
import { faderToBar, formatDb, stepDb } from "../osc/curves.js";
import * as addr from "../totalmix/addresses.js";
import { totalMixFor, type TotalMixConnection } from "../totalmix/connection.js";
import { seedDefaults } from "../totalmix/defaults.js";
import { computeNext, formatGain, FX_STEP } from "../osc/steps.js";
import { gainRangeDb } from "../totalmix/devices.js";
import { connectionOptions, num } from "../totalmix/settings.js";
import { datasourceEvent, replyStripDatasource } from "../totalmix/datasource.js";

export type VolumeSettings = {
	/** What to control. "main" is the Control Room main out; "gain" is the input
	 *  preamp of a strip (input bus only); "fx*" are the effects parameters. */
	target?: "main" | "strip" | "channel" | "gain" | FxTarget;
	/** 1-based strip within the current bank, when target is "strip". */
	strip?: number;
	/** Optional: select this bus before acting, so strip numbers are predictable. */
	bus?: "input" | "playback" | "output" | "";
	/** Optional: pin the bank start (channel index, 0-based) before acting. */
	bankStart?: number | string;
	/** dB moved per dial detent, or per key press. */
	stepDb?: number;
	/** RME device id, for the gain span. Empty or "auto" means detect. */
	device?: string;
	/** Key placement only: whether a press nudges the value up or down. */
	nudge?: "up" | "down";
	/** Host/port overrides; normally taken from global settings. */
	host?: string;
	sendPort?: number;
	receivePort?: number;
};

/** Step per detent when the user has not set one. Coarse enough to cross the throw in a few turns, fine enough to trim a monitor level. */
const DEFAULT_STEP_DB = 1.5;

/** Re-pin bus/bank at most this often per action — once per gesture, not per tick. */
const PIN_INTERVAL_MS = 400;

export type FxTarget = keyof typeof FX_TARGETS;

/**
 * Continuous FX parameters, all linear 0..1 on the wire (lowcut frequency is on
 * TotalMix's log curve, but as we step the wire value and display TotalMix's own
 * Val string, the same linear stepping applies cleanly). Press toggles the
 * parameter's natural enable. Displays use the Val string, so units (ms, Hz, %)
 * are always TotalMix's truth.
 */
const FX_TARGETS = {
	fxReverbSend: { address: addr.CH_REVERB_SEND, press: addr.REVERB_ENABLE, label: "Rev Send" },
	fxReverbReturn: { address: addr.CH_REVERB_RETURN, press: addr.REVERB_ENABLE, label: "Rev Return" },
	fxReverbVolume: { address: addr.REVERB_VOLUME, press: addr.REVERB_ENABLE, label: "Reverb Vol" },
	fxReverbTime: { address: addr.REVERB_TIME, press: addr.REVERB_ENABLE, label: "Rev Time" },
	fxReverbPredelay: { address: addr.REVERB_PREDELAY, press: addr.REVERB_ENABLE, label: "Predelay" },
	fxReverbWidth: { address: addr.REVERB_WIDTH, press: addr.REVERB_ENABLE, label: "Rev Width" },
	fxEchoVolume: { address: addr.ECHO_VOLUME, press: addr.ECHO_ENABLE, label: "Echo Vol" },
	fxEchoDelay: { address: addr.ECHO_DELAY, press: addr.ECHO_ENABLE, label: "Echo Delay" },
	fxEchoFeedback: { address: addr.ECHO_FEEDBACK, press: addr.ECHO_ENABLE, label: "Feedback" },
	fxLowcutFreq: { address: addr.CH_LOWCUT_FREQ, press: addr.CH_LOWCUT_ENABLE, label: "Low Cut" },
} as const;

/** Narrows a settings string to an FX target, so FX_TARGETS can be indexed safely. */
const isFx = (t: string): t is FxTarget => t in FX_TARGETS;

/**
 * Which stepping law a target obeys. Only mix faders follow RME's dB curve;
 * gain and FX are linear on the wire, and applying the fader curve to them
 * would make their steps wrong at both ends of the range.
 */
const kindOf = (target: string): "fader" | "gain" | "fx" =>
	isFx(target) ? "fx" : target === "gain" ? "gain" : "fader";

/**
 * Volume control for a key or a Stream Deck+ dial.
 *
 * Rotation steps a fixed number of dB rather than a fixed amount of the 0..1 wire
 * value, because the TotalMix fader curve is strongly non-linear — a linear step
 * moves 4.4x further in dB at the bottom of the throw than at the top.
 */
@action({ UUID: "de.shellsdw.totalmix2.volume" })
export class Volume extends SingletonAction<VolumeSettings> {
	/** Unsubscribe callbacks, keyed by action id, released on disappear. */
	private readonly cleanup = new Map<string, Array<() => void>>();

	/** Last bus/bank pin per action id, to rate-limit pinning during dial bursts. */
	private readonly lastPin = new Map<string, number>();

	/**
	 * Strip addresses are relative to bus and bank. When the settings pin either,
	 * assert them before acting — but during a dial burst only on the first tick
	 * of the gesture, since rotation events arrive far faster than the view can
	 * meaningfully change underneath them.
	 */
	private pinIfConfigured(
		tm: TotalMixConnection,
		id: string,
		settings: VolumeSettings,
		force = false,
	): void {
		const target = settings.target ?? "main";
		if (target !== "strip" && target !== "gain") return; // FX targets need no pinning

		const now = Date.now();
		if (!force && now - (this.lastPin.get(id) ?? 0) < PIN_INTERVAL_MS) return;
		this.lastPin.set(id, now);

		if (target === "gain") {
			// Gain only exists on the input bus — always pin it, ignoring any bus
			// setting, so the dial cannot silently tweak a playback/output strip.
			tm.toggle(addr.bus("input"));
		} else if (settings.bus === "input" || settings.bus === "playback" || settings.bus === "output") {
			tm.toggle(addr.bus(settings.bus));
		}
		if (settings.bankStart !== undefined && String(settings.bankStart).trim() !== "") {
			tm.send(addr.SET_BANK_START, num(settings.bankStart, 0));
		}
	}

	/**
	 * Seeds the user's saved defaults into a freshly placed button before wiring
	 * it up, so a new key inherits their host, ports and step rather than the
	 * factory ones.
	 */
	override async onWillAppear(ev: WillAppearEvent<VolumeSettings>): Promise<void> {
		await seedDefaults(ev.action, ev.payload.settings, "classic", { stepDb: true });
		await this.setup(ev.action, ev.payload.settings);
	}

	/** Re-run setup when the user changes settings in the property inspector. */
	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<VolumeSettings>): Promise<void> {
		await this.setup(ev.action, ev.payload.settings);
	}

	/**
	 * (Re)binds one button to the connection and addresses its settings imply.
	 *
	 * Runs on appear and on every settings change, so it must be idempotent: the
	 * previous subscriptions are released at the end, once the new ones exist.
	 */
	private async setup(
		target: WillAppearEvent<VolumeSettings>["action"],
		settings: VolumeSettings,
	): Promise<void> {
		const tm = totalMixFor(connectionOptions(settings));

		const address = this.addressFor(settings);
		const display = addr.displayOf(address);

		const render = (): void => {
			void this.render(tm, target, settings);
		};

		const unsubs = [
			tm.subscribe(address, render),
			tm.subscribe(display, render),
			tm.onConnectionChange(render),
		];

		// The title comes from trackname/channel-name addresses that arrive in
		// the page dump in their own order — often after this action's value.
		// Without subscribing to them, a name landing late never triggers a
		// re-render and the "Strip N" fallback sticks until something else moves.
		const tgt = settings.target ?? "main";
		if (tgt === "strip" || tgt === "gain") {
			unsubs.push(tm.subscribe(addr.trackName(num(settings.strip, 1)), render));
		} else if (tgt === "channel") {
			unsubs.push(tm.subscribe(addr.CH_TRACK_NAME, render));
		}

		// Register this dial's view for startup priming. The connection visits
		// every required view once, serially, filling each slice, so values and
		// names are prefilled without appear-time pin races.
		const startupReq = this.requiredView(settings);
		if (startupReq !== null) tm.requireView(startupReq);

		// Replace any subscriptions left over from a previous appearance or from
		// the previous settings — old-address subscriptions must not linger.
		this.releaseFor(target.id);
		this.cleanup.set(target.id, unsubs);

		render();
	}

	/** Drops subscriptions when the button leaves the screen — profile switches would otherwise accumulate them. */
	override onWillDisappear(ev: WillDisappearEvent<VolumeSettings>): void {
		this.releaseFor(ev.action.id);
	}

	/**
	 * Answers the property inspector's request for the channel dropdown, filling
	 * it from live cache so the user picks real channel names instead of numbers.
	 */
	override async onSendToPlugin(ev: SendToPluginEvent<{ event?: string }, VolumeSettings>): Promise<void> {
		// Always log what the PI sends: whether this line appears is the fact that
		// splits "request never arrives" from "reply is wrong" when the channel
		// dropdown misbehaves.
		streamDeck.logger.info(`PI -> plugin: ${JSON.stringify(ev.payload).slice(0, 160)}`);
		if (datasourceEvent(ev.payload) !== "getStrips") return;
		const settings = await ev.action.getSettings();
		const tm = totalMixFor(connectionOptions(settings));
		await replyStripDatasource(tm, "getStrips", settings, (settings.target ?? "main") === "gain");
	}

	/**
	 * Steps the value by the configured amount per detent — dB for faders and
	 * gain, a fixed fraction of range for FX — and repaints optimistically.
	 *
	 * Writes are coalesced, so spinning fast costs one datagram per tick window
	 * rather than one per detent.
	 */
	override onDialRotate(ev: DialRotateEvent<VolumeSettings>): void {
		const settings = ev.payload.settings;
		const tm = totalMixFor(connectionOptions(settings));
		const req = this.requiredView(settings);
		// Pin hard when the slot is parked elsewhere: the write below must land on
		// this dial's view, and message ordering guarantees the bus/bank selects
		// are processed first.
		this.pinIfConfigured(tm, ev.action.id, settings, req !== null && !tm.viewMatches(req));

		const target = settings.target ?? "main";
		const address = this.addressFor(settings);
		const perTick = target === "gain" ? DEFAULT_STEP_DB : num(settings.stepDb, DEFAULT_STEP_DB);

		// The value is read from this dial's view slice, retained per bus/bank, so
		// it is this channel's own last value even while the slot is parked
		// elsewhere. A flat cache would be wrong here: another bus's dump carries
		// zeros for micgain. Only a view that has never delivered data blocks the
		// gesture.
		if (tm.get(address, req) === undefined) {
			streamDeck.logger.warn(`Ignoring dial move on ${address}: no data for its view yet`);
			tm.requestFullRefresh();
			return;
		}

		const current = tm.getNumber(address, 0, req);
		const next = computeNext(
			kindOf(target),
			current,
			ev.payload.ticks,
			perTick,
			FX_STEP,
			gainRangeDb(settings.device),
		);

		// Coalesced: rotation fires far faster than TotalMix needs telling, and only
		// the latest position matters.
		tm.sendCoalesced(address, next);

		void this.render(tm, ev.action, settings, next);
	}

	/** Pressing the dial mutes — the obvious gesture for a monitor level. */
	override onDialDown(ev: DialDownEvent<VolumeSettings>): void {
		const tm = totalMixFor(connectionOptions(ev.payload.settings));
		this.pinIfConfigured(tm, ev.action.id, ev.payload.settings);
		this.toggleMute(tm, ev.payload.settings);
	}

	/**
	 * On a key (no dial), each press nudges the value by the configured step in
	 * the configured direction — the only way to set a level on non-+ decks.
	 * The step setting applies as dB for faders and gain, and as percentage
	 * points of range for FX. Mute on keys belongs to the Toggle action.
	 */
	override onKeyDown(ev: KeyDownEvent<VolumeSettings>): void {
		const settings = ev.payload.settings;
		const tm = totalMixFor(connectionOptions(settings));
		this.pinIfConfigured(tm, ev.action.id, settings);

		const target = settings.target ?? "main";
		const address = this.addressFor(settings);
		const ticks = (settings.nudge ?? "up") === "down" ? -1 : 1;
		const dbStep = num(settings.stepDb, DEFAULT_STEP_DB);

		// Same view scoping as dial rotation — see the comment there.
		const reqView = this.requiredView(settings);
		if (reqView !== null && !tm.viewMatches(reqView)) {
			this.pinIfConfigured(tm, ev.action.id, settings, true);
		}
		if (tm.get(address, reqView) === undefined) {
			streamDeck.logger.warn(`Ignoring nudge on ${address}: no data for its view yet`);
			tm.requestFullRefresh();
			return;
		}

		const current = tm.getNumber(address, 0, reqView);
		const next = computeNext(
			kindOf(target),
			current,
			ticks,
			dbStep,
			dbStep / 100,
			gainRangeDb(settings.device),
		);

		streamDeck.logger.info(`Key press: nudge ${address} ${ticks > 0 ? "+" : "-"}${dbStep}`);
		tm.sendOffPage(address, next);
		void this.render(tm, ev.action, settings, next);
	}

	/**
	 * The press gesture, whose meaning follows the target: each one's closest
	 * equivalent of "silence this", since not every target has a plain mute.
	 */
	private toggleMute(tm: TotalMixConnection, settings: VolumeSettings): void {
		const target = settings.target ?? "main";

		if (isFx(target)) {
			// FX dials press-toggle their parameter's natural enable.
			tm.toggle(FX_TARGETS[target].press);
			return;
		}

		if (target === "main") {
			// Main out has no plain mute; dim is the equivalent monitoring gesture.
			tm.toggle(addr.MAIN_DIM);
			return;
		}

		if (target === "channel") {
			tm.toggle(addr.CH_MUTE);
			return;
		}

		// "strip" and "gain" both press-mute the strip.
		// Per-strip mute is kOSCScaleOnOff, not a toggle: invert the cached state.
		const address = addr.mute(num(settings.strip, 1));
		tm.sendOffPage(address, asBool(tm.get(address) ?? 0) ? 0 : 1);
	}

	/**
	 * The OSC address this button controls. Falls back to main volume for an
	 * unrecognised target, so settings written by an older build stay harmless
	 * rather than addressing nothing.
	 */
	private addressFor(settings: VolumeSettings): string {
		const target = settings.target ?? "main";
		switch (target) {
			case "main":
				return addr.MAIN_VOLUME;
			case "channel":
				return addr.CH_VOLUME;
			case "strip":
				return addr.volume(num(settings.strip, 1));
			case "gain":
				return addr.micGain(num(settings.strip, 1));
			default:
				return isFx(target) ? FX_TARGETS[target].address : addr.MAIN_VOLUME;
		}
	}

	/**
	 * The view this action's settings require, or null if it needs no particular
	 * one.
	 *
	 * Gain is always input-bus regardless of the bus setting, because the preamp
	 * only exists there. Strips require a view only when the user pinned a bus or
	 * bank; unpinned, they follow whatever the slot shows, which is the point of
	 * leaving those settings empty. Main, channel and FX targets are not
	 * positional at all and so require nothing.
	 */
	private requiredView(settings: VolumeSettings): { bus?: "input" | "playback" | "output"; bank?: number } | null {
		const tgt = settings.target ?? "main";
		const bank =
			settings.bankStart !== undefined && String(settings.bankStart).trim() !== ""
				? num(settings.bankStart, 0)
				: undefined;

		if (tgt === "gain") {
			return bank !== undefined ? { bus: "input", bank } : { bus: "input" };
		}
		if (tgt === "strip") {
			const bus =
				settings.bus === "input" || settings.bus === "playback" || settings.bus === "output"
					? settings.bus
					: undefined;
			if (bus === undefined && bank === undefined) return null;
			return { ...(bus !== undefined ? { bus } : {}), ...(bank !== undefined ? { bank } : {}) };
		}
		return null;
	}

	/**
	 * Paints the key or dial from cache.
	 *
	 * Prefers TotalMix's own "...Val" display string over a locally computed one:
	 * TotalMix is authoritative about how it formats a level, and matching it keeps
	 * the Stream Deck consistent with the on-screen mixer.
	 *
	 * `override` is the value just written by a gesture, shown before TotalMix
	 * confirms it so the dial tracks the finger rather than the network.
	 */
	private async render(
		tm: TotalMixConnection,
		target: WillAppearEvent<VolumeSettings>["action"] | DialAction<VolumeSettings>,
		settings: VolumeSettings,
		override?: number,
	): Promise<void> {
		const address = this.addressFor(settings);
		const tgt = settings.target ?? "main";
		const isGain = tgt === "gain";

		// Reads are scoped to the view this dial REQUIRES, not whatever view is
		// current — retained values from its own bus keep showing (with the right
		// channel names) while another dial has the slot parked elsewhere. The
		// placeholder only appears when that view has never delivered data.
		const req = this.requiredView(settings);
		if (override === undefined && tm.get(address, req) === undefined) {
			if (target.isDial()) {
				await target.setFeedback({
					title: this.labelFor(tm, settings),
					value: "—",
					indicator: { value: 0 },
				});
			} else {
				await target.setTitle("—");
			}
			return;
		}

		const value = override ?? tm.getNumber(address, 0, req);
		// The Val string is TotalMix's own formatting and, for gain, the only
		// meaningful display: the 0..1 wire value has no fixed dB meaning. Gain
		// is rounded to a whole number and keeps its unit ("60 dB").
		const raw = tm.getString(addr.displayOf(address), req);
		const label =
			raw !== undefined
				? isGain
					? formatGain(raw)
					: raw
				: isGain || isFx(tgt)
					? `${Math.round(value * 100)} %`
					: formatDb(value);
		const name = this.labelFor(tm, settings);

		if (target.isDial()) {
			await target.setFeedback({
				title: name,
				value: tm.connected ? label : "—",
				indicator: { value: faderToBar(value) },
			});
			return;
		}

		await target.setTitle(tm.connected ? label : "—");
	}

	/**
	 * The title shown above the value. Prefers the channel name TotalMix
	 * reports — read through this action's own view, so it is this strip's name
	 * even when the slot is parked on another bus — and falls back to a
	 * positional label until that name arrives.
	 */
	private labelFor(tm: TotalMixConnection, settings: VolumeSettings): string {
		const req = this.requiredView(settings);
		const target = settings.target ?? "main";
		switch (target) {
			case "main":
				return "Main";
			case "channel":
				return tm.getString(addr.CH_TRACK_NAME) ?? "Channel";
			case "strip":
				return (
					tm.getString(addr.trackName(num(settings.strip, 1)), req) ??
					`Strip ${num(settings.strip, 1)}`
				);
			case "gain":
				return (
					tm.getString(addr.trackName(num(settings.strip, 1)), req) ??
					`Gain ${num(settings.strip, 1)}`
				);
			default:
				return isFx(target) ? FX_TARGETS[target].label : "Main";
		}
	}

	/** Runs and forgets one button's unsubscribe callbacks. Safe to call twice. */
	private releaseFor(id: string): void {
		const unsubs = this.cleanup.get(id);
		if (unsubs === undefined) return;
		for (const fn of unsubs) fn();
		this.cleanup.delete(id);
	}
}

/** Reads a numeric OSC value defensively; exported for tests. */
export const readLevel = (v: unknown): number => asNumber(v as never);

// Re-exported so tests can reach the stepping helpers through the action they
// belong to. Importing them from here rather than from osc/steps.js keeps the
// test asserting what this action actually uses.
export { computeNext, formatGain };
