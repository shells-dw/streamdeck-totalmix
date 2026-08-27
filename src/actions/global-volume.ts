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
import { alertIfDown } from "./alert.js";
import { washFeedback, type Wash } from "./wash.js";
import {
	GESTURE_LABELS,
	GLOBAL,
	resolveGesture,
	type Gesture,
	type GestureSlot,
	type GlobalKind,
} from "./gestures.js";

export type GlobalVolumeSettings = {
	/** What to control. "main" follows the Control Room's Main Out assignment. */
	target?: "main" | "channel" | "mixNode" | "gain" | "pan" | "mixPan";
	/** Bus for target "channel". */
	bus?: g.GlobalBus | "";
	/** 0-based channel for target "channel". */
	channel?: number | string;
	/**
	 * Output whose submix an input/playback fader belongs to. Input and playback
	 * faders exist only as mix nodes, one per submix. "auto" or empty follows
	 * /controlroom/mainout; a number pins a specific output channel's submix.
	 */
	submixOut?: number | string;
	/**
	 * 0-based channel for target "gain". Separate from "channel" because the
	 * property inspector renders one dropdown per target, and two dropdowns bound
	 * to the same setting overwrite each other's stored value.
	 */
	gainChannel?: number | string;
	/** Mix node source: hardware input or software playback. */
	mixSrcBus?: "in" | "pb";
	/** 0-based source channel for target "mixNode". */
	mixSrc?: number | string;
	/** 0-based output channel for target "mixNode". */
	mixOut?: number | string;
	/** dB moved per dial detent, or per key press. Faders only; gain is fixed at 1 dB. */
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
 * Volume control over the Global OSC protocol.
 *
 * Addressing is absolute except for the "main" target: Global OSC has no
 * mastervolume address because the Main Out is an output channel, identified by
 * /controlroom/mainout as a 0-based output channel number. The action re-targets
 * when that assignment changes.
 *
 * Channel faders address /{input|playback|output}/{ch}/faderlin for all three
 * buses. State prefers faderlin; where only the dB sibling has arrived (mix
 * "fader", channel "volume") it is converted through the published curve. Writes
 * are always faderlin.
 */
@action({ UUID: "de.shells.totalmixgen2.globalvolume" })
export class GlobalVolume extends SingletonAction<GlobalVolumeSettings> {
	private readonly cleanup = new Map<string, Array<() => void>>();

	/**
	 * Last Main Out assignment seen per "main"-target action. Re-setup runs only
	 * on an actual change; the cached-value delivery of a fresh subscription
	 * would otherwise re-trigger setup indefinitely.
	 */
	private readonly lastMainOut = new Map<string, number>();

	/** Channels already primed with /sendchan this session, per connection. */
	private readonly primedChannels = new Set<string>();

	/**
	 * Last audible level seen per level address, so a level sent to -oo can be put
	 * back where it was. Keyed by address, so two dials on the same channel share
	 * one memory. See the classic action for the reasoning.
	 */
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
			// Track the Main Out assignment; when it moves, re-subscribe to the
			// new output channel's addresses.
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
			// The Main Out assignment shifts which mix node is a candidate.
			if ((settings.target ?? "channel") === "channel") {
				unsubs.push(gm.subscribe(g.CR_MAINOUT, render));
			}
		}

		for (const nameAddress of this.nameAddresses(settings, gm)) {
			unsubs.push(gm.subscribe(nameAddress, render));
		}

		// Balance is not one of the level candidates, so it needs its own watch.
		const pan = this.panAddress(settings, gm);
		if (pan !== undefined) unsubs.push(gm.subscribe(pan, render));

		// Mute and solo drive the display wash. Unlike the classic protocol, both
		// report their state here, so the wash tracks the mixer on every target.
		for (const flag of this.washAddresses(settings, gm)) {
			unsubs.push(gm.subscribe(flag, render));
		}

		// Requests this channel's parameters once. The bulk /sendall at connect
		// can be lost if the plugin starts before TotalMix.
		this.primeChannel(gm, settings);

		this.releaseFor(target.id);
		this.cleanup.set(target.id, unsubs);

		// Both gestures are configurable and mean different things per target, so
		// the manifest's single pair of hints cannot be right for every button.
		if (target.isDial()) {
			void target.setTriggerDescription({
				rotate: "Adjust level",
				push: GESTURE_LABELS[this.gestureFor(settings, "press")],
				touch: GESTURE_LABELS[this.gestureFor(settings, "touch")],
			});
		}

		render();
	}

	private primeChannel(gm: GlobalConnection, settings: GlobalVolumeSettings): void {
		const spec = this.channelSpec(settings, gm);
		if (spec !== undefined) {
			const key = `${gm.options_.host}:${gm.options_.sendPort}:${spec.bus}:${spec.ch}`;
			if (!this.primedChannels.has(key)) {
				this.primedChannels.add(key);
				gm.trigger(g.sendChan(spec.bus, spec.ch), 1.0);
			}
		}

		// Input/playback channel faders arrive as mix nodes; pull their Main
		// Out submix so the dial has a starting value.
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

		// Mix-node targets request the whole submix. Value 1 requests all nodes;
		// value 2 would omit nodes below -65 dB, which a dial still needs.
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
			// Output list with "follow Main Out" prepended, for the submix picker.
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

		// Balance is its own scale and its own address; nothing below applies.
		if (this.isPan(settings)) {
			if (this.stepPan(gm, settings, ticks)) void this.render(gm, ev.action, settings);
			return;
		}

		const address = this.addressFor(settings, gm);
		const isGain = (settings.target ?? "channel") === "gain";

		if (address === undefined) {
			// Before /controlroom/mainout arrives the target fader is unknown.
			streamDeck.logger.warn("Ignoring move: Main Out assignment not received yet");
			gm.requestFullRefresh();
			return;
		}

		let level = this.resolveLevel(gm, settings, address);
		if (level === undefined && (settings.target ?? "channel") === "channel") {
			// TotalMix 2.1 beta 2 does not transmit fader state for these channels
			// on any request. Seeds at -oo, the only value that cannot be louder
			// than intended, and steps from subsequent writes.
			streamDeck.logger.info(
				`No fader state from TotalMix for ${address}; starting from -oo and stepping locally.`,
			);
			// Seeds on the last candidate: for input/playback that is the Main Out
			// mix node, the only fader form transmitted.
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

		// Step in the representation TotalMix reported (or the seed).
		let next01: number;
		if (level.kind === "faderlin") {
			next01 = stepDb(level.value, ticks * perTick);
			gm.setCoalesced(level.address, next01);
		} else {
			const nextDb = Math.min(MAX_DB, Math.max(MIN_DB, level.value + ticks * perTick));
			gm.setCoalesced(level.address, nextDb);
			next01 = dbToFader(nextDb);
		}

		// Wire capture confirmed the device's dialect: output levels live on
		// /output/N/faderlin, input/playback levels ONLY on the /mix tree —
		// the channel-tree fader forms for in/pb are never transmitted. The
		// resolved candidate above already IS the confirmed form, so the single
		// write to level.address is the whole job.

		void this.render(gm, ev.action, settings, next01);
	}

	/**
	 * The level parameter to step, in the representation TotalMix actually used
	 * for this channel: faderlin (0..1 curve) where reported, otherwise the dB
	 * sibling (mix "fader", channel "volume"). Gain reports itself.
	 */
	private resolveLevel(
		gm: GlobalConnection,
		settings: GlobalVolumeSettings,
		address: string,
	): { kind: "faderlin" | "db"; address: string; value: number } | undefined {
		// Try every address TotalMix might have used for this level, and answer
		// on the one it actually spoke. Which one that is depends on the Global
		// OSC Detailed Settings ("Send faders in linear scale") and on the bus:
		// output faders arrive as channel faderlin/volume, while input/playback
		// levels are observed to arrive as mix-tree messages.
		for (const c of this.levelCandidates(settings, gm, address)) {
			const v = gm.get(c.address);
			if (typeof v === "number") return { kind: c.kind, address: c.address, value: v };
		}
		return undefined;
	}

	/** All addresses this target's level may arrive on, most specific first. */
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

		// Input/playback channel faders: also accept the channel's node into the
		// Main Out submix — the form TotalMix transmits for these buses.
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

	/** The current value as faderlin 0..1, for display, whatever the source. */
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

	/**
	 * The dB sibling of a faderlin address, where one exists: mix nodes carry
	 * "fader" (documented [dB]); output channels carry "volume".
	 */
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

	/** The mix node the explicit mixNode target resolves to. */
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

	/** Resolves the bus + channel a channel-scoped target points at. */
	private channelSpec(
		settings: GlobalVolumeSettings,
		gm: GlobalConnection,
	): { bus: g.GlobalBus; ch: number } | undefined {
		switch (settings.target ?? "channel") {
			case "channel":
			case "pan":
				// A channel pan hangs off the same channel picker as its fader.
				return { bus: this.busOf(settings), ch: num(settings.channel, 0) };
			case "gain":
				// Legacy fallback: pre-4.1.1 configs stored the gain channel in
				// "channel" before the setting was split.
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

	/** The output channel whose submix an in/pb fader targets. */
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

	/** The kind of thing this button points at, which is what gesture rules key off. */
	private kindOfTarget(settings: GlobalVolumeSettings): GlobalKind {
		return settings.target ?? "channel";
	}

	/** True for the two balance targets, whose value is -1..+1 rather than a fader. */
	private isPan(settings: GlobalVolumeSettings): boolean {
		const target = settings.target ?? "channel";
		return target === "pan" || target === "mixPan";
	}

	/**
	 * The balance address this dial controls, or undefined when it is not a pan.
	 *
	 * A channel pan and a mix node's pan are different parameters: the first is
	 * the channel's own position, the second its position within one submix.
	 */
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

	/** Steps a balance, snapped to the grid so centre is reachable by turning. */
	private stepPan(gm: GlobalConnection, settings: GlobalVolumeSettings, ticks: number): boolean {
		const address = this.panAddress(settings, gm);
		if (address === undefined) return false;

		const current = gm.getNumber(address, 0);
		const stepped = current + ticks * BALANCE_STEP;
		const snapped = Math.round(stepped / BALANCE_STEP) * BALANCE_STEP;
		gm.setCoalesced(address, Math.min(1, Math.max(-1, snapped)));
		return true;
	}

	/** The gesture this button performs in the given slot, after defaults and applicability. */
	private gestureFor(settings: GlobalVolumeSettings, slot: GestureSlot): Gesture {
		return resolveGesture(
			slot === "press" ? settings.press : settings.touch,
			this.kindOfTarget(settings),
			slot,
			GLOBAL,
		);
	}

	/** Pressing the dial mutes, unless the user has bound the press to something else. */
	override onDialDown(ev: DialDownEvent<GlobalVolumeSettings>): void {
		this.gesture(ev, "press");
	}

	/**
	 * Tapping the touch display above the dial. Dims on the main out and drops to
	 * -oo elsewhere, unless bound otherwise — the same pairing the classic action
	 * uses, so a deck mixing both protocols behaves consistently.
	 */
	override onTouchTap(ev: TouchTapEvent<GlobalVolumeSettings>): void {
		this.gesture(ev, "touch");
	}

	/** Runs one of the two dial gestures and repaints if it moved the level. */
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

	/**
	 * Carries out one resolved gesture.
	 *
	 * Returns the level written as faderlin 0..1 so the caller can repaint before
	 * TotalMix confirms, or undefined when the gesture did not move this dial's
	 * own value. Every on/off here is stateful and reported, so toggleSet reads
	 * the cached state and sends its inverse rather than sending a blind flip.
	 */
	private perform(
		gm: GlobalConnection,
		settings: GlobalVolumeSettings,
		gesture: Gesture,
	): number | undefined {
		const target = settings.target ?? "channel";
		const spec = this.channelSpec(settings, gm);

		/** Flips a switch on this dial's own channel, where it has one. */
		const flipChannel = (param: string): undefined => {
			if (spec !== undefined) gm.toggleSet(g.channel(spec.bus, spec.ch, param));
			return undefined;
		};

		switch (gesture) {
			case "none":
				return undefined;

			case "mute":
				if (target === "main") {
					// Global OSC's control room has dim, mono, talkback, speaker B,
					// external in, mute FX and recall — and no mute. So muting the
					// main out means the same here as classically: drop the fader to
					// -oo and remember where it was.
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
				// Balance is -1..+1, so dead centre is exactly zero.
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
				gm.toggleSet(g.CR_RECALL);
				return undefined;
			case "globalMute":
				gm.toggleSet(g.GLOBAL_MUTE);
				return undefined;
			case "globalSolo":
				gm.toggleSet(g.GLOBAL_SOLO);
				return undefined;

			default:
				// auto never survives resolveGesture; cue, centre and bypass are not
				// in this protocol's vocabulary and cannot be resolved to here.
				return undefined;
		}
	}

	/**
	 * Writes a level in dB, in whichever representation TotalMix reported for this
	 * dial, and returns it as faderlin 0..1.
	 *
	 * The two are not interchangeable: output channels report a 0..1 faderlin and
	 * mix nodes a dB "fader", and writing the wrong one addresses nothing.
	 */
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

	/**
	 * Drops this dial's level to -oo, or puts it back where it was.
	 *
	 * Returns the value written as faderlin 0..1, or undefined when nothing was
	 * sent — already down and no earlier level known, so nowhere to restore to.
	 */
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

	/**
	 * The mute and solo flags this dial's wash reads, most significant first.
	 *
	 * A mix node has solo but no mute of its own — it is a send, and muting one
	 * means pulling it down — so it contributes only the solo. The control room's
	 * Main target has neither: dim is its equivalent and belongs to its own
	 * button, exactly as global mute and global solo do.
	 */
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

	/**
	 * Which wash this dial should be painted in.
	 *
	 * Solo outranks mute, as in the classic action: a solo left on is what
	 * silences everything else and is easy to forget, while a mute announces
	 * itself by that channel being quiet. washAddresses returns solo first.
	 */
	private washFor(settings: GlobalVolumeSettings, gm: GlobalConnection): Wash {
		const [solo, mute] = this.washAddresses(settings, gm);
		if (solo !== undefined && asBool(gm.get(solo) ?? 0)) return "solo";
		if (mute !== undefined && asBool(gm.get(mute) ?? 0)) return "mute";
		return "none";
	}

	/** Name addresses whose arrival should refresh this action's title. */
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

		// No Val strings in this protocol; both formats are exact from the table:
		// faderlin via the published curve, gain as the whole-dB value it is.
		const label = isGain ? `${Math.round(value)} dB` : formatDb(value);
		// The fill bar shares the stepping ceiling, so on a 65 dB device the dial
		// reads full at 65 rather than stopping at 87% of its travel.
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

		await target.setTitle(gm.connected ? label : "—");
	}

	/**
	 * Paints a balance dial.
	 *
	 * Separate from the fader path because nothing is shared: the value runs
	 * -1..+1 rather than 0..1, the readout is TotalMix's L/C/R notation rather
	 * than dB, and the position bar has to be mapped from a centred range.
	 */
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

		await target.setTitle(label);
	}

	private releaseFor(id: string): void {
		const unsubs = this.cleanup.get(id);
		if (unsubs === undefined) return;
		for (const fn of unsubs) fn();
		this.cleanup.delete(id);
	}
}
