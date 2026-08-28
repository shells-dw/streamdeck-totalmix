/**
 * Shows the Stream Deck alert when the connection is down (Elgato guideline
 * "Temporary Feedback"). Throttled per action so dial rotation cannot raise
 * one alert per detent.
 */

/** Satisfied by KeyAction and DialAction. */
type Alertable = {
	readonly id: string;
	showAlert(): Promise<void>;
};

/** Anything exposing a liveness flag. */
type Connectable = {
	readonly connected: boolean;
};

const ALERT_THROTTLE_MS = 1000;
const lastAlert = new Map<string, number>();

/** @returns true when the connection is down and the caller should not send. */
export function alertIfDown(action: Alertable, tm: Connectable): boolean {
	if (tm.connected) return false;

	const now = Date.now();
	const previous = lastAlert.get(action.id) ?? 0;
	if (now - previous >= ALERT_THROTTLE_MS) {
		lastAlert.set(action.id, now);
		void action.showAlert();
	}

	return true;
}

/** Drops throttle state for an action that disappeared. */
export function forgetAlertState(actionId: string): void {
	lastAlert.delete(actionId);
}
