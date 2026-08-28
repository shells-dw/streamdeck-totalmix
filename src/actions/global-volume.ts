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
import {
	dbToFader,
	faderToBar,
	faderToDb,
	formatBalance,
	formatDb,
	stepDb,
	MAX_DB,
	MIN_DB,
} from "../osc/curves.js";
import { BALANCE_STEP } from "../osc/steps.js";
import * as g from "../globalosc/addresses.js";
import { GAIN_MAX_DB, stepGainDb } from "../globalosc/gain.js";
import { detectedMaxGainDb } from "../totalmix/devices.js";
import { globalMixFor, type GlobalConnection } from "../globalosc/connection.js";
import {
	buildChannelItems,
	globalConnectionOptions,
	replyGlobalChannelDatasource,
} from "../globalosc/datasource.js";
import { datasourceEvent } from "../totalmix/datasource.js";
import { seedDefaults } from "../totalmix/defaults.js";
import { num } from "../totalmix/settings.js";
import { asBool } from "../osc/codec.js";
import { alertIfDown, forgetAlertState } from "./alert.js";
import { washFeedback, type Wash } from "./wash.js";
import { nudgeIcon } from "../totalmix/icons.js";
import {
	GESTURE_LABELS,
	GLOBAL,
	resolveGesture,
	type Gesture,
	type GestureSlot,
	type GlobalKind,
} from "./gestures.js";

export type GlobalVolumeSettings = {
	/** "main" follows /controlroom/mainout. */
	target?: "main" | "channel" | "mixNode" | "gain" | "pan" | "mixPan";
	/** Bus for target "channel". */
	bus?: g.GlobalBus | "";
	/** 0-based channel for target "channel". */
	channel?: number | string;
	/** Output whose submix an input/playback fader belongs to; "auto"/empty follows /controlroom/mainout. */
	submixOut?: number | string;
	/** 0-based channel for target "gain" (separate PI dropdown). */
	gainChannel?: number | string;
	/** Mix node source: hardware input or software playback. */
	mixSrcBus?: "in" | "pb";
	/** 0-based source channel for target "mixNode". */
	mixSrc?: number | string;
	/** 0-based output channel for target "mixNode". */
	mixOut?: number | string;
	/** dB per detent or press; faders only (gain is fixed at 1 dB). */
	stepDb?: number;
	/** Key placement only: whether a press nudges the value up or down. */
	nudge?: "up" | "down";
	/** Dial placement only: what pressing the dial does. Unset means the target's default. */
	press?: Gesture;
	/** Dial placement only: what tapping the touch display does. Unset means the target's default. */
	touch?: Gesture;
	host?: string;
	sendPort?: number;
	receivePort?: number;
};

const DEFAULT_STEP_DB = 1.5;

/**
 * Global OSC level control. "main" resolves to the output channel named by
 * /controlroom/mainout. Levels are read from whichever form TotalMix
 * transmitted (faderlin, or the dB sibling "fader"/"volume") and written back
 * in that same form.
 */
@action({ UUID: "de.shells.totalmixgen2.globalvolume" })
export class GlobalVolume extends SingletonAction<GlobalVolumeSettings> {
	/** Last key image sent per action, so an unchanged icon is not re-sent. */
	private readonly keyImages = new Map<string, string>();

	private readonly cleanup = new Map<string, Array<() => void>>();

	/** Last /controlroom/mainout value per "main" action; setup re-runs on change only. */
	private readonly lastMainOut = new Map<string, number>();

	/** Channels already primed with /sendchan this session, per connection. */
	private readonly primedChannels = new Set<string>();

	/** Last audible faderlin level per address (restore point for -oo). */
	private readonly lastAudible = new Map<string, number>();

	override async onWillAppear(ev: WillAppearEvent<GlobalVolumeSettings>): Promise<void> {
		await seedDefaults(ev.action, ev.payload.settings, "global", { stepDb: true });
		await this.setup(ev.action, ev.payload.settings);
	}

	override async onDidReceiveSettings(
		ev: DidReceiveSettingsEvent<GlobalVolumeSettings>,
	): Promise<void> {
		await this.setup(ev.action, ev.payload.settings);
	}

	private async setup(
		target: WillAppearEvent<GlobalVolumeSettings>["action"],
		settings: GlobalVolumeSettings,
	): Promise<void> {
		const gm = globalMixFor(globalConnectionOptions(settings));

		const render = (): void => {
			void this.render(gm, target, settings);
		};

		const unsubs: Array<() => void> = [gm.onConnectionChange(render)];

		if ((settings.target ?? "channel") === "main") {
			// Re-subscribe when the Main Out assignment moves.
			unsubs.push(
				gm.subscribe(g.CR_MAINOUT, (v) => {
					const ch = typeof v === "number" ? Math.round(v) : undefined;
					if (ch === undefined) return;
					if (this.lastMainOut.get(target.id) === ch) {
						render();
						return;
					}
					this.lastMainOut.set(target.id, ch);
					void this.setup(target, settings);
				}),
			);
		}

		const address = this.addressFor(settings, gm);
		if (address !== undefined) {
			for (const c of this.levelCandidates(settings, gm, address)) {
				unsubs.push(gm.subscribe(c.address, render));
			}
			if ((settings.target ?? "channel") === "channel") {
				unsubs.push(gm.subscribe(g.CR_MAINOUT, render));
			}
		}

		for (const nameAddress of this.nameAddresses(settings, gm)) {
			unsubs.push(gm.subscribe(nameAddress, render));
		}

		const pan = this.panAddress(settings, gm);
		if (pan !== undefined) unsubs.push(gm.subscribe(pan, render));

		for (const flag of this.washAddresses(settings, gm)) {
			unsubs.push(gm.subscribe(flag, render));
		}

		this.primeChannel(gm, settings);

		this.releaseFor(target.id);
		this.cleanup.set(target.id, unsubs);

		if (target.isDial()) {
			void target.setTriggerDescription({
				rotate: "Adjust level",
				push: GESTURE_LABELS[this.gestureFor(settings, "press")],
				touch: GESTURE_LABELS[this.gestureFor(settings, "touch")],
			});
		}

		render();
	}

	/** Requests this target's channel and submix once per connection (/sendchan, /sendsubmix 1). */
	private primeChannel(gm: GlobalConnection, settings: GlobalVolumeSettings): void {
		const spec = this.channelSpec(settings, gm);
		if (spec !== undefined) {
			const key = `${gm.options_.host}:${gm.options_.sendPort}:${spec.bus}:${spec.ch}`;
			if (!this.primedChannels.has(key)) {
				this.primedChannels.add(key);
				gm.trigger(g.sendChan(spec.bus, spec.ch), 1.0);
			}
		}

		// Input/playback faders are transmitted as mix nodes of the submix.
		if ((settings.target ?? "channel") === "channel") {
			const bus = this.busOf(settings);
			if (bus === "input" || bus === "playback") {
				const outCh = this.submixOutOf(settings, gm);
				const key = `${gm.options_.host}:${gm.options_.sendPort}:submix:${outCh}`;
				if (!this.primedChannels.has(key)) {
					this.primedChannels.add(key);
					gm.trigger(g.sendSubmix(outCh), 1.0);
				}
			}
		}

		const node = this.mixNodeSpec(settings);
		if (node !== undefined) {
			const key = `${gm.options_.host}:${gm.options_.sendPort}:submix:${node.out}`;
			if (!this.primedChannels.has(key)) {
				this.primedChannels.add(key);
				gm.trigger(g.sendSubmix(node.out), 1.0);
			}
		}
	}

	override onWillDisappear(ev: WillDisappearEvent<GlobalVolumeSettings>): void {
		this.releaseFor(ev.action.id);
		this.lastMainOut.delete(ev.action.id);
		forgetAlertState(ev.action.id);
	}

	override async onSendToPlugin(
		ev: SendToPluginEvent<{ event?: string }, GlobalVolumeSettings>,
	): Promise<void> {
		streamDeck.logger.info(`PI -> plugin: ${JSON.stringify(ev.payload).slice(0, 160)}`);
		const event = datasourceEvent(ev.payload);
		if (event === undefined) return;
		const settings = await ev.action.getSettings();
		const gm = globalMixFor(globalConnectionOptions(settings));

		if (event === "getGlobalChannels") {
			await replyGlobalChannelDatasource(gm, event, this.busOf(settings), false);
		} else if (event === "getGlobalGainChannels") {
			await replyGlobalChannelDatasource(gm, event, "input", true);
		} else if (event === "getGlobalSrcChannels") {
			await replyGlobalChannelDatasource(
				gm,
				event,
				(settings.mixSrcBus ?? "in") === "pb" ? "playback" : "input",
				false,
			);
		} else if (event === "getGlobalOutChannels") {
			await replyGlobalChannelDatasource(gm, event, "output", false);
		} else if (event === "getGlobalSubmixChoices") {
			await new Promise((r) => setTimeout(r, 250));
			const items = [
				{ value: "auto", label: "Main Out (auto)" },
				...buildChannelItems(gm, "output", false),
			];
			await streamDeck.ui.sendToPropertyInspector({ event, items });
		}
	}

	override onDialRotate(ev: DialRotateEvent<GlobalVolumeSettings>): void {
		this.step(ev, ev.payload.ticks);
	}

	override onKeyDown(ev: KeyDownEvent<GlobalVolumeSettings>): void {
		const ticks = (ev.payload.settings.nudge ?? "up") === "down" ? -1 : 1;
		this.step(ev, ticks);
	}

	private step(
		ev: DialRotateEvent<GlobalVolumeSettings> | KeyDownEvent<GlobalVolumeSettings>,
		ticks: number,
	): void {
		const settings = ev.payload.settings;
		const gm = globalMixFor(globalConnectionOptions(settings));
		if (alertIfDown(ev.action, gm)) return;

		if (this.isPan(settings)) {
			if (this.stepPan(gm, settings, ticks)) void this.render(gm, ev.action, settings);
			return;
		}

		const address = this.addressFor(settings, gm);
		const isGain = (settings.target ?? "channel") === "gain";

		if (address === undefined) {
			streamDeck.logger.warn("Ignoring move: Main Out assignment not received yet");
			gm.requestFullRefresh();
			return;
		}

		let level = this.resolveLevel(gm, settings, address);
		if (level === undefined && (settings.target ?? "channel") === "channel") {
			// No fader state received for this channel: seed at -oo and step locally.
			streamDeck.logger.info(
				`No fader state from TotalMix for ${address}; starting from -oo and stepping locally.`,
			);
			// Last candidate: for input/playback the mix node into the submix.
			const candidates = this.levelCandidates(settings, gm, address);
			const seedOn = candidates[candidates.length - 1] ?? { kind: "faderlin" as const, address };
			level = { kind: "faderlin", address: seedOn.kind === "faderlin" ? seedOn.address : address, value: 0 };
		}
		if (level === undefined) {
			streamDeck.logger.warn(`Ignoring move on ${address}: no data received for it yet`);
			const spec = this.channelSpec(settings, gm);
			if (spec !== undefined) gm.trigger(g.sendChan(spec.bus, spec.ch), 1.0);
			gm.requestFullRefresh();
			return;
		}

		const perTick = num(settings.stepDb, DEFAULT_STEP_DB);

		if (isGain) {
			const next = stepGainDb(level.value, ticks, detectedMaxGainDb(GAIN_MAX_DB));
			gm.setCoalesced(address, next);
			void this.render(gm, ev.action, settings, next);
			return;
		}

		let next01: number;
		if (level.kind === "faderlin") {
			next01 = stepDb(level.value, ticks * perTick);
			gm.setCoalesced(level.address, next01);
		} else {
			const nextDb = Math.min(MAX_DB, Math.max(MIN_DB, level.value + ticks * perTick));
			gm.setCoalesced(level.address, nextDb);
			next01 = dbToFader(nextDb);
		}

		void this.render(gm, ev.action, settings, next01);
	}

	/** First level candidate with a cached numeric value: faderlin, else the dB sibling. */
	private resolveLevel(
		gm: GlobalConnection,
		settings: GlobalVolumeSettings,
		address: string,
	): { kind: "faderlin" | "db"; address: string; value: number } | undefined {
		// Which form arrives depends on the slot's "Send faders in linear scale" option and the bus.
		for (const c of this.levelCandidates(settings, gm, address)) {
			const v = gm.get(c.address);
			if (typeof v === "number") return { kind: c.kind, address: c.address, value: v };
		}
		return undefined;
	}

	/** Addresses the level may arrive on, most specific first. */
	private levelCandidates(
		settings: GlobalVolumeSettings,
		gm: GlobalConnection,
		address: string,
	): { kind: "faderlin" | "db"; address: string }[] {
		const out: { kind: "faderlin" | "db"; address: string }[] = [
			{ kind: "faderlin", address },
		];
		const dbSibling = this.volumeFallbackFor(settings, gm);
		if (dbSibling !== undefined) out.push({ kind: "db", address: dbSibling });

		// Input/playback: also the mix node into the submix.
		if ((settings.target ?? "channel") === "channel") {
			const bus = this.busOf(settings);
			if (bus === "input" || bus === "playback") {
				const src: g.MixSourceBus = bus === "input" ? "in" : "pb";
				const ch = num(settings.channel, 0);
				const outCh = this.submixOutOf(settings, gm);
				out.push({ kind: "faderlin", address: g.mixFaderlin(src, ch, outCh) });
				out.push({ kind: "db", address: g.mixNode(src, ch, outCh, "fader") });
			}
		}
		return out;
	}

	/** Current level as faderlin 0..1. */
	private currentValue(
		gm: GlobalConnection,
		settings: GlobalVolumeSettings,
		address: string,
	): number | undefined {
		const level = this.resolveLevel(gm, settings, address);
		if (level === undefined) return undefined;
		if (level.kind === "faderlin") return level.value;
		return dbToFader(Math.min(Math.max(level.value, MIN_DB), MAX_DB));
	}

	/** dB sibling of the faderlin address: mix "fader" ([dB]) or channel "volume". */
	private volumeFallbackFor(
		settings: GlobalVolumeSettings,
		gm: GlobalConnection,
	): string | undefined {
		const node = this.mixNodeSpec(settings);
		if (node !== undefined) return g.mixNode(node.src, node.in_, node.out, "fader");
		const spec = this.channelSpec(settings, gm);
		const target = settings.target ?? "channel";
		if (spec === undefined || target === "gain") return undefined;
		return g.channel(spec.bus, spec.ch, "volume");
	}


	private mixNodeSpec(
		settings: GlobalVolumeSettings,
	): { src: g.MixSourceBus; in_: number; out: number } | undefined {
		if ((settings.target ?? "channel") !== "mixNode") return undefined;
		return {
			src: settings.mixSrcBus ?? "in",
			in_: num(settings.mixSrc, 0),
			out: num(settings.mixOut, 0),
		};
	}

	/** Bus and channel of a channel-scoped target; undefined for mixNode or an unknown Main Out. */
	private channelSpec(
		settings: GlobalVolumeSettings,
		gm: GlobalConnection,
	): { bus: g.GlobalBus; ch: number } | undefined {
		switch (settings.target ?? "channel") {
			case "channel":
			case "pan":
				return { bus: this.busOf(settings), ch: num(settings.channel, 0) };
			case "gain":
				// Pre-4.1.1 settings stored the gain channel in "channel".
				return { bus: "input", ch: num(settings.gainChannel ?? settings.channel, 0) };
			case "main": {
				const assigned = gm.get(g.CR_MAINOUT);
				if (typeof assigned !== "number") return undefined;
				return { bus: "output", ch: Math.round(assigned) };
			}
			case "mixNode":
				return undefined;
		}
	}

	/** Output channel whose submix an input/playback fader targets. */
	private submixOutOf(settings: GlobalVolumeSettings, gm: GlobalConnection): number {
		const raw = settings.submixOut;
		if (raw !== undefined && String(raw).trim() !== "" && String(raw) !== "auto") {
			return num(raw, 0);
		}
		const mainOut = gm.get(g.CR_MAINOUT);
		return typeof mainOut === "number" ? Math.round(mainOut) : 0;
	}

	private busOf(settings: GlobalVolumeSettings): g.GlobalBus {
		return settings.bus === "input" || settings.bus === "playback" || settings.bus === "output"
			? settings.bus
			: "output";
	}

	private addressFor(settings: GlobalVolumeSettings, gm: GlobalConnection): string | undefined {
		const node = this.mixNodeSpec(settings);
		if (node !== undefined) return g.mixFaderlin(node.src, node.in_, node.out);

		const target = settings.target ?? "channel";
		const spec = this.channelSpec(settings, gm);
		if (spec === undefined) return undefined;
		return target === "gain" ? g.channelGain(spec.ch) : g.channelFaderlin(spec.bus, spec.ch);
	}

	/** Target class for the gesture rules. */
	private kindOfTarget(settings: GlobalVolumeSettings): GlobalKind {
		return settings.target ?? "channel";
	}

	/** True for the balpan targets (-1..+1). */
	private isPan(settings: GlobalVolumeSettings): boolean {
		const target = settings.target ?? "channel";
		return target === "pan" || target === "mixPan";
	}

	/** balpan address for the pan targets, or undefined. */
	private panAddress(settings: GlobalVolumeSettings, gm: GlobalConnection): string | undefined {
		const target = settings.target ?? "channel";
		if (target === "mixPan") {
			return g.mixNode(
				settings.mixSrcBus ?? "in",
				num(settings.mixSrc, 0),
				num(settings.mixOut, 0),
				"balpan",
			);
		}
		if (target !== "pan") return undefined;

		const spec = this.channelSpec(settings, gm);
		return spec === undefined ? undefined : g.channel(spec.bus, spec.ch, "balpan");
	}

	/** Steps balpan, snapped to the step grid. */
	private stepPan(gm: GlobalConnection, settings: GlobalVolumeSettings, ticks: number): boolean {
		const address = this.panAddress(settings, gm);
		if (address === undefined) return false;

		const current = gm.getNumber(address, 0);
		const stepped = current + ticks * BALANCE_STEP;
		const snapped = Math.round(stepped / BALANCE_STEP) * BALANCE_STEP;
		gm.setCoalesced(address, Math.min(1, Math.max(-1, snapped)));
		return true;
	}

	/** Resolved gesture for a slot. */
	private gestureFor(settings: GlobalVolumeSettings, slot: GestureSlot): Gesture {
		return resolveGesture(
			slot === "press" ? settings.press : settings.touch,
			this.kindOfTarget(settings),
			slot,
			GLOBAL,
		);
	}

	override onDialDown(ev: DialDownEvent<GlobalVolumeSettings>): void {
		this.gesture(ev, "press");
	}

	override onTouchTap(ev: TouchTapEvent<GlobalVolumeSettings>): void {
		this.gesture(ev, "touch");
	}

	/** Runs a dial gesture and repaints when it moved the level. */
	private gesture(
		ev: DialDownEvent<GlobalVolumeSettings> | TouchTapEvent<GlobalVolumeSettings>,
		slot: GestureSlot,
	): void {
		const settings = ev.payload.settings;
		const gm = globalMixFor(globalConnectionOptions(settings));
		if (alertIfDown(ev.action, gm)) return;

		const next = this.perform(gm, settings, this.gestureFor(settings, slot));
		if (next !== undefined) void this.render(gm, ev.action, settings, next);
	}

	/** Performs a gesture. Returns the level written as faderlin 0..1, or undefined. */
	private perform(
		gm: GlobalConnection,
		settings: GlobalVolumeSettings,
		gesture: Gesture,
	): number | undefined {
		const target = settings.target ?? "channel";
		const spec = this.channelSpec(settings, gm);

		const flipChannel = (param: string): undefined => {
			if (spec !== undefined) gm.toggleSet(g.channel(spec.bus, spec.ch, param));
			return undefined;
		};

		switch (gesture) {
			case "none":
				return undefined;

			case "mute":
				if (target === "main") {
					// No control-room mute in the table: fader to -oo and back.
					return this.toggleSilence(gm, settings);
				}
				return flipChannel("mute");

			case "solo":
				if (target === "mixNode") {
					gm.toggleSet(
						g.mixSolo(settings.mixSrcBus ?? "in", num(settings.mixSrc, 0), num(settings.mixOut, 0)),
					);
					return undefined;
				}
				return flipChannel("pfl");

			case "phantom":
				return flipChannel("48v");

			case "infinity":
				return this.toggleSilence(gm, settings);

			case "unity":
				return this.writeLevel(gm, settings, 0);

			case "center": {
				const pan = this.panAddress(settings, gm);
				if (pan !== undefined) gm.set(pan, 0);
				return undefined;
			}

			case "dim":
				gm.toggleSet(g.CR_DIM);
				return undefined;
			case "mono":
				gm.toggleSet(g.CR_MAIN_MONO);
				return undefined;
			case "talkback":
				gm.toggleSet(g.CR_TALKBACK);
				return undefined;
			case "speakerB":
				gm.toggleSet(g.CR_SPEAKER_B);
				return undefined;
			case "extIn":
				gm.toggleSet(g.CR_EXTERNAL_IN);
				return undefined;
			case "muteFx":
				gm.toggleSet(g.CR_MUTE_FX);
				return undefined;
			case "recall":
				// (f) trigger, receive only.
				gm.trigger(g.CR_RECALL, 1.0);
				return undefined;
			case "globalMute":
				gm.toggleSet(g.GLOBAL_MUTE);
				return undefined;
			case "globalSolo":
				gm.toggleSet(g.GLOBAL_SOLO);
				return undefined;

			default:
				return undefined;
		}
	}

	/** Writes a level in dB in the form TotalMix reported (faderlin or dB); returns faderlin 0..1. */
	private writeLevel(
		gm: GlobalConnection,
		settings: GlobalVolumeSettings,
		db: number,
	): number | undefined {
		const address = this.addressFor(settings, gm);
		if (address === undefined) return undefined;

		const level = this.resolveLevel(gm, settings, address) ?? {
			kind: "faderlin" as const,
			address,
			value: 0,
		};

		if (level.kind === "faderlin") {
			const next = dbToFader(Math.min(MAX_DB, Math.max(MIN_DB, db)));
			gm.set(level.address, next);
			return next;
		}

		const next = Math.min(MAX_DB, Math.max(MIN_DB, db));
		gm.set(level.address, next);
		return dbToFader(next);
	}

	/** Level to -oo, or back to the last audible level. Returns faderlin 0..1, or undefined. */
	private toggleSilence(
		gm: GlobalConnection,
		settings: GlobalVolumeSettings,
	): number | undefined {
		const address = this.addressFor(settings, gm);
		if (address === undefined) return undefined;

		const current = this.currentValue(gm, settings, address) ?? 0;

		if (current > 0) {
			this.lastAudible.set(address, current);
			return this.writeLevel(gm, settings, MIN_DB);
		}

		const restore = this.lastAudible.get(address);
		if (restore === undefined || restore <= 0) {
			streamDeck.logger.info(`No stored level for ${address}; leaving it at -oo.`);
			return undefined;
		}

		return this.writeLevel(gm, settings, faderToDb(restore));
	}

	/** Wash flags, solo first: mix nodes have solo only; main has none. */
	private washAddresses(settings: GlobalVolumeSettings, gm: GlobalConnection): string[] {
		const target = settings.target ?? "channel";

		if (target === "mixNode" || target === "mixPan") {
			return [g.mixSolo(settings.mixSrcBus ?? "in", num(settings.mixSrc, 0), num(settings.mixOut, 0))];
		}
		if (target === "main") return [];

		const spec = this.channelSpec(settings, gm);
		if (spec === undefined) return [];
		return [g.channel(spec.bus, spec.ch, "pfl"), g.channelMute(spec.bus, spec.ch)];
	}

	/** Wash: solo > mute > none. */
	private washFor(settings: GlobalVolumeSettings, gm: GlobalConnection): Wash {
		const [solo, mute] = this.washAddresses(settings, gm);
		if (solo !== undefined && asBool(gm.get(solo) ?? 0)) return "solo";
		if (mute !== undefined && asBool(gm.get(mute) ?? 0)) return "mute";
		return "none";
	}

	/** Name addresses that refresh the title. */
	private nameAddresses(settings: GlobalVolumeSettings, gm: GlobalConnection): string[] {
		const target = settings.target ?? "channel";
		if (target === "mixNode" || target === "mixPan") {
			return [
				g.channelName(
					(settings.mixSrcBus ?? "in") === "pb" ? "playback" : "input",
					num(settings.mixSrc, 0),
				),
				g.channelName("output", num(settings.mixOut, 0)),
			];
		}
		const spec = this.channelSpec(settings, gm);
		return spec === undefined ? [] : [g.channelName(spec.bus, spec.ch)];
	}

	private labelFor(gm: GlobalConnection, settings: GlobalVolumeSettings): string {
		const target = settings.target ?? "channel";
		if (target === "mixNode" || target === "mixPan") {
			const srcBus = (settings.mixSrcBus ?? "in") === "pb" ? "playback" : "input";
			const src =
				gm.getString(g.channelName(srcBus, num(settings.mixSrc, 0))) ??
				`${srcBus === "playback" ? "PB" : "In"} ${num(settings.mixSrc, 0) + 1}`;
			const out =
				gm.getString(g.channelName("output", num(settings.mixOut, 0))) ??
				`Out ${num(settings.mixOut, 0) + 1}`;
			return `${src} → ${out}`;
		}
		if (target === "main") {
			const spec = this.channelSpec(settings, gm);
			return spec === undefined
				? "Main"
				: (gm.getString(g.channelName("output", spec.ch)) ?? "Main");
		}
		const spec = this.channelSpec(settings, gm);
		if (spec === undefined) return "Ch";
		const fallback = target === "gain" ? `Gain ${spec.ch + 1}` : `Ch ${spec.ch + 1}`;
		return gm.getString(g.channelName(spec.bus, spec.ch)) ?? fallback;
	}

	private async render(
		gm: GlobalConnection,
		target: WillAppearEvent<GlobalVolumeSettings>["action"] | DialAction<GlobalVolumeSettings>,
		settings: GlobalVolumeSettings,
		override?: number,
	): Promise<void> {
		if (this.isPan(settings)) {
			await this.renderPan(gm, target, settings);
			return;
		}

		const address = this.addressFor(settings, gm);
		const isGain = (settings.target ?? "channel") === "gain";

		const value =
			override ??
			(address !== undefined ? this.currentValue(gm, settings, address) : undefined);

		if (value === undefined) {
			if (target.isDial()) {
				await target.setFeedback(washFeedback(this.labelFor(gm, settings), "—", 0, "none"));
			} else {
				await target.setTitle("—");
			}
			return;
		}

		// No Val strings in this protocol: faderlin via the curve, gain as dB.
		const label = isGain ? `${Math.round(value)} dB` : formatDb(value);
		// Gain bar spans the device ceiling.
		const bar = isGain
			? Math.round(Math.min(1, Math.max(0, value / detectedMaxGainDb(GAIN_MAX_DB))) * 100)
			: faderToBar(value);

		if (target.isDial()) {
			await target.setFeedback(
				washFeedback(
					this.labelFor(gm, settings),
					gm.connected ? label : "—",
					bar,
					gm.connected ? this.washFor(settings, gm) : "none",
				),
			);
			return;
		}

		this.applyNudgeIcon(target, settings.nudge);
		await target.setTitle(gm.connected ? label : "—");
	}

	/**
	 * Key image showing which way a press moves the value.
	 *
	 * Sent once per change: renders run on every inbound OSC message, and the
	 * guidelines cap programmatic calls at ten a second.
	 */
	private applyNudgeIcon(
		target: { id: string; isKey: () => boolean; setImage: (path?: string) => Promise<void> },
		nudge?: "up" | "down",
	): void {
		if (!target.isKey()) return;
		const icon = nudgeIcon(nudge);
		if (this.keyImages.get(target.id) === icon) return;
		this.keyImages.set(target.id, icon);
		void target.setImage(icon);
	}


	/** Paints a balpan dial (-1..+1, L/C/R notation). */
	private async renderPan(
		gm: GlobalConnection,
		target: WillAppearEvent<GlobalVolumeSettings>["action"] | DialAction<GlobalVolumeSettings>,
		settings: GlobalVolumeSettings,
	): Promise<void> {
		const address = this.panAddress(settings, gm);
		const value = address === undefined ? undefined : gm.get(address);

		if (typeof value !== "number") {
			if (target.isDial()) {
				await target.setFeedback(washFeedback(this.labelFor(gm, settings), "—", 0, "none"));
			} else {
				await target.setTitle("—");
			}
			return;
		}

		const label = gm.connected ? formatBalance(value) : "—";
		if (target.isDial()) {
			await target.setFeedback(
				washFeedback(
					this.labelFor(gm, settings),
					label,
					Math.round(((Math.min(1, Math.max(-1, value)) + 1) / 2) * 100),
					gm.connected ? this.washFor(settings, gm) : "none",
				),
			);
			return;
		}

		this.applyNudgeIcon(target, settings.nudge);
		await target.setTitle(label);
	}

	private releaseFor(id: string): void {
		this.keyImages.delete(id);
		const unsubs = this.cleanup.get(id);
		if (unsubs === undefined) return;
		for (const fn of unsubs) fn();
		this.cleanup.delete(id);
	}
}
