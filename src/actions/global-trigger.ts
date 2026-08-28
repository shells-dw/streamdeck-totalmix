import streamDeck, {
	action,
	SingletonAction,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";
import * as g from "../globalosc/addresses.js";
import { globalMixFor } from "../globalosc/connection.js";
import { globalConnectionOptions } from "../globalosc/datasource.js";
import { seedDefaults } from "../totalmix/defaults.js";
import { num } from "../totalmix/settings.js";
import { alertIfDown, forgetAlertState } from "./alert.js";

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

/** /durec/state string that lights each transport key. */
const DUREC_STATE_MATCH: Partial<Record<GlobalTriggerMode, string>> = {
	durecPlay: "Play",
	durecPause: "Pause",
	durecStop: "Stop",
	durecRecord: "Record",
};

/** Snapshot state artwork (DisableAutomaticStates: state follows TotalMix reports). */
const STATE_IMG = { on: "imgs/mixerOn", off: "imgs/mixerOff" } as const;

/** Transport artwork per mode; absent = STATE_IMG. */
const MODE_IMG: Partial<Record<string, { on: string; off: string }>> = {
	durecRecord: { on: "imgs/recOn", off: "imgs/recOff" },
	durecPlay: { on: "imgs/playOn", off: "imgs/playOff" },
	durecPause: { on: "imgs/playOn", off: "imgs/playOff" },
	durecStop: { on: "imgs/stopOn", off: "imgs/stopOff" },
};

/**
 * Global OSC (f) commands (value < 0.5 ignored) plus /showwindow (plain f).
 * Snapshot keys light on /snapshot/load/N >= 2; transport keys on the
 * matching /durec/state string.
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
				// 0 = off, 2 = active, 3 = changed.
				const on = gm.getNumber(address, 0) >= 2;
				if (target.isKey()) {
					void target.setImage(on ? STATE_IMG.on : STATE_IMG.off);
					void target.setState(on ? 1 : 0);
				}
			};
			unsubs.push(gm.subscribe(address, render), gm.onConnectionChange(render));
			render();
		} else if (DUREC_STATE_MATCH[mode] !== undefined) {
			const img = MODE_IMG[mode] ?? STATE_IMG;
			const render = (): void => {
				const on = gm.getString(g.DUREC_STATE) === DUREC_STATE_MATCH[mode];
				if (target.isKey()) {
					void target.setImage(on ? img.on : img.off);
					void target.setState(on ? 1 : 0);
				}
			};
			unsubs.push(gm.subscribe(g.DUREC_STATE, render), gm.onConnectionChange(render));
			render();
		} else if (target.isKey()) {
			// Stateless modes: restore the manifest/user image.
			void target.setImage();
			void target.setState(0);
		}

		this.releaseFor(target.id);
		this.cleanup.set(target.id, unsubs);
	}

	override onWillDisappear(ev: WillDisappearEvent<GlobalTriggerSettings>): void {
		this.releaseFor(ev.action.id);
		forgetAlertState(ev.action.id);
	}

	override onKeyDown(ev: KeyDownEvent<GlobalTriggerSettings>): void {
		const settings = ev.payload.settings;
		const gm = globalMixFor(globalConnectionOptions(settings));
		if (alertIfDown(ev.action, gm)) return;
		const mode = settings.mode ?? "snapshot";
		streamDeck.logger.info(`Key press: global trigger ${mode}`);

		switch (mode) {
			case "snapshot":
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
				// 1.0: stopping a recording needs two presses; > 10 would bypass that.
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
				gm.trigger(g.SHOW_WINDOW, 1.0);
				return;
			case "hideWindow":
				gm.trigger(g.SHOW_WINDOW, 0.0);
				return;
		}
	}

	private snapshotNumber(settings: GlobalTriggerSettings): number {
		return Math.min(Math.max(num(settings.index, 1), 1), 8);
	}

	private releaseFor(id: string): void {
		const unsubs = this.cleanup.get(id);
		if (unsubs === undefined) return;
		for (const fn of unsubs) fn();
		this.cleanup.delete(id);
	}
}
