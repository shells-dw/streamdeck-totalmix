import { describe, expect, it, vi } from "vitest";

import { alertIfDown, forgetAlertState } from "./alert.js";

function fakeAction(id: string) {
	return { id, showAlert: vi.fn(async () => {}) };
}

describe("alertIfDown", () => {
	it("does nothing while connected", () => {
		const a = fakeAction("connected");
		expect(alertIfDown(a, { connected: true })).toBe(false);
		expect(a.showAlert).not.toHaveBeenCalled();
	});

	it("alerts and blocks the send while disconnected", () => {
		const a = fakeAction("down");
		expect(alertIfDown(a, { connected: false })).toBe(true);
		expect(a.showAlert).toHaveBeenCalledTimes(1);
	});

	it("throttles a spun dial to one alert per second", () => {
		vi.useFakeTimers();
		try {
			const a = fakeAction("spun");
			for (let i = 0; i < 40; i++) alertIfDown(a, { connected: false });
			expect(a.showAlert).toHaveBeenCalledTimes(1);

			vi.advanceTimersByTime(1001);
			alertIfDown(a, { connected: false });
			expect(a.showAlert).toHaveBeenCalledTimes(2);
		} finally {
			vi.useRealTimers();
		}
	});

	it("throttles per action, not globally", () => {
		const a = fakeAction("first");
		const b = fakeAction("second");
		alertIfDown(a, { connected: false });
		alertIfDown(b, { connected: false });
		expect(a.showAlert).toHaveBeenCalledTimes(1);
		expect(b.showAlert).toHaveBeenCalledTimes(1);
	});

	it("alerts immediately again once state is forgotten", () => {
		const a = fakeAction("recycled");
		alertIfDown(a, { connected: false });
		forgetAlertState(a.id);
		alertIfDown(a, { connected: false });
		expect(a.showAlert).toHaveBeenCalledTimes(2);
	});
});
