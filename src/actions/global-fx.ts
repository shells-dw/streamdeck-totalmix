import streamDeck, {
	action,
	SingletonAction,
	type DialAction,
	type DialDownEvent,
	type DialRotateEvent,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	type SendToPluginEvent,
	type TouchTapEvent,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";
import { asBool } from "../osc/codec.js";
import * as g from "../globalosc/addresses.js";
import { globalMixFor, type GlobalConnection } from "../globalosc/connection.js";
import {
	globalConnectionOptions,
	replyGlobalChannelDatasource,
} from "../globalosc/datasource.js";
import {
	fxAddress,
	fxEnableAddress,
	fxStep,
	GLOBAL_FX,
	isFxKey,
	isLrSplit,
	isOffDb,
	positionName,
	stepSettingOf,
	type FxKey,
} from "../globalosc/fx.js";
import { datasourceEvent } from "../totalmix/datasource.js";
import { seedDefaults } from "../totalmix/defaults.js";
import { num } from "../totalmix/settings.js";
import { alertIfDown, forgetAlertState } from "./alert.js";
import { washFeedback } from "./wash.js";

export type GlobalFxSettings = {
	parameter?: FxKey;
	/** Bus for the per-channel parameters. */
	bus?: g.GlobalBus | "";
	/** 0-based channel for the per-channel parameters. */
	channel?: number | string;
	/**
	 * Step per detent or press, in the parameter's own unit. One field per
	 * slider in the inspector; which one applies comes from stepSettingOf.
	 */
	stepDb?: number | string;
	stepHz?: number | string;
	stepPositions?: number | string;
	stepFine?: number | string;
	stepTenth?: number | string;
	stepWhole?: number | string;
	stepTen?: number | string;
	/** Buttons created before the sliders existed carry a single step field. */
	step?: number | string;
	/** Key placement only: whether a press moves the value up or down. */
	nudge?: "up" | "down";
	host?: string;
	sendPort?: number;
	receivePort?: number;
};

const DEFAULT_PARAMETER: FxKey = "reverbVolume";

/** Global OSC effect, EQ, dynamics and Auto Level parameters, stepped in their own units. */
@action({ UUID: "de.shells.totalmixgen2.globalfx" })
export class GlobalFx extends SingletonAction<GlobalFxSettings> {
	private readonly cleanup = new Map<string, Array<() => void>>();

	override async onWillAppear(ev: WillAppearEvent<GlobalFxSettings>): Promise<void> {
		await seedDefaults(ev.action, ev.payload.settings, "global");
		await this.setup(ev.action, ev.payload.settings);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<GlobalFxSettings>): Promise<void> {
		await this.setup(ev.action, ev.payload.settings);
	}

	override onWillDisappear(ev: WillDisappearEvent<GlobalFxSettings>): void {
		this.releaseFor(ev.action.id);
		forgetAlertState(ev.action.id);
	}

	override async onSendToPlugin(
		ev: SendToPluginEvent<{ event?: string }, GlobalFxSettings>,
	): Promise<void> {
		if (datasourceEvent(ev.payload) !== "getChannels") return;
		const settings = await ev.action.getSettings();
		const gm = globalMixFor(globalConnectionOptions(settings));
		// L/R-split parameters (delay) list the right half of a stereo pair separately.
		await replyGlobalChannelDatasource(gm, "getChannels", this.busOf(settings), isLrSplit(this.keyOf(settings)));
	}

	private async setup(
		target: WillAppearEvent<GlobalFxSettings>["action"],
		settings: GlobalFxSettings,
	): Promise<void> {
		const gm = globalMixFor(globalConnectionOptions(settings));
		const address = this.addressFor(settings);
		const enable = this.enableFor(settings);

		const render = (): void => {
			void this.render(gm, target, settings);
		};

		const unsubs = [gm.subscribe(address, render), gm.onConnectionChange(render)];
		if (enable !== undefined) unsubs.push(gm.subscribe(enable, render));
		if (this.parameterOf(settings).scope === "channel") {
			unsubs.push(gm.subscribe(g.channelName(this.busOf(settings), this.channelOf(settings)), render));
		}

		this.releaseFor(target.id);
		this.cleanup.set(target.id, unsubs);

		if (target.isDial()) {
			void target.setTriggerDescription({
				rotate: "Adjust",
				push: "Switch the section on or off",
				touch: "Switch the section on or off",
			});
		}

		render();
	}

	override onDialRotate(ev: DialRotateEvent<GlobalFxSettings>): void {
		this.move(ev.action, ev.payload.settings, ev.payload.ticks);
	}

	override onKeyDown(ev: KeyDownEvent<GlobalFxSettings>): void {
		this.move(ev.action, ev.payload.settings, (ev.payload.settings.nudge ?? "up") === "down" ? -1 : 1);
	}

	override onDialDown(ev: DialDownEvent<GlobalFxSettings>): void {
		this.toggleSection(ev.action, ev.payload.settings);
	}

	override onTouchTap(ev: TouchTapEvent<GlobalFxSettings>): void {
		this.toggleSection(ev.action, ev.payload.settings);
	}

	/** Steps the parameter in its own unit; an unreported parameter steps from 0. */
	private move(
		target: DialAction<GlobalFxSettings> | KeyDownEvent<GlobalFxSettings>["action"],
		settings: GlobalFxSettings,
		ticks: number,
	): void {
		const gm = globalMixFor(globalConnectionOptions(settings));
		if (alertIfDown(target, gm)) return;

		const key = this.keyOf(settings);
		const address = this.addressFor(settings);
		const current = gm.getNumber(address, 0);
		const next = fxStep(key, current, ticks, this.stepFor(settings, key));

		gm.setCoalesced(address, next);
		void this.render(gm, target, settings, next);
	}

	/**
	 * Step for one detent: the slider belonging to this parameter, the legacy
	 * single field, then the table default. A zero or unparseable value would
	 * freeze the dial, so it falls through to the default as well.
	 */
	private stepFor(settings: GlobalFxSettings, key: FxKey): number {
		const fallback = GLOBAL_FX[key]!.step;
		const configured = num(settings[stepSettingOf(key)] ?? settings.step, fallback);
		return configured > 0 ? configured : fallback;
	}

	/** Press and touch flip the section enable. */
	private toggleSection(
		target: DialAction<GlobalFxSettings>,
		settings: GlobalFxSettings,
	): void {
		const gm = globalMixFor(globalConnectionOptions(settings));
		if (alertIfDown(target, gm)) return;
		const enable = this.enableFor(settings);
		if (enable !== undefined) gm.toggleSet(enable);
	}

	private async render(
		gm: GlobalConnection,
		target: WillAppearEvent<GlobalFxSettings>["action"] | DialAction<GlobalFxSettings>,
		settings: GlobalFxSettings,
		override?: number,
	): Promise<void> {
		const key = this.keyOf(settings);
		const address = this.addressFor(settings);
		const raw = override ?? gm.get(address);

		const label = raw === undefined || !gm.connected ? "—" : this.format(key, Number(raw));

		if (!target.isDial()) {
			await target.setTitle(label);
			return;
		}

		const enable = this.enableFor(settings);
		const lit = enable !== undefined && asBool(gm.get(enable) ?? 0);

		await target.setFeedback(
			washFeedback(this.titleFor(gm, settings), label, 0, gm.connected && lit ? "fxOn" : "none"),
		);
	}


	private format(key: FxKey, value: number): string {
		switch (GLOBAL_FX[key]!.unit) {
			case "db":
				// TotalMix reports off as an under-range level (-300 dB and similar).
				return isOffDb(key, value) ? "-oo" : `${value > 0 ? "+" : ""}${value.toFixed(1)} dB`;
			case "hz":
				return value >= 1000 ? `${(value / 1000).toFixed(2)} kHz` : `${Math.round(value)} Hz`;
			case "index":
				// Global OSC sends the position only; the name comes from the table.
				return positionName(key, value) ?? String(Math.round(value));
			default:
				return Number.isInteger(value) ? String(value) : value.toFixed(2);
		}
	}

	/** Header: channel name and parameter label. */
	private titleFor(gm: GlobalConnection, settings: GlobalFxSettings): string {
		const p = this.parameterOf(settings);
		if (p.scope !== "channel") return p.label;
		const name = gm.getString(g.channelName(this.busOf(settings), this.channelOf(settings)));
		return name === undefined ? p.label : `${name} · ${p.label}`;
	}

	private keyOf(settings: GlobalFxSettings): FxKey {
		const key = settings.parameter ?? DEFAULT_PARAMETER;
		return isFxKey(key) ? key : DEFAULT_PARAMETER;
	}

	private parameterOf(settings: GlobalFxSettings): (typeof GLOBAL_FX)[FxKey] {
		return GLOBAL_FX[this.keyOf(settings)]!;
	}

	private busOf(settings: GlobalFxSettings): g.GlobalBus {
		return settings.bus === "input" || settings.bus === "playback" || settings.bus === "output"
			? settings.bus
			: "input";
	}

	private channelOf(settings: GlobalFxSettings): number {
		return Math.max(0, num(settings.channel, 0));
	}

	private addressFor(settings: GlobalFxSettings): string {
		return fxAddress(this.keyOf(settings), this.busOf(settings), this.channelOf(settings));
	}

	private enableFor(settings: GlobalFxSettings): string | undefined {
		return fxEnableAddress(this.keyOf(settings), this.busOf(settings), this.channelOf(settings));
	}

	private releaseFor(id: string): void {
		const unsubs = this.cleanup.get(id);
		if (unsubs === undefined) return;
		for (const fn of unsubs) fn();
		this.cleanup.delete(id);
	}
}
