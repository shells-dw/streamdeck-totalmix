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
import { buttonKeyImage, type ButtonGlyph } from "../render/strip.js";
import { TM } from "../render/theme.js";

export type SelectSettings = {
	mode?: "submix" | "bankStart" | "offsetInBank" | "bus" | "quickWorkspace" | "nav" | "snapshot";
	/** Index for submix / bankStart / offsetInBank / quickWorkspace. */
	value?: number;
	bus?: addr.Bus;
	nav?: "trackNext" | "trackPrev" | "bankNext" | "bankPrev";
	/** Artwork: TotalMix-style button (default) or the manifest icon with the submix name. */
	look?: "strip" | "icon";
	host?: string;
	sendPort?: number;
	receivePort?: number;
};

/** Submix, bank start, offset, bus, Quick Workspace, snapshot and navigation keys. */
@action({ UUID: "de.shells.totalmixgen2.select" })
export class Select extends SingletonAction<SelectSettings> {
	private readonly cleanup = new Map<string, Array<() => void>>();

	/** Last key image sent per action, so an unchanged face is not re-sent. */
	private readonly keyImages = new Map<string, string>();

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

		const strip = settings.look !== "icon";

		// Submix keys show the active submix name (/1/labelSubmix).
		const render = (): void => {
			if (strip) {
				const image = this.faceImage(settings, !tm.connected);
				if (this.keyImages.get(target.id) === image) return;
				this.keyImages.set(target.id, image);
				void target.setTitle("");
				void target.setImage(image);
				return;
			}
			if ((settings.mode ?? "submix") !== "submix") {
				void target.setTitle("");
				return;
			}
			const name = tm.getString(addr.LABEL_SUBMIX);
			if (name !== undefined) void target.setTitle(name);
		};

		this.releaseFor(target.id);
		this.cleanup.set(target.id, [tm.subscribe(addr.LABEL_SUBMIX, render), tm.onConnectionChange(render)]);

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

	/** TotalMix-style face: the target number or bus on the face, the kind underneath. Stateless, never lit. */
	private faceImage(settings: SelectSettings, offline: boolean): string {
		const value = num(settings.value, 0);
		let label = "";
		let glyph: ButtonGlyph | undefined;
		let caption = "";
		switch (settings.mode ?? "submix") {
			case "submix":
				label = String(value + 1);
				caption = "Submix";
				break;
			case "bankStart":
				label = String(value + 1);
				caption = "Bank start";
				break;
			case "offsetInBank":
				label = String(value + 1);
				caption = "Channel";
				break;
			case "quickWorkspace":
				label = String(Math.min(Math.max(value, 1), 30));
				caption = "Workspace";
				break;
			case "snapshot":
				label = String(value);
				caption = "Snapshot";
				break;
			case "bus":
				label = { input: "IN", playback: "PB", output: "OUT" }[settings.bus ?? "output"];
				caption = "Bus";
				break;
			case "nav": {
				const nav = settings.nav ?? "trackNext";
				glyph = nav.endsWith("Next") ? "next" : "previous";
				caption = nav.startsWith("track") ? "Track" : "Bank";
				break;
			}
		}
		return buttonKeyImage({ label, glyph, caption, on: false, colour: TM.mute, offline });
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
		this.keyImages.delete(id);
		const unsubs = this.cleanup.get(id);
		if (unsubs === undefined) return;
		for (const fn of unsubs) fn();
		this.cleanup.delete(id);
	}
}
