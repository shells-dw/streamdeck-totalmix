import type { OscValue } from "../osc/codec.js";
import { asBool } from "../osc/codec.js";
import * as g from "../globalosc/addresses.js";

export type ControlRoomVolumeTarget = "main" | "activeMonitor";

type StateReader = {
	get(address: string): OscValue | undefined;
};

type StateSource = StateReader & {
	subscribe(address: string, listener: (value: OscValue) => void): () => void;
};

const MAIN_DEPENDENCIES = [g.CR_MAINOUT] as const;
const ACTIVE_MONITOR_DEPENDENCIES = [g.CR_MAINOUT, g.CR_MAINOUT_B, g.CR_SPEAKER_B] as const;

/** Control-room state capable of changing the hardware output for a target. */
export function controlRoomDependencies(target: string | undefined): readonly string[] {
	switch (target) {
		case "main":
			return MAIN_DEPENDENCIES;
		case "activeMonitor":
			return ACTIVE_MONITOR_DEPENDENCIES;
		default:
			return [];
	}
}

/** Hardware output selected by a control-room target, if all required state is known. */
export function resolveControlRoomOutput(
	target: string | undefined,
	state: StateReader,
): number | undefined {
	let assignment: OscValue | undefined;

	if (target === "main") {
		assignment = state.get(g.CR_MAINOUT);
	} else if (target === "activeMonitor") {
		const speakerB = state.get(g.CR_SPEAKER_B);
		if (typeof speakerB !== "number" && typeof speakerB !== "boolean") return undefined;
		assignment = state.get(asBool(speakerB) ? g.CR_MAINOUT_B : g.CR_MAINOUT);
	} else {
		return undefined;
	}

	return typeof assignment === "number" && Number.isFinite(assignment)
		? Math.round(assignment)
		: undefined;
}

/**
 * Watches only the shared Global OSC cache dependencies for this target.
 * The callback always resolves from the latest complete cache, so changes from
 * TotalMix UI, ARC USB or any OSC controller follow the same inbound path.
 */
export function subscribeControlRoomOutput(
	target: string | undefined,
	state: StateSource,
	listener: (output: number | undefined) => void,
): () => void {
	const unsubs = controlRoomDependencies(target).map((address) =>
		state.subscribe(address, () => listener(resolveControlRoomOutput(target, state))),
	);

	return () => {
		for (const unsubscribe of unsubs) unsubscribe();
	};
}
