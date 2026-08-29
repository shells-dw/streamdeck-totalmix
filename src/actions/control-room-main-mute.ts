import type { OscValue } from "../osc/codec.js";
import { asBool } from "../osc/codec.js";
import * as g from "../globalosc/addresses.js";

type StateReader = {
	get(address: string): OscValue | undefined;
};

type StateSource = StateReader & {
	subscribe(address: string, listener: (value: OscValue) => void): () => void;
};

type StateWriter = StateReader & {
	set(address: string, value: number): void;
};

export type ControlRoomMainOutputs = {
	readonly mainOut: number;
	readonly mainOutB: number;
	readonly mainMuteAddress: string;
	readonly mainOutBMuteAddress: string;
};

function assignedOutput(state: StateReader, address: string): number | undefined {
	const value = state.get(address);
	return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : undefined;
}

/** Resolves both Control Room monitor assignments to their real output mute addresses. */
export function resolveControlRoomMainOutputs(
	state: StateReader,
): ControlRoomMainOutputs | undefined {
	const mainOut = assignedOutput(state, g.CR_MAINOUT);
	const mainOutB = assignedOutput(state, g.CR_MAINOUT_B);
	if (mainOut === undefined || mainOutB === undefined) return undefined;

	return {
		mainOut,
		mainOutB,
		mainMuteAddress: g.channelMute("output", mainOut),
		mainOutBMuteAddress: g.channelMute("output", mainOutB),
	};
}

/** ARC-style display state: only Main Out's real output mute is authoritative. */
export function controlRoomMainMuteState(state: StateReader): boolean | undefined {
	const mainOut = assignedOutput(state, g.CR_MAINOUT);
	if (mainOut === undefined) return undefined;

	const mute = state.get(g.channelMute("output", mainOut));
	return typeof mute === "number" || typeof mute === "boolean" ? asBool(mute) : undefined;
}

/**
 * ARC USB-style Mute (Main Out): invert Main Out's mute, then write the same
 * state to the real output mute parameters assigned to Main Out and Main Out B.
 * Speaker B state and Main Out B's existing mute state are deliberately ignored.
 */
export function toggleControlRoomMainMute(state: StateWriter): boolean | undefined {
	const outputs = resolveControlRoomMainOutputs(state);
	if (outputs === undefined) return undefined;

	const mainMute = state.get(outputs.mainMuteAddress);
	if (typeof mainMute !== "number" && typeof mainMute !== "boolean") return undefined;

	const next = !asBool(mainMute);
	const value = next ? 1 : 0;
	state.set(outputs.mainMuteAddress, value);
	if (outputs.mainOutBMuteAddress !== outputs.mainMuteAddress) {
		state.set(outputs.mainOutBMuteAddress, value);
	}
	return next;
}

/**
 * Watches Main Out assignment and its resolved output mute. Main Out B's
 * assignment also wakes the listener so operation targets are current, but its
 * mute is never subscribed because it is not part of the displayed state.
 */
export function subscribeControlRoomMainMute(
	state: StateSource,
	listener: (muted: boolean | undefined) => void,
): () => void {
	let currentMainMuteAddress: string | undefined;
	let unsubscribeMainMute = (): void => {};
	let closed = false;

	const emit = (): void => {
		if (!closed) listener(controlRoomMainMuteState(state));
	};

	const retargetMainMute = (): void => {
		if (closed) return;
		const mainOut = assignedOutput(state, g.CR_MAINOUT);
		const nextAddress =
			mainOut === undefined ? undefined : g.channelMute("output", mainOut);

		if (nextAddress !== currentMainMuteAddress) {
			unsubscribeMainMute();
			currentMainMuteAddress = nextAddress;
			unsubscribeMainMute =
				nextAddress === undefined ? (): void => {} : state.subscribe(nextAddress, emit);
		}
		emit();
	};

	const unsubscribeMainAssignment = state.subscribe(g.CR_MAINOUT, retargetMainMute);
	const unsubscribeMainOutBAssignment = state.subscribe(g.CR_MAINOUT_B, emit);
	retargetMainMute();

	return () => {
		closed = true;
		unsubscribeMainAssignment();
		unsubscribeMainOutBAssignment();
		unsubscribeMainMute();
	};
}
