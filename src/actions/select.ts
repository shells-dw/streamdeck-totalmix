import {
	action,
	SingletonAction,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";
import * as addr from "../totalmix/addresses.js";
import { totalMixFor } from "../totalmix/connection.js";
import { seedDefaults } from "../totalmix/defaults.js";
import { connectionOptions, num } from "../totalmix/settings.js";
import { alertIfDown, forgetAlertState } from "./alert.js";

export type SelectSettings = {
	mode?: "submix" | "bankStart" | "offsetInBank" | "bus" | "quickWorkspace" | "nav" | "snapshot";
	/** Index for submix / bankStart / offsetInBank / quickWorkspace. */
	value?: number;
	bus?: addr.Bus;
	nav?: "trackNext" | "trackPrev" | "bankNext" | "bankPrev";
	host?: string;
	sendPort?: number;
	receivePort?: number;
};

/** Submix, bank start, offset, bus, Quick Workspace, snapshot and navigation keys. */
@action({ UUID: "de.shells.totalmixgen2.select" })
export class Select extends SingletonAction<SelectSettings> {
	private readonly cleanup = new Map<string, Array<() => void>>();

	override async onWillAppear(ev: WillAppearEvent<SelectSettings>): Promise<void> {
		await seedDefaults(ev.action, ev.payload.settings, "classic");
		await this.setup(ev.action, ev.payload.settings);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<SelectSettings>): Promise<void> {
		await this.setup(ev.action, ev.payload.settings);
	}

	private async setup(
		target: WillAppearEvent<SelectSettings>["action"],
		settings: SelectSettings,
	): Promise<void> {
		const tm = totalMixFor(connectionOptions(settings));

		// Submix keys show the active submix name (/1/labelSubmix).
		const render = (): void => {
			if ((settings.mode ?? "submix") !== "submix") {
				void target.setTitle("");
				return;
			}
			const name = tm.getString(addr.LABEL_SUBMIX);
			if (name !== undefined) void target.setTitle(name);
		};

		this.releaseFor(target.id);
		this.cleanup.set(target.id, [tm.subscribe(addr.LABEL_SUBMIX, render)]);

		render();
	}

	override onWillDisappear(ev: WillDisappearEvent<SelectSettings>): void {
		this.releaseFor(ev.action.id);
		forgetAlertState(ev.action.id);
	}

	override onKeyDown(ev: KeyDownEvent<SelectSettings>): void {
		const s = ev.payload.settings;
		const tm = totalMixFor(connectionOptions(s));
		if (alertIfDown(ev.action, tm)) return;
		const value = num(s.value, 0);

		switch (s.mode ?? "submix") {
			case "submix":
				// 0-based.
				tm.send(addr.SET_SUBMIX, value);
				return;
			case "bankStart":
				tm.send(addr.SET_BANK_START, value);
				return;
			case "offsetInBank":
				tm.send(addr.SET_OFFSET_IN_BANK, value);
				return;
			case "quickWorkspace":
				tm.send(addr.LOAD_QUICK_WORKSPACE, Math.min(Math.max(value, 1), 30));
				return;
			case "snapshot":
				tm.toggle(addr.snapshot(value));
				return;
			case "bus":
				tm.toggle(addr.bus(s.bus ?? "output"));
				return;
			case "nav":
				tm.send(this.navAddress(s.nav ?? "trackNext"), 1.0);
				return;
		}
	}

	private navAddress(nav: NonNullable<SelectSettings["nav"]>): string {
		switch (nav) {
			case "trackNext":
				return addr.TRACK_NEXT;
			case "trackPrev":
				return addr.TRACK_PREV;
			case "bankNext":
				return addr.BANK_NEXT;
			case "bankPrev":
				return addr.BANK_PREV;
		}
	}

	private releaseFor(id: string): void {
		const unsubs = this.cleanup.get(id);
		if (unsubs === undefined) return;
		for (const fn of unsubs) fn();
		this.cleanup.delete(id);
	}
}
