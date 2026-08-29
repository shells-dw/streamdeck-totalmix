/**
 * Per-action repaint throttle: the first call in a window paints at once,
 * further calls collapse into one trailing paint at the end of the window.
 * Used by renders driven by high-rate OSC traffic (level meters).
 */
export class RenderThrottle {
	private readonly last = new Map<string, number>();
	private readonly timers = new Map<string, NodeJS.Timeout>();

	constructor(private readonly windowMs: number) {}

	/** Runs `paint` now or schedules it; returns immediately either way. */
	run(id: string, paint: () => void): void {
		const now = Date.now();
		const last = this.last.get(id) ?? 0;
		if (now - last >= this.windowMs) {
			this.last.set(id, now);
			paint();
			return;
		}
		if (this.timers.has(id)) return;
		this.timers.set(
			id,
			setTimeout(() => {
				this.timers.delete(id);
				this.last.set(id, Date.now());
				paint();
			}, this.windowMs - (now - last)),
		);
	}

	/** Drops pending state for an action that disappeared. */
	forget(id: string): void {
		const t = this.timers.get(id);
		if (t !== undefined) clearTimeout(t);
		this.timers.delete(id);
		this.last.delete(id);
	}
}
