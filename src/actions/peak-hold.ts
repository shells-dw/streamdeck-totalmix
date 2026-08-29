/**
 * Peak hold per action: the highest level is kept for `holdMs`, then falls
 * at `decayDbPerS`. While the held value sits above the live level a repaint
 * is scheduled every `repaintMs`, so the fall is visible without new OSC
 * traffic (/level only reports changes).
 */
export class PeakHold {
	private readonly holds = new Map<string, { db: number; at: number }>();
	private readonly timers = new Map<string, NodeJS.Timeout>();

	constructor(
		private readonly holdMs: number,
		private readonly decayDbPerS: number,
		private readonly repaintMs: number,
	) {}

	/** Held level for the current live level, or undefined when there is no level. */
	value(id: string, peakDb: number | undefined, repaint: () => void): number | undefined {
		if (peakDb === undefined) return undefined;
		const now = Date.now();
		const held = this.holds.get(id);
		let db = peakDb;
		if (held !== undefined && held.db > peakDb) {
			const age = now - held.at;
			db = age <= this.holdMs ? held.db : held.db - ((age - this.holdMs) / 1000) * this.decayDbPerS;
			if (db <= peakDb) db = peakDb;
		}
		if (db === peakDb) {
			this.holds.set(id, { db: peakDb, at: now });
		} else if (!this.timers.has(id)) {
			this.timers.set(
				id,
				setTimeout(() => {
					this.timers.delete(id);
					repaint();
				}, this.repaintMs),
			);
		}
		return db;
	}

	forget(id: string): void {
		const t = this.timers.get(id);
		if (t !== undefined) clearTimeout(t);
		this.timers.delete(id);
		this.holds.delete(id);
	}
}
