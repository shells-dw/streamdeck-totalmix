import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Manifest conformance against Elgato's plugin guidelines.
 *
 * These are packaging rules rather than behaviour, so nothing in the plugin
 * fails when they are broken — the submission does. Asserting them here makes
 * a violation a test failure at the point it is introduced.
 *
 * https://docs.elgato.com/guidelines/stream-deck/plugins/
 */

interface Action {
	Name: string;
	UUID: string;
	Icon: string;
	Tooltip?: string;
	Controllers?: string[];
	PropertyInspectorPath?: string;
	States?: { Image: string }[];
	Encoder?: { layout?: string; Icon?: string; background?: string };
}

interface Manifest {
	UUID: string;
	Name: string;
	Version: string;
	Category: string;
	Icon: string;
	CategoryIcon: string;
	CodePath: string;
	Actions: Action[];
}

const ROOT = "de.shells.totalmixgen2.sdPlugin";
const manifest = JSON.parse(readFileSync(`${ROOT}/manifest.json`, "utf8")) as Manifest;

/** Guideline figure: names must be "approximately 30 characters or less". */
const MAX_NAME = 30;

/** Manifest image paths carry no extension; Stream Deck resolves .svg or .png. */
const resolves = (path: string): boolean =>
	existsSync(`${ROOT}/${path}.svg`) || existsSync(`${ROOT}/${path}.png`);

describe("manifest", () => {
	it("uses a four-part version matching package.json", () => {
		const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
		expect(manifest.Version).toBe(`${pkg.version}.0`);
	});

	/** Action UUIDs are the identity of every button already placed; changing one deletes it. */
	it("keeps action UUIDs lowercase, unique and under the plugin's UUID", () => {
		const seen = new Set<string>();
		for (const a of manifest.Actions) {
			expect(a.UUID).toMatch(/^[a-z0-9.-]+$/);
			expect(a.UUID.startsWith(`${manifest.UUID}.`)).toBe(true);
			expect(seen.has(a.UUID)).toBe(false);
			seen.add(a.UUID);
		}
	});

	it.each(manifest.Actions.map((a) => [a.Name] as const))(
		"names %s within the guideline length",
		(name) => {
			expect(name.length).toBeLessThanOrEqual(MAX_NAME);
		},
	);

	it("gives every action its own icon, so the action list is readable", () => {
		const icons = manifest.Actions.map((a) => a.Icon);
		expect(new Set(icons).size).toBe(icons.length);
	});

	it("resolves every image the manifest names", () => {
		expect(resolves(manifest.Icon)).toBe(true);
		expect(resolves(manifest.CategoryIcon)).toBe(true);
		for (const a of manifest.Actions) {
			expect(resolves(a.Icon), `${a.Name} icon`).toBe(true);
			for (const s of a.States ?? []) expect(resolves(s.Image), `${a.Name} state`).toBe(true);
		}
	});

	it("points every action at a property inspector and an existing layout", () => {
		for (const a of manifest.Actions) {
			expect(a.PropertyInspectorPath, a.Name).toBeDefined();
			expect(existsSync(`${ROOT}/${a.PropertyInspectorPath}`), a.Name).toBe(true);

			const layout = a.Encoder?.layout;
			if (layout !== undefined && !layout.startsWith("$")) {
				expect(existsSync(`${ROOT}/${layout}`), `${a.Name} layout`).toBe(true);
			}
		}
	});

	/** An Encoder action without a layout renders nothing on the touch strip. */
	it("gives every dial action a layout", () => {
		for (const a of manifest.Actions) {
			if (a.Controllers?.includes("Encoder") === true) {
				expect(a.Encoder?.layout, a.Name).toBeDefined();
			}
		}
	});

	it("ships the code path the manifest declares", () => {
		expect(existsSync(`${ROOT}/${manifest.CodePath}`)).toBe(true);
	});
});
