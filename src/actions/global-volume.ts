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
import { dbToFader, faderToBar, formatDb, stepDb, MAX_DB, MIN_DB } from "../osc/curves.js";
import * as g from "../globalosc/addresses.js";
import { GAIN_MAX_DB, stepGainDb } from "../globalosc/gain.js";
import { globalMixFor, type GlobalConnection } from "../globalosc/connection.js";
import {
	buildChannelItems,
	globalConnectionOptions,
	replyGlobalChannelDatasource,
} from "../globalosc/datasource.js";
import { datasourceEvent } from "../totalmix/datasource.js";
import { num } from "../totalmix/settings.js";

export type GlobalVolumeSettings = {
	/** What to control. "main" follows the Control Room's Main Out assignment. */
	target?: "main" | "channel" | "mixNode" | "gain";
	/** Bus for target "channel". */
	bus?: g.GlobalBus | "";
	/** 0-based channel for target "channel". */
	channel?: number | string;
	/**
	 * Which output's submix an input/playback fader belongs to. Wire capture
	 * confirmed in/pb faders exist only as mix nodes, one per submix: the GUI
	 * fader move emitted /mix/in/0/0/faderlin — the node of the submix
	 * selected in the window. "auto"/empty follows /controlroom/mainout;
	 * a number pins a specific output channel's submix.
	 */
	submixOut?: number | string;
	/**
	 * 0-based channel for target "gain". A separate setting from "channel" on
	 * purpose: the PI shows one dropdown per target, and two dropdowns bound to
	 * the same setting fight each other (the hidden one can silently overwrite
	 * what the visible one just stored).
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
	host?: string;
	sendPort?: number;
	receivePort?: number;
};

const DEFAULT_STEP_DB = 1.5;


/**
 * Volume control over the Global OSC protocol.
 *
 * Addressing is absolute; the one indirection is the "main" target: Global OSC
 * has no mastervolume, because the Main Out simply IS an output channel. Which
 * one is read from /controlroom/mainout (0-based output channel number, per
 * the table's example "0.0 = channel 1+2"), and the action re-targets itself
 * whenever that assignment changes.
 *
 * Channel faders address /{input|playback|output}/{ch}/faderlin — the table's
 * channel grid applies to all three buses alike. Fader state prefers faderlin
 * (curve published in the table); where only the dB sibling has arrived (mix
 * "fader" [dB], channel "volume"), it is converted through that same curve as
 * the starting point. Writes always go out as faderlin.
 */
@action({ UUID: "de.shellsdw.totalmix2.globalvolume" })
export class GlobalVolume extends SingletonAction<GlobalVolumeSettings> {
	private readonly cleanup = new Map<string, Array<() => void>>();

	/**
	 * Last Main Out assignment each "main"-target action saw. Re-setup happens
	 * only when the assignment actually changes — without the guard, the
	 * cached-value delivery a fresh subscription performs would re-trigger
	 * setup in an endless loop.
	 */
	private readonly lastMainOut = new Map<string, number>();

	/** Channels already primed with /sendchan this session, per connection. */
	private readonly primedChannels = new Set<string>();

	override async onWillAppear(ev: WillAppearEvent<GlobalVolumeSettings>): Promise<void> {
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

		// Ask TotalMix for this specific channel's parameters once. The bulk
		// /sendall at connect can be lost when the plugin starts first; this
		// targeted request makes each configured dial self-sufficient.
		this.primeChannel(gm, settings);

		this.releaseFor(target.id);
		this.cleanup.set(target.id, unsubs);

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

		// Mix-node targets: ask for the whole submix's nodes (value 1 = all
		// nodes, not just those above -65 dB — a node parked at -oo must still
		// report, or the dial for it would refuse to move).
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
		const address = this.addressFor(settings, gm);
		const isGain = (settings.target ?? "channel") === "gain";

		if (address === undefined) {
			// Main target before /controlroom/mainout has arrived: the fader to
			// move is literally unknown. Ask and wait.
			streamDeck.logger.warn("Ignoring move: Main Out assignment not received yet");
			gm.requestFullRefresh();
			return;
		}

		let level = this.resolveLevel(gm, settings, address);
		if (level === undefined && (settings.target ?? "channel") === "channel") {
			// TotalMix (2.1 beta 2) does not transmit fader state for these
			// channels no matter what is requested, so waiting means the dial
			// never works. Adopt -oo as the starting level — the one seed that
			// can never be louder than intended — and step from our own writes
			// from here on.
			streamDeck.logger.info(
				`No fader state from TotalMix for ${address}; starting from -oo and stepping locally.`,
			);
			// Seed on the last candidate for this target — for in/pb that is the
			// Main Out mix node, the only fader form this device transmits.
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
			const next = stepGainDb(level.value, ticks);
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

	/**
	 * Dial press: dim for the Main target (the monitoring gesture the classic
	 * action uses), mute for channel/gain, solo for a mix node.
	 */
	override onDialDown(ev: DialDownEvent<GlobalVolumeSettings>): void {
		const settings = ev.payload.settings;
		const gm = globalMixFor(globalConnectionOptions(settings));
		const target = settings.target ?? "channel";

		if (target === "main") {
			gm.toggleSet(g.CR_DIM);
			return;
		}
		if (target === "mixNode") {
			gm.toggleSet(
				g.mixSolo(settings.mixSrcBus ?? "in", num(settings.mixSrc, 0), num(settings.mixOut, 0)),
			);
			return;
		}
		const spec = this.channelSpec(settings, gm);
		if (spec !== undefined) gm.toggleSet(g.channelMute(spec.bus, spec.ch));
	}

	/** Name addresses whose arrival should refresh this action's title. */
	private nameAddresses(settings: GlobalVolumeSettings, gm: GlobalConnection): string[] {
		const target = settings.target ?? "channel";
		if (target === "mixNode") {
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
		if (target === "mixNode") {
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
		const address = this.addressFor(settings, gm);
		const isGain = (settings.target ?? "channel") === "gain";

		const value =
			override ??
			(address !== undefined ? this.currentValue(gm, settings, address) : undefined);

		if (value === undefined) {
			if (target.isDial()) {
				await target.setFeedback({
					title: this.labelFor(gm, settings),
					value: "—",
					indicator: { value: 0 },
				});
			} else {
				await target.setTitle("—");
			}
			return;
		}

		// No Val strings in this protocol; both formats are exact from the table:
		// faderlin via the published curve, gain as the whole-dB value it is.
		const label = isGain ? `${Math.round(value)} dB` : formatDb(value);
		const bar = isGain
			? Math.round(Math.min(1, Math.max(0, value / GAIN_MAX_DB)) * 100)
			: faderToBar(value);

		if (target.isDial()) {
			await target.setFeedback({
				title: this.labelFor(gm, settings),
				value: gm.connected ? label : "—",
				indicator: { value: bar },
			});
			return;
		}

		await target.setTitle(gm.connected ? label : "—");
	}

	private releaseFor(id: string): void {
		const unsubs = this.cleanup.get(id);
		if (unsubs === undefined) return;
		for (const fn of unsubs) fn();
		this.cleanup.delete(id);
	}
}
