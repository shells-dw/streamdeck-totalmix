/**
 * Marketplace requires that an unsuccessful action tells the user so, rather
 * than failing silently (Elgato plugin guidelines, "Temporary Feedback").
 *
 * Every send path in connection.ts logs and returns — a press with TotalMix
 * closed puts a UDP datagram on the wire, nothing answers, and the key does
 * not move. This turns that into the standard alert.
 *
 * Rotations are throttled because a spun dial would otherwise raise one alert
 * per detent, and the guidelines cap programmatic calls at ten per second.
 */

/** Structural type: both KeyAction and DialAction satisfy this. */
type Alertable = {
	readonly id: string;
	showAlert(): Promise<void>;
};

/** Anything exposing the connection's liveness flag. */
type Connectable = {
	readonly connected: boolean;
};

const ALERT_THROTTLE_MS = 1000;
const lastAlert = new Map<string, number>();

/**
 * Shows the alert when the connection is down, throttled per action instance.
 *
 * @returns true when the connection is down and the caller should not send.
 */
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

/** Drops throttle state for an action that has gone away. */
export function forgetAlertState(actionId: string): void {
	lastAlert.delete(actionId);
}
