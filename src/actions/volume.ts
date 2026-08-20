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
import { totalMix } from "../totalmix/connection.js";
import { connectionOptions, num } from "../totalmix/settings.js";
import { replyStripDatasource } from "../totalmix/datasource.js";

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
	/** Key placement only: whether a press nudges the value up or down. */
	nudge?: "up" | "down";
	/** Host/port overrides; normally taken from global settings. */
	host?: string;
	sendPort?: number;
	receivePort?: number;
};

const DEFAULT_STEP_DB = 1.5;

/** Re-pin bus/bank at most this often per action — once per gesture, not per tick. */
const PIN_INTERVAL_MS = 400;

/**
 * Gain is kOSCScaleLin01 over a device-dependent range, so exact dB-per-detent is
 * unknowable from our side. A typical RME preamp spans ~65 dB; stepping
 * stepDb/65 of the range per detent makes the dial feel like roughly the
 * configured dB, and the touchscreen always shows TotalMix's own Val string, so
 * the displayed number is truthful regardless of the device's real range.
 */
const GAIN_ASSUMED_RANGE_DB = 65;

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

const isFx = (t: string): t is FxTarget => t in FX_TARGETS;

/** FX dials step 2% of range per detent — fine enough for time/frequency knobs. */
const FX_STEP = 0.02;

/**
 * Computes the next wire value for any continuous target. Pure so it can be
 * tested without the SDK. Fader targets step in dB along RME's curve; gain and
 * FX step linearly by the given fraction of their range.
 */
export function computeNext(
	kind: "fader" | "gain" | "fx",
	current: number,
	ticks: number,
	dbStep: number,
	fxFraction: number,
): number {
	switch (kind) {
		case "fader":
			return stepDb(current, ticks * dbStep);
		case "gain":
			return Math.min(1, Math.max(0, current + (ticks * dbStep) / GAIN_ASSUMED_RANGE_DB));
		case "fx":
			return Math.min(1, Math.max(0, current + ticks * fxFraction));
	}
}

const kindOf = (target: string): "fader" | "gain" | "fx" =>
	isFx(target) ? "fx" : target === "gain" ? "gain" : "fader";

/**
 * Volume control for a key or a Stream Deck+ dial.
 *
 * Rotation steps a fixed number of dB rather than a fixed amount of the 0..1 wire
 * value, because the TotalMix fader curve is strongly non-linear — a linear step
 * moves 4.4x further in dB at the bottom of the throw than at the top.
 */
@action({ UUID: "de.shells.totalmix.volume" })
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
	private pinIfConfigured(id: string, settings: VolumeSettings): void {
		const target = settings.target ?? "main";
		if (target !== "strip" && target !== "gain") return; // FX targets need no pinning

		const now = Date.now();
		if (now - (this.lastPin.get(id) ?? 0) < PIN_INTERVAL_MS) return;
		this.lastPin.set(id, now);

		if (target === "gain") {
			// Gain only exists on the input bus — always pin it, ignoring any bus
			// setting, so the dial cannot silently tweak a playback/output strip.
			totalMix.toggle(addr.bus("input"));
		} else if (settings.bus === "input" || settings.bus === "playback" || settings.bus === "output") {
			totalMix.toggle(addr.bus(settings.bus));
		}
		if (settings.bankStart !== undefined && String(settings.bankStart).trim() !== "") {
			totalMix.send(addr.SET_BANK_START, num(settings.bankStart, 0));
		}
	}

	override async onWillAppear(ev: WillAppearEvent<VolumeSettings>): Promise<void> {
		await this.setup(ev.action, ev.payload.settings);
	}

	/** Re-run setup when the user changes settings in the property inspector. */
	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<VolumeSettings>): Promise<void> {
		await this.setup(ev.action, ev.payload.settings);
	}

	private async setup(
		target: WillAppearEvent<VolumeSettings>["action"],
		settings: VolumeSettings,
	): Promise<void> {
		await totalMix.connect(connectionOptions(settings));

		const address = this.addressFor(settings);
		const display = addr.displayOf(address);

		const render = (): void => {
			void this.render(target, settings);
		};

		const unsubs = [
			totalMix.subscribe(address, render),
			totalMix.subscribe(display, render),
			totalMix.onConnectionChange(render),
		];

		// Replace any subscriptions left over from a previous appearance or from
		// the previous settings — old-address subscriptions must not linger.
		this.releaseFor(target.id);
		this.cleanup.set(target.id, unsubs);

		render();
	}

	override onWillDisappear(ev: WillDisappearEvent<VolumeSettings>): void {
		this.releaseFor(ev.action.id);
	}

	override async onSendToPlugin(ev: SendToPluginEvent<{ event?: string }, VolumeSettings>): Promise<void> {
		if (ev.payload?.event !== "getStrips") return;
		const settings = await ev.action.getSettings();
		await replyStripDatasource("getStrips", settings, (settings.target ?? "main") === "gain");
	}

	override onDialRotate(ev: DialRotateEvent<VolumeSettings>): void {
		const settings = ev.payload.settings;
		this.pinIfConfigured(ev.action.id, settings);
		const address = this.addressFor(settings);
		const target = settings.target ?? "main";
		// Gain and FX have no step control in the PI: their ranges are device- or
		// parameter-defined, so a user-tuned dB step would be false precision.
		const perTick = target === "gain" ? DEFAULT_STEP_DB : num(settings.stepDb, DEFAULT_STEP_DB);

		const current = totalMix.getNumber(address, 0);
		const next = computeNext(kindOf(target), current, ev.payload.ticks, perTick, FX_STEP);

		// Coalesced: rotation fires far faster than TotalMix needs telling, and only
		// the latest position matters.
		totalMix.sendCoalesced(address, next);

		void this.render(ev.action, settings, next);
	}

	/** Pressing the dial mutes — the obvious gesture for a monitor level. */
	override onDialDown(ev: DialDownEvent<VolumeSettings>): void {
		this.pinIfConfigured(ev.action.id, ev.payload.settings);
		this.toggleMute(ev.payload.settings);
	}

	/**
	 * On a key (no dial), each press nudges the value by the configured step in
	 * the configured direction — the only way to set a level on non-+ decks.
	 * The step setting applies as dB for faders and gain, and as percentage
	 * points of range for FX. Mute on keys belongs to the Toggle action.
	 */
	override onKeyDown(ev: KeyDownEvent<VolumeSettings>): void {
		const settings = ev.payload.settings;
		this.pinIfConfigured(ev.action.id, settings);

		const target = settings.target ?? "main";
		const address = this.addressFor(settings);
		const ticks = (settings.nudge ?? "up") === "down" ? -1 : 1;
		const dbStep = num(settings.stepDb, DEFAULT_STEP_DB);

		const current = totalMix.getNumber(address, 0);
		const next = computeNext(kindOf(target), current, ticks, dbStep, dbStep / 100);

		streamDeck.logger.info(`Key press: nudge ${address} ${ticks > 0 ? "+" : "-"}${dbStep}`);
		totalMix.send(address, next);
		void this.render(ev.action, settings, next);
	}

	private toggleMute(settings: VolumeSettings): void {
		const target = settings.target ?? "main";

		if (isFx(target)) {
			// FX dials press-toggle their parameter's natural enable.
			totalMix.toggle(FX_TARGETS[target].press);
			return;
		}

		if (target === "main") {
			// Main out has no plain mute; dim is the equivalent monitoring gesture.
			totalMix.toggle(addr.MAIN_DIM);
			return;
		}

		if (target === "channel") {
			totalMix.toggle(addr.CH_MUTE);
			return;
		}

		// "strip" and "gain" both press-mute the strip.
		// Per-strip mute is kOSCScaleOnOff, not a toggle: invert the cached state.
		const address = addr.mute(num(settings.strip, 1));
		totalMix.send(address, asBool(totalMix.get(address) ?? 0) ? 0 : 1);
	}

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
	 * Prefers TotalMix's own "...Val" display string over a locally computed one:
	 * TotalMix is authoritative about how it formats a level, and matching it keeps
	 * the Stream Deck consistent with the on-screen mixer.
	 */
	private async render(
		target: WillAppearEvent<VolumeSettings>["action"] | DialAction<VolumeSettings>,
		settings: VolumeSettings,
		override?: number,
	): Promise<void> {
		const address = this.addressFor(settings);
		const value = override ?? totalMix.getNumber(address, 0);
		const tgt = settings.target ?? "main";
		const isGain = tgt === "gain";
		// The Val string is TotalMix's own formatting and, for gain, the only
		// truthful display — our 0..1 value has no fixed dB meaning there. Gain
		// is shown as a bare whole number ("60" not "60.0 dB"): preamps step in
		// integers, so the decimals and unit are noise on a small screen.
		const raw = totalMix.getString(addr.displayOf(address));
		const label =
			raw !== undefined
				? isGain
					? formatGain(raw)
					: raw
				: isGain || isFx(tgt)
					? `${Math.round(value * 100)} %`
					: formatDb(value);
		const name = this.labelFor(settings);

		if (target.isDial()) {
			await target.setFeedback({
				title: name,
				value: totalMix.connected ? label : "—",
				indicator: { value: faderToBar(value) },
			});
			return;
		}

		await target.setTitle(totalMix.connected ? label : "—");
	}

	private labelFor(settings: VolumeSettings): string {
		const target = settings.target ?? "main";
		switch (target) {
			case "main":
				return "Main";
			case "channel":
				return totalMix.getString(addr.CH_TRACK_NAME) ?? "Channel";
			case "strip":
				return (
					totalMix.getString(addr.trackName(num(settings.strip, 1))) ??
					`Strip ${num(settings.strip, 1)}`
				);
			case "gain":
				return (
					totalMix.getString(addr.trackName(num(settings.strip, 1))) ??
					`Gain ${num(settings.strip, 1)}`
				);
			default:
				return isFx(target) ? FX_TARGETS[target].label : "Main";
		}
	}

	private releaseFor(id: string): void {
		const unsubs = this.cleanup.get(id);
		if (unsubs === undefined) return;
		for (const fn of unsubs) fn();
		this.cleanup.delete(id);
	}
}

/**
 * Reduces TotalMix's gain Val string ("60.0 dB") to a bare whole number ("60").
 * Falls back to the original string when no number is found, so odd device
 * formats degrade to showing exactly what TotalMix sent.
 */
export function formatGain(val: string): string {
	const m = val.match(/-?\d+(?:\.\d+)?/);
	return m ? String(Math.round(Number(m[0]))) : val;
}

/** Reads a numeric OSC value defensively; exported for tests. */
export const readLevel = (v: unknown): number => asNumber(v as never);
