import { describe, expect, it } from "vitest";
import { wrapTitle } from "./wrap.js";

describe("wrapTitle", () => {
	it("leaves short texts alone", () => {
		expect(wrapTitle("Play")).toBe("Play");
		expect(wrapTitle("-12.3 dB")).toBe("-12.3 dB");
	});

	it("wraps on word boundaries", () => {
		expect(wrapTitle("Not ready")).toBe("Not ready");
		expect(wrapTitle("Fireface UC Mac")).toBe("Fireface\nUC Mac");
	});

	it("hard-splits words longer than a line", () => {
		expect(wrapTitle("(23928785)")).toBe("(23928785\n)");
	});

	it("caps at three lines with an ellipsis", () => {
		const wrapped = wrapTitle("Fireface UC Mac (23928785)");
		expect(wrapped.split("\n").length).toBeLessThanOrEqual(3);
		expect(wrapped.endsWith("…")).toBe(true);
	});
});
