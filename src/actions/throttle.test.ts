import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RenderThrottle } from "./throttle.js";

describe("RenderThrottle", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("paints at once, then once more at the end of the window", () => {
		const t = new RenderThrottle(100);
		const paint = vi.fn();
		t.run("a", paint);
		t.run("a", paint);
		t.run("a", paint);
		expect(paint).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(100);
		expect(paint).toHaveBeenCalledTimes(2);
	});

	it("keeps actions independent", () => {
		const t = new RenderThrottle(100);
		const a = vi.fn();
		const b = vi.fn();
		t.run("a", a);
		t.run("b", b);
		expect(a).toHaveBeenCalledTimes(1);
		expect(b).toHaveBeenCalledTimes(1);
	});

	it("forget cancels a pending paint", () => {
		const t = new RenderThrottle(100);
		const paint = vi.fn();
		t.run("a", paint);
		t.run("a", paint);
		t.forget("a");
		vi.advanceTimersByTime(200);
		expect(paint).toHaveBeenCalledTimes(1);
	});
});
