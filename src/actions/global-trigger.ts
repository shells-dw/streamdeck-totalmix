import streamDeck, {
	action,
	SingletonAction,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";
import * as g from "../globalosc/addresses.js";
import { globalMixFor, type GlobalConnection } from "../globalosc/connection.js";
import { globalConnectionOptions } from "../globalosc/datasource.js";
import { seedDefaults } from "../totalmix/defaults.js";
import { num } from "../totalmix/settings.js";

export type GlobalTriggerSettings = {
	mode?: GlobalTriggerMode;
	/** Snapshot (1-8) or layout number (from 1). */
	index?: number | string;
	host?: string;
	sendPort?: number;
	receivePort?: number;
};

export type GlobalTriggerMode =
	| "snapshot"
	| "layout"
	| "undo"
	| "redo"
	| "recall"
	| "durecPlay"
	| "durecPause"
	| "durecStop"
	| "durecRecord"
	| "durecNext"
	| "durecPrevious"
	| "showWindow"
	| "hideWindow";

/** DURec keys light up when /durec/state carries their matching string. */
const DUREC_STATE_MATCH: Partial<Record<GlobalTriggerMode, string>> = {
	durecPlay: "Play",
	durecPause: "Pause",
	durecStop: "Stop",
	durecRecord: "Record",
};

/**
 * State artwork. mixerOff is the red glyph, mixerOn the green one: red while a
 * snapshot is not loaded or a transport state is not current, green while it is.
 * Applied with setImage because the manifest declares one pair for the whole
 * action. DisableAutomaticStates is set, so state follows TotalMix's reports
 * rather than key presses.
 */
const STATE_IMG = { on: "imgs/mixerOn", off: "imgs/mixerOff" } as const;

/**
 * One-shot commands over the Global OSC protocol: everything typed (f) in the
 * table (value below 0.5 ignored, no state carried by the outgoing value), plus
 * the show/hide window pair, which is a plain f.
 *
 * Feedback where the protocol offers it:
 * - Snapshots: TotalMix signals 0 (off), 2 (active) or 3 (changed) on the same
 *   /snapshot/load/N address, so a snapshot key lights when its snapshot is
 *   active — including after loads from the GUI or a /snapshot/save.
 * - DURec transport: /durec/state carries "Not ready"/"Stop"/"Record"/"Play"/
 *   "Pause"; each transport key lights while its state is current.
 */
@action({ UUID: "de.shells.totalmixgen2.globaltrigger" })
export class GlobalTrigger extends SingletonAction<GlobalTriggerSettings> {
	private readonly cleanup = new Map<string, Array<() => void>>();

	override async onWillAppear(ev: WillAppearEvent<GlobalTriggerSettings>): Promise<void> {
		await seedDefaults(ev.action, ev.payload.settings, "global");
		await this.setup(ev.action, ev.payload.settings);
	}

	override async onDidReceiveSettings(
		ev: DidReceiveSettingsEvent<GlobalTriggerSettings>,
	): Promise<void> {
		await this.setup(ev.action, ev.payload.settings);
	}

	private async setup(
		target: WillAppearEvent<GlobalTriggerSettings>["action"],
		settings: GlobalTriggerSettings,
	): Promise<void> {
		const gm = globalMixFor(globalConnectionOptions(settings));
		const mode = settings.mode ?? "snapshot";

		const unsubs: Array<() => void> = [];

		if (mode === "snapshot") {
			const address = g.snapshotLoad(this.snapshotNumber(settings));
			const render = (): void => {
				// 0 = off, 2 = active, 3 = changed; active and changed both mean
				// this is the loaded snapshot.
				const on = gm.getNumber(address, 0) >= 2;
				if (target.isKey()) {
					void target.setImage(on ? STATE_IMG.on : STATE_IMG.off);
					void target.setState(on ? 1 : 0);
				}
			};
			unsubs.push(gm.subscribe(address, render), gm.onConnectionChange(render));
			render();
		} else if (DUREC_STATE_MATCH[mode] !== undefined) {
			const render = (): void => {
				const on = gm.getString(g.DUREC_STATE) === DUREC_STATE_MATCH[mode];
				if (target.isKey()) {
					void target.setImage(on ? STATE_IMG.on : STATE_IMG.off);
					void target.setState(on ? 1 : 0);
				}
			};
			unsubs.push(gm.subscribe(g.DUREC_STATE, render), gm.onConnectionChange(render));
			render();
		} else if (target.isKey()) {
			// One-shot modes (undo, layouts, show/hide window) carry no state, so
			// the icon must not move: the manifest or user artwork is restored and
			// the action parked on its neutral state.
			void target.setImage();
			void target.setState(0);
		}

		this.releaseFor(target.id);
		this.cleanup.set(target.id, unsubs);
	}

	override onWillDisappear(ev: WillDisappearEvent<GlobalTriggerSettings>): void {
		this.releaseFor(ev.action.id);
	}

	override onKeyDown(ev: KeyDownEvent<GlobalTriggerSettings>): void {
		const settings = ev.payload.settings;
		const gm = globalMixFor(globalConnectionOptions(settings));
		const mode = settings.mode ?? "snapshot";
		streamDeck.logger.info(`Key press: global trigger ${mode}`);

		switch (mode) {
			case "snapshot":
				// The table: "only receive-value accepted: 1".
				gm.trigger(g.snapshotLoad(this.snapshotNumber(settings)), 1.0);
				return;
			case "layout":
				gm.trigger(g.layoutLoad(Math.max(1, num(settings.index, 1))), 1.0);
				return;
			case "undo":
				gm.trigger(g.UNDO, 1.0);
				return;
			case "redo":
				gm.trigger(g.REDO, 1.0);
				return;
			case "recall":
				gm.trigger(g.CR_RECALL, 1.0);
				return;
			case "durecPlay":
				gm.trigger(g.DUREC_PLAY, 1.0);
				return;
			case "durecPause":
				gm.trigger(g.DUREC_PAUSE, 1.0);
				return;
			case "durecStop":
				// 1.0, never above 10: per the table, stopping a running recording
				// takes two presses, and a value above 10 bypasses that
				// confirmation.
				gm.trigger(g.DUREC_STOP, 1.0);
				return;
			case "durecRecord":
				gm.trigger(g.DUREC_RECORD, 1.0);
				return;
			case "durecNext":
				gm.trigger(g.DUREC_NEXT, 1.0);
				return;
			case "durecPrevious":
				gm.trigger(g.DUREC_PREVIOUS, 1.0);
				return;
			case "showWindow":
				// Plain f, not (f): 1 shows, 0 hides.
				gm.trigger(g.SHOW_WINDOW, 1.0);
				return;
			case "hideWindow":
				gm.trigger(g.SHOW_WINDOW, 0.0);
				return;
		}
	}

	private snapshotNumber(settings: GlobalTriggerSettings): number {
		// TotalMix offers 8 snapshots, numbered from 1.
		return Math.min(Math.max(num(settings.index, 1), 1), 8);
	}

	/** Exposed for tests. */
	static durecMatch(mode: GlobalTriggerMode): string | undefined {
		return DUREC_STATE_MATCH[mode];
	}

	private releaseFor(id: string): void {
		const unsubs = this.cleanup.get(id);
		if (unsubs === undefined) return;
		for (const fn of unsubs) fn();
		this.cleanup.delete(id);
	}

	/** Exposed for render-in-isolation tests. */
	protected connectionFor(settings: GlobalTriggerSettings): GlobalConnection {
		return globalMixFor(globalConnectionOptions(settings));
	}
}
