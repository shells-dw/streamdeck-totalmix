import streamDeck, {
	action,
	SingletonAction,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	type SendToPluginEvent,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";
import { asBool } from "../osc/codec.js";
import * as addr from "../totalmix/addresses.js";
import { iconFor } from "../totalmix/icons.js";
import { totalMix } from "../totalmix/connection.js";
import { connectionOptions, num } from "../totalmix/settings.js";
import { replyStripDatasource } from "../totalmix/datasource.js";

export type ToggleSettings = {
	/** Which parameter to flip. */
	parameter?: ToggleParameter;
	/** 1-based strip within the current bank, for the per-strip parameters. */
	strip?: number;
	/** Group or snapshot number (1-4 / 1-8), for those parameters. */
	index?: number;
	/** Optional: select this bus before acting, so strip numbers are predictable. */
	bus?: "input" | "playback" | "output" | "";
	/** Optional: pin the bank start (channel index, 0-based) before acting. */
	bankStart?: number | string;
	host?: string;
	sendPort?: number;
	receivePort?: number;
};

export type ToggleParameter =
	| "mainDim"
	| "mainMono"
	| "mainMuteFx"
	| "mainSpeakerB"
	| "mainTalkback"
	| "mainExtIn"
	| "mainRecall"
	| "globalMute"
	| "globalSolo"
	| "trim"
	| "stripMute"
	| "stripSolo"
	| "stripPhantom"
	| "stripCue"
	| "channelMute"
	| "channelSolo"
	| "channelPhantom"
	| "channelEq"
	| "channelLowcut"
	| "channelComp"
	| "muteGroup"
	| "soloGroup"
	| "faderGroup"
	| "snapshot"
	| "reverb"
	| "echo"
	| "roomEq";

/**
 * Generic on/off control.
 *
 * Two scale types hide behind these parameters, per RME's table, and they need
 * opposite treatment:
 *
 * - kOSCScaleToggle (main/global/page-2/groups): sending 1.0 FLIPS the state and
 *   TotalMix reports the result. No read needed, no race with the GUI.
 * - kOSCScaleOnOff (page-1 per-strip mute/solo/phantom/cue): sending 1.0 means
 *   SET ON, 0.0 means SET OFF. To toggle, the cached state must be read and the
 *   inverse sent. Sending 1.0 here just re-mutes forever
 */
/** Page-1 per-strip parameters use kOSCScaleOnOff — see class comment. */
const ONOFF_PARAMETERS: ReadonlySet<ToggleParameter> = new Set([
	"stripMute",
	"stripSolo",
	"stripPhantom",
	"stripCue",
]);

@action({ UUID: "de.shells.totalmix.toggle" })
export class Toggle extends SingletonAction<ToggleSettings> {
	private readonly cleanup = new Map<string, Array<() => void>>();

	override async onWillAppear(ev: WillAppearEvent<ToggleSettings>): Promise<void> {
		await this.setup(ev.action, ev.payload.settings);
	}

	/**
	 * Settings changes arrive as their own event, not as a re-appear. Without this
	 * handler the action keeps the address and icons captured at appearance — so a
	 * dropdown change would keep showing (and toggling!) the previous parameter
	 * until the profile switches.
	 */
	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<ToggleSettings>): Promise<void> {
		await this.setup(ev.action, ev.payload.settings);
	}

	private async setup(
		target: WillAppearEvent<ToggleSettings>["action"],
		settings: ToggleSettings,
	): Promise<void> {
		await totalMix.connect(connectionOptions(settings));

		const address = this.addressFor(settings);

		const icons = iconFor(settings.parameter ?? "mainDim");

		const render = (): void => {
			const on = asBool(totalMix.get(address) ?? 0);

			// setState exists on keys only; a dial-placed toggle shows text instead.
			if (target.isKey()) {
				// The manifest can only declare one generic On/Off pair, so the
				// parameter-specific artwork is applied here.
				void target.setImage(on ? icons.on : icons.off);
				void target.setState(on ? 1 : 0);
			} else {
				void target.setFeedback({ value: on ? "On" : "Off" });
			}
		};

		// Releasing first is what makes this safe to call on every settings
		// change: the old address's subscription is dropped before the new one
		// is added, so a re-parametered button cannot be driven by both.
		this.releaseFor(target.id);
		this.cleanup.set(target.id, [
			totalMix.subscribe(address, render),
			totalMix.onConnectionChange(render),
		]);

		render();
	}

	override onWillDisappear(ev: WillDisappearEvent<ToggleSettings>): void {
		this.releaseFor(ev.action.id);
	}

	override async onSendToPlugin(ev: SendToPluginEvent<{ event?: string }, ToggleSettings>): Promise<void> {
		if (ev.payload?.event !== "getStrips") return;
		const settings = await ev.action.getSettings();
		await replyStripDatasource("getStrips", settings, false);
	}

	override onKeyDown(ev: KeyDownEvent<ToggleSettings>): void {
		const parameter = ev.payload.settings.parameter ?? "mainDim";
		const address = this.addressFor(ev.payload.settings);

		// Strip parameters address "the Nth fader currently shown" relative to
		// bus and bank. Pinning both first turns a relative button into an
		// absolute one: same channel every time, regardless of where the mixer
		// was left. Messages are sent back-to-back; TotalMix processes in order.
		if (ONOFF_PARAMETERS.has(parameter)) {
			const s = ev.payload.settings;
			if (s.bus === "input" || s.bus === "playback" || s.bus === "output") {
				totalMix.toggle(addr.bus(s.bus));
			}
			if (s.bankStart !== undefined && String(s.bankStart).trim() !== "") {
				totalMix.send(addr.SET_BANK_START, num(s.bankStart, 0));
			}
		}

		if (ONOFF_PARAMETERS.has(parameter)) {
			// kOSCScaleOnOff: the value IS the state. Invert what we last saw;
			// with no cached state yet, turn on (matches user intent on a first
			// press far more often than a silent no-op).
			const next = asBool(totalMix.get(address) ?? 0) ? 0 : 1;
			streamDeck.logger.info(`Key press: set ${address} = ${next}`);
			totalMix.send(address, next);
			return;
		}

		streamDeck.logger.info(`Key press: toggle ${address}`);
		totalMix.toggle(address);
	}

	private addressFor(settings: ToggleSettings): string {
		const strip = num(settings.strip, 1);
		const index = num(settings.index, 1);

		switch (settings.parameter ?? "mainDim") {
			case "mainDim":
				return addr.MAIN_DIM;
			case "mainMono":
				return addr.MAIN_MONO;
			case "mainMuteFx":
				return addr.MAIN_MUTE_FX;
			case "mainSpeakerB":
				return addr.MAIN_SPEAKER_B;
			case "mainTalkback":
				return addr.MAIN_TALKBACK;
			case "mainExtIn":
				return addr.MAIN_EXT_IN;
			case "mainRecall":
				return addr.MAIN_RECALL;
			case "globalMute":
				return addr.GLOBAL_MUTE;
			case "globalSolo":
				return addr.GLOBAL_SOLO;
			case "trim":
				return addr.TRIM;
			case "stripMute":
				return addr.mute(strip);
			case "stripSolo":
				return addr.solo(strip);
			case "stripPhantom":
				return addr.phantom(strip);
			case "stripCue":
				return addr.cue(strip);
			case "channelMute":
				return addr.CH_MUTE;
			case "channelSolo":
				return addr.CH_SOLO;
			case "channelPhantom":
				return addr.CH_PHANTOM;
			case "channelEq":
				return addr.CH_EQ_ENABLE;
			case "channelLowcut":
				return addr.CH_LOWCUT_ENABLE;
			case "channelComp":
				return addr.CH_COMP_ENABLE;
			case "muteGroup":
				return addr.muteGroup(index);
			case "soloGroup":
				return addr.soloGroup(index);
			case "faderGroup":
				return addr.faderGroup(index);
			case "snapshot":
				return addr.snapshot(index);
			case "reverb":
				return addr.REVERB_ENABLE;
			case "echo":
				return addr.ECHO_ENABLE;
			case "roomEq":
				// Page 4; sending it also selects the Output bus per RME's table.
				return addr.ROOM_EQ_ENABLE;
		}
	}

	private releaseFor(id: string): void {
		const unsubs = this.cleanup.get(id);
		if (unsubs === undefined) return;
		for (const fn of unsubs) fn();
		this.cleanup.delete(id);
	}
}
