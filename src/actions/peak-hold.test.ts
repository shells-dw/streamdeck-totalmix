import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PeakHold } from "./peak-hold.js";

describe("PeakHold", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("holds the peak, then decays to the live level", () => {
		const h = new PeakHold(1000, 10, 100);
		const repaint = vi.fn();
		expect(h.value("a", -6, repaint)).toBe(-6);
		expect(h.value("a", -20, repaint)).toBe(-6);
		vi.advanceTimersByTime(1500);
		expect(h.value("a", -20, repaint)).toBeCloseTo(-11);
		vi.advanceTimersByTime(5000);
		expect(h.value("a", -20, repaint)).toBe(-20);
	});

	it("schedules one repaint while decaying", () => {
		const h = new PeakHold(1000, 10, 100);
		const repaint = vi.fn();
		h.value("a", -6, repaint);
		h.value("a", -20, repaint);
		h.value("a", -20, repaint);
		vi.advanceTimersByTime(100);
		expect(repaint).toHaveBeenCalledTimes(1);
	});

	it("returns undefined without a level", () => {
		expect(new PeakHold(1000, 10, 100).value("a", undefined, () => {})).toBeUndefined();
	});
});
