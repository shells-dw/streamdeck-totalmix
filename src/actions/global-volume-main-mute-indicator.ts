import type { OscValue } from "../osc/codec.js";
import {
	controlRoomMainMuteState,
	subscribeControlRoomMainMute,
} from "./control-room-main-mute.js";

export type MainMuteIndicatorSettings = {
	readonly target?: string;
	readonly press?: string;
	readonly touch?: string;
};

type StateReader = {
	get(address: string): OscValue | undefined;
};

type StateSource = StateReader & {
	subscribe(address: string, listener: (value: OscValue) => void): () => void;
};

/** The badge describes the ARC-style gesture, not every target's distinct mute behaviour. */
export function usesMainMuteIndicator(settings: MainMuteIndicatorSettings): boolean {
	return (
		settings.target === "activeMonitor" &&
		(settings.press === "muteMainOut" || settings.touch === "muteMainOut")
	);
}

/** Visible badge state. Unknown/disconnected state is deliberately rendered as clear. */
export function mainMuteIndicatorOn(
	settings: MainMuteIndicatorSettings,
	state: StateReader,
	connected: boolean,
): boolean {
	return connected && usesMainMuteIndicator(settings) && controlRoomMainMuteState(state) === true;
}

/**
 * Establishes exactly one shared-helper subscription even when both gesture
 * slots use Mute Main Out. Inapplicable targets do not subscribe at all.
 */
export function subscribeMainMuteIndicator(
	settings: MainMuteIndicatorSettings,
	state: StateSource,
	listener: (on: boolean) => void,
): () => void {
	if (!usesMainMuteIndicator(settings)) return (): void => {};
	return subscribeControlRoomMainMute(state, (muted) => listener(muted === true));
}
