import * as g from "../globalosc/addresses.js";
import { num } from "../totalmix/settings.js";

export type MixSourceMuteSettings = {
	readonly target?: string;
	readonly mixSrcBus?: "in" | "pb";
	readonly mixSrc?: number | string;
	readonly press?: string;
	readonly touch?: string;
};

/** Resolves a mix node's source to its real input/playback channel mute. */
export function mixSourceMuteAddress(settings: MixSourceMuteSettings): string | undefined {
	if (settings.target !== "mixNode") return undefined;
	return g.mixSourceMute(settings.mixSrcBus === "pb" ? "pb" : "in", num(settings.mixSrc, 0));
}

/** Source mute feedback is shown only when the dial exposes that operation. */
export function usesMixSourceMuteGesture(settings: MixSourceMuteSettings): boolean {
	return (
		settings.target === "mixNode" &&
		(settings.press === "muteSource" || settings.touch === "muteSource")
	);
}
