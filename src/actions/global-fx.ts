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
	fxBuses,
	fxEnableAddress,
	fxNeutral,
	fxStep,
	GLOBAL_FX,
	isFxKey,
	isLrSplit,
	isOffDb,
	positionName,
	positionsOf,
	stepSettingOf,
	type FxKey,
} from "../globalosc/fx.js";
import { datasourceEvent } from "../totalmix/datasource.js";
import {
	GESTURE_LABELS,
	GLOBAL_FX as GLOBAL_FX_GESTURES,
	resolveGesture,
	type Gesture,
	type GestureSlot,
	type GlobalFxKind,
} from "./gestures.js";
import { seedDefaults } from "../totalmix/defaults.js";
import { num } from "../totalmix/settings.js";
import { alertIfDown, forgetAlertState } from "./alert.js";
import { washFeedback } from "./wash.js";
import {
	knobKeyImage,
	knobTouchImage,
	listKeyImage,
	listTouchImage,
	type Badge,
	type KnobState,
	type ListState,
} from "../render/strip.js";
import { fxArcColour, fxBipolar, fxPosition, fxSectionBadge } from "../render/fx-range.js";
import { TM } from "../render/theme.js";

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
	/** Key placement only: step direction, or "select" to write a fixed list entry. */
	nudge?: "up" | "down" | "select";
	/** 0-based list entry written by a "select" key. */
	selectIndex?: number | string;
	/**
	 * "select" key, press while its entry is active: "none" stays, "previous"
	 * restores the entry held before the last selection, a number writes that entry.
	 */
	selectSecond?: "none" | "previous" | number | string;
	/** Dial gestures; unset or inapplicable falls back to the vocabulary default. */
	press?: string;
	touch?: string;
	/** Artwork: TotalMix-style knob (default) or the plain icon with a title. */
	look?: "strip" | "icon";
	host?: string;
	sendPort?: number;
	receivePort?: number;
};

const DEFAULT_PARAMETER: FxKey = "reverbVolume";

/** Touch-display layouts per look. */
const LAYOUT = { strip: "layouts/strip.json", icon: "layouts/volume.json" } as const;

/** Tolerance for "already at neutral", in the parameter's own unit. */
const NEUTRAL_EPSILON = 0.001;

/** Control room and global switches a gesture can flip, independent of the dial's parameter. */
const SWITCHES: Partial<Record<Gesture, string>> = {
	dim: g.CR_DIM,
	mono: g.CR_MAIN_MONO,
	talkback: g.CR_TALKBACK,
	speakerB: g.CR_SPEAKER_B,
	extIn: g.CR_EXTERNAL_IN,
	muteFx: g.CR_MUTE_FX,
	globalMute: g.GLOBAL_MUTE,
	globalSolo: g.GLOBAL_SOLO,
};

/** Global OSC effect, EQ, dynamics and Auto Level parameters, stepped in their own units. */
@action({ UUID: "de.shells.totalmixgen2.globalfx" })
export class GlobalFx extends SingletonAction<GlobalFxSettings> {
	private readonly cleanup = new Map<string, Array<() => void>>();

	/** Value held before a parameter was parked at neutral, per address. */
	private readonly lastOffNeutral = new Map<string, number>();

	/** List position held before a "select" key wrote its entry, per address. */
	private readonly beforeSelect = new Map<string, number>();

	/** Last image sent per action (key image or touch canvas), so unchanged art is not re-sent. */
	private readonly images = new Map<string, string>();

	/** Active layout per dial, so setFeedbackLayout runs only on change. */
	private readonly layouts = new Map<string, string>();

	override async onWillAppear(ev: WillAppearEvent<GlobalFxSettings>): Promise<void> {
		await seedDefaults(ev.action, ev.payload.settings, "global");
		await this.setup(ev.action, ev.payload.settings);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<GlobalFxSettings>): Promise<void> {
		await this.setup(ev.action, ev.payload.settings);
	}

	override onWillDisappear(ev: WillDisappearEvent<GlobalFxSettings>): void {
		this.releaseFor(ev.action.id);
		this.layouts.delete(ev.action.id);
		forgetAlertState(ev.action.id);
	}

	override async onSendToPlugin(
		ev: SendToPluginEvent<{ event?: string }, GlobalFxSettings>,
	): Promise<void> {
		const event = datasourceEvent(ev.payload);
		const settings = await ev.action.getSettings();
		if (event === "getFxPositions" || event === "getFxSecondPress") {
			// Unknown device or list: plain positions, so a key can still be configured.
			const positions =
				positionsOf(this.keyOf(settings), this.busOf(settings)) ??
				["Position 1", "Position 2", "Position 3", "Position 4"];
			const entries = positions.map((label, value) => ({ value: String(value), label }));
			const items =
				event === "getFxSecondPress"
					? [
							{ value: "none", label: "Nothing" },
							{ value: "previous", label: "Back to the previous entry" },
							...entries.map((e) => ({ ...e, label: `Switch to ${e.label}` })),
						]
					: entries;
			await streamDeck.ui.sendToPropertyInspector({ event, items });
			return;
		}
		if (event !== "getChannels") return;
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
		// The reference level list depends on the reported device.
		if (this.keyOf(settings) === "refLevel") unsubs.push(gm.subscribe(g.STATUS_DEVICE, render));

		this.releaseFor(target.id);
		this.cleanup.set(target.id, unsubs);

		if (target.isDial()) {
			const layout = LAYOUT[settings.look === "icon" ? "icon" : "strip"];
			if (this.layouts.get(target.id) !== layout) {
				this.layouts.set(target.id, layout);
				await target.setFeedbackLayout(layout);
			}
			void target.setTriggerDescription({
				rotate: "Adjust",
				push: GESTURE_LABELS[this.gestureOf(settings, "press")],
				touch: GESTURE_LABELS[this.gestureOf(settings, "touch")],
			});
		}

		render();
	}

	override onDialRotate(ev: DialRotateEvent<GlobalFxSettings>): void {
		this.move(ev.action, ev.payload.settings, ev.payload.ticks);
	}

	override onKeyDown(ev: KeyDownEvent<GlobalFxSettings>): void {
		const settings = ev.payload.settings;
		if (this.isSelectKey(settings)) {
			this.select(ev.action, settings);
			return;
		}
		this.move(ev.action, settings, (settings.nudge ?? "up") === "down" ? -1 : 1);
	}

	/** True for a key that writes a fixed entry of a list parameter. */
	private isSelectKey(settings: GlobalFxSettings): boolean {
		return settings.nudge === "select" && this.parameterOf(settings).unit === "index";
	}

	/**
	 * Writes the key's entry. With selectRevert, a press while that entry is
	 * active restores the entry held before the last selection.
	 */
	private select(target: KeyDownEvent<GlobalFxSettings>["action"], settings: GlobalFxSettings): void {
		const gm = globalMixFor(globalConnectionOptions(settings));
		if (alertIfDown(target, gm)) return;

		const address = this.addressFor(settings);
		const entry = Math.max(0, Math.round(num(settings.selectIndex, 0)));
		const current = gm.get(address);
		const active = typeof current === "number" && Math.round(current) === entry;

		let next = entry;
		if (active) {
			const second = settings.selectSecond ?? "none";
			if (second === "none") return;
			if (second === "previous") {
				const restore = this.beforeSelect.get(address);
				if (restore === undefined || restore === entry) {
					streamDeck.logger.info(`No earlier entry stored for ${address}; staying on ${entry}.`);
					return;
				}
				next = restore;
			} else {
				next = Math.max(0, Math.round(num(second, entry)));
			}
		}

		if (typeof current === "number") this.beforeSelect.set(address, Math.round(current));
		gm.set(address, next);
		void this.render(gm, target, settings, next);
	}

	override onDialDown(ev: DialDownEvent<GlobalFxSettings>): void {
		this.perform(ev.action, ev.payload.settings, "press");
	}

	override onTouchTap(ev: TouchTapEvent<GlobalFxSettings>): void {
		this.perform(ev.action, ev.payload.settings, "touch");
	}

	/** Gesture kind: parameters with a defined neutral versus the rest. */
	private kindOf(settings: GlobalFxSettings): GlobalFxKind {
		return this.neutralFor(settings) === undefined ? "fxPlain" : "fx";
	}

	private gestureOf(settings: GlobalFxSettings, slot: GestureSlot): Gesture {
		return resolveGesture(
			slot === "press" ? settings.press : settings.touch,
			this.kindOf(settings),
			slot,
			GLOBAL_FX_GESTURES,
		);
	}

	/** Runs the gesture bound to a slot and repaints with whatever value it wrote. */
	private perform(
		target: DialAction<GlobalFxSettings>,
		settings: GlobalFxSettings,
		slot: GestureSlot,
	): void {
		const gm = globalMixFor(globalConnectionOptions(settings));
		if (alertIfDown(target, gm)) return;

		const gesture = this.gestureOf(settings, slot);
		streamDeck.logger.info(`Global FX ${slot}: ${gesture}`);

		const switchAddress = SWITCHES[gesture];
		if (switchAddress !== undefined) {
			gm.toggleSet(switchAddress);
			return;
		}

		switch (gesture) {
			case "recall":
				// (f) trigger, receive only.
				gm.trigger(g.CR_RECALL, 1.0);
				return;
			case "bypass": {
				const enable = this.enableFor(settings);
				if (enable !== undefined) gm.toggleSet(enable);
				return;
			}
			case "neutralToggle": {
				const value = this.toggleNeutral(gm, settings);
				if (value === undefined) return;
				void this.render(gm, target, settings, value);
				return;
			}
			default:
				return;
		}
	}

	/** Neutral value in the parameter's own unit; see fxNeutral. */
	private neutralFor(settings: GlobalFxSettings): number | undefined {
		return fxNeutral(this.keyOf(settings));
	}

	/**
	 * Parks the parameter at neutral, or restores the value held before the
	 * last park. With nothing held, a parameter already at neutral stays there.
	 */
	private toggleNeutral(gm: GlobalConnection, settings: GlobalFxSettings): number | undefined {
		const neutral = this.neutralFor(settings);
		if (neutral === undefined) return undefined;

		const address = this.addressFor(settings);
		const current = gm.getNumber(address, neutral);

		if (Math.abs(current - neutral) > NEUTRAL_EPSILON) {
			this.lastOffNeutral.set(address, current);
			gm.setCoalesced(address, neutral);
			return neutral;
		}

		const restore = this.lastOffNeutral.get(address);
		if (restore === undefined) {
			streamDeck.logger.info(`No stored value for ${address}; leaving it at neutral.`);
			return undefined;
		}

		gm.setCoalesced(address, restore);
		return restore;
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
		const next = fxStep(key, current, ticks, this.stepFor(settings, key), this.busOf(settings));

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

	private async render(
		gm: GlobalConnection,
		target: WillAppearEvent<GlobalFxSettings>["action"] | DialAction<GlobalFxSettings>,
		settings: GlobalFxSettings,
		override?: number,
	): Promise<void> {
		const key = this.keyOf(settings);
		const address = this.addressFor(settings);
		const raw = override ?? gm.get(address);

		const label = raw === undefined || !gm.connected ? "—" : this.format(key, Number(raw), settings);
		const enable = this.enableFor(settings);
		const lit = enable !== undefined && asBool(gm.get(enable) ?? 0);

		if (settings.look !== "icon") {
			await this.renderKnob(gm, target, settings, key, raw, label, lit);
			return;
		}

		if (!target.isDial()) {
			await target.setTitle(label);
			return;
		}

		await target.setFeedback(
			washFeedback(this.titleFor(gm, settings), label, 0, gm.connected && lit ? "fxOn" : "none"),
		);
	}

	/**
	 * TotalMix-style knob: header is the channel (or unit) name, the arc fills
	 * on the parameter's display span, the caption is the parameter label and
	 * the badge is the section's enable state.
	 */
	private async renderKnob(
		gm: GlobalConnection,
		target: WillAppearEvent<GlobalFxSettings>["action"] | DialAction<GlobalFxSettings>,
		settings: GlobalFxSettings,
		key: FxKey,
		raw: unknown,
		label: string,
		lit: boolean,
	): Promise<void> {
		const p = GLOBAL_FX[key]!;
		const offline = !gm.connected;
		const value = typeof raw === "number" ? raw : undefined;
		const section = fxSectionBadge(p.section) ?? (p.scope === "reverb" ? "REV" : p.scope === "echo" ? "ECHO" : undefined);
		const badges: Badge[] = section === undefined ? [] : [{ label: section, lit, colour: TM.fxOn }];

		let name: string;
		if (p.scope === "channel") {
			const ch = this.channelOf(settings);
			name = gm.getString(g.channelName(this.busOf(settings), ch)) ?? `Ch ${ch + 1}`;
		} else {
			name = p.scope === "reverb" ? "Reverb" : "Echo";
		}

		const selecting = target.isKey() && this.isSelectKey(settings);
		const nudge =
			target.isKey() && !selecting ? (settings.nudge === "down" ? "down" : "up") : undefined;
		let image: string;
		if (p.unit === "index") {
			// List parameters: the entry name in a dropdown box, no knob. A select
			// key shows its own entry and lights while that entry is active.
			const entry = Math.max(0, Math.round(num(settings.selectIndex, 0)));
			const state: ListState = {
				name,
				label: selecting ? (positionName(key, entry, this.busOf(settings)) ?? String(entry)) : label,
				caption: p.label,
				index: value,
				count: positionsOf(key, this.busOf(settings))?.length,
				active: selecting && value !== undefined && Math.round(value) === entry && !offline,
				badges,
				nudge,
				offline,
			};
			image = target.isDial() ? listTouchImage(state) : listKeyImage(state);
		} else {
			const state: KnobState = {
				name,
				label,
				position: value === undefined ? undefined : fxPosition(key, value, this.busOf(settings)),
				bipolar: fxBipolar(key),
				arc: fxArcColour(key),
				caption: p.label,
				badges,
				nudge,
				offline,
			};
			image = target.isDial() ? knobTouchImage(state) : knobKeyImage(state);
		}
		if (this.images.get(target.id) === image) return;
		this.images.set(target.id, image);

		if (target.isDial()) {
			await target.setFeedback({ canvas: image });
			return;
		}
		await target.setTitle("");
		await target.setImage(image);
	}


	private format(key: FxKey, value: number, settings: GlobalFxSettings): string {
		switch (GLOBAL_FX[key]!.unit) {
			case "db":
				// TotalMix reports off as an under-range level (-300 dB and similar).
				return isOffDb(key, value) ? "-oo" : `${value > 0 ? "+" : ""}${value.toFixed(1)} dB`;
			case "hz":
				return value >= 1000 ? `${(value / 1000).toFixed(2)} kHz` : `${Math.round(value)} Hz`;
			case "index":
				// Global OSC sends the position only; the name comes from the table.
				return positionName(key, value, this.busOf(settings)) ?? String(Math.round(value));
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

	/** Bus from the settings, constrained to the buses the parameter exists on; a disallowed or unset bus resolves to the first allowed one. */
	private busOf(settings: GlobalFxSettings): g.GlobalBus {
		const allowed = fxBuses(this.keyOf(settings));
		const stored = settings.bus;
		if ((stored === "input" || stored === "playback" || stored === "output") && allowed.includes(stored)) {
			return stored;
		}
		return allowed[0] ?? "input";
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
		this.images.delete(id);
		const unsubs = this.cleanup.get(id);
		if (unsubs === undefined) return;
		for (const fn of unsubs) fn();
		this.cleanup.delete(id);
	}
}
