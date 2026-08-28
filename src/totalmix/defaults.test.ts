import { beforeEach, describe, expect, it, vi } from "vitest";

/** The SDK is faked at the settings API; these tests cover the seeding rules. */
const store = { value: {} as Record<string, unknown> };
const getGlobalSettings = vi.fn(async () => store.value);
let globalListener: ((ev: { settings: Record<string, unknown> }) => void) | null = null;

vi.mock("@elgato/streamdeck", () => ({
	default: {
		logger: { info: () => {}, error: () => {}, warn: () => {}, debug: () => {}, trace: () => {} },
		settings: {
			getGlobalSettings: () => getGlobalSettings(),
			onDidReceiveGlobalSettings: (listener: (ev: { settings: Record<string, unknown> }) => void) => {
				globalListener = listener;
				return { dispose: () => {} };
			},
		},
	},
}));

const { BUILT_IN, getDefaults, resetDefaultsCache, seedDefaults, storedDefaults } = await import(
	"./defaults.js"
);

/** Records what a button would have persisted. */
function fakeAction(): { setSettings: (s: unknown) => Promise<void>; saved: unknown[] } {
	const saved: unknown[] = [];
	return {
		saved,
		setSettings: async (s: unknown) => {
			saved.push(JSON.parse(JSON.stringify(s)));
		},
	};
}

beforeEach(() => {
	store.value = {};
	getGlobalSettings.mockClear();
	globalListener = null;
	resetDefaultsCache();
});

describe("resolving defaults", () => {
	it("falls back to the factory ports when nothing is stored", async () => {
		await expect(getDefaults("classic")).resolves.toEqual({
			host: "127.0.0.1",
			sendPort: 7001,
			receivePort: 9001,
			stepDb: 1.5,
			fxPercent: 2,
			fxStepDb: 1,
		});
	});

	it("uses the Global OSC slot's own factory ports", async () => {
		await expect(getDefaults("global")).resolves.toEqual({
			host: "127.0.0.1",
			sendPort: 7002,
			receivePort: 9002,
			stepDb: 1.5,
			fxPercent: 2,
			fxStepDb: 1,
		});
	});

	it("keeps the two slots independent", async () => {
		// The two slots are configured independently.
		store.value = { defaultSendPort: 7003, defaultReceivePort: 9003 };

		const classic = await getDefaults("classic");
		const global = await getDefaults("global");

		expect(classic.sendPort).toBe(7003);
		expect(global.sendPort).toBe(BUILT_IN.global.sendPort);
	});

	it("coerces the strings the property inspector actually stores", async () => {
		// sdpi-textfield persists DOM values, so ports arrive quoted.
		store.value = { defaultHost: " 192.168.1.50 ", defaultSendPort: "7003", defaultStepDb: "3" };

		const d = await getDefaults("classic");

		expect(d.host).toBe("192.168.1.50");
		expect(d.sendPort).toBe(7003);
		expect(typeof d.sendPort).toBe("number");
		expect(d.stepDb).toBe(3);
	});

	it("ignores a blank field rather than treating it as a value", async () => {
		store.value = { defaultHost: "", defaultSendPort: "" };

		const d = await getDefaults("classic");

		expect(d.host).toBe("127.0.0.1");
		expect(d.sendPort).toBe(7001);
	});

	it("reads the websocket once however many buttons ask", async () => {
		await Promise.all([getDefaults("classic"), getDefaults("global"), getDefaults("classic")]);
		expect(getGlobalSettings).toHaveBeenCalledOnce();
	});

	it("picks up an edit made in the property inspector", async () => {
		await getDefaults("classic");
		expect(globalListener).not.toBeNull();

		globalListener?.({ settings: { defaultHost: "10.0.0.9" } });

		await expect(storedDefaults()).resolves.toEqual({ defaultHost: "10.0.0.9" });
		expect(getGlobalSettings).toHaveBeenCalledOnce();
	});

	it("does not cache a failed read", async () => {
		resetDefaultsCache();
		getGlobalSettings.mockRejectedValueOnce(new Error("socket closed"));

		await expect(getDefaults("classic")).resolves.toMatchObject({ sendPort: 7001 });

		store.value = { defaultSendPort: 7005 };
		await expect(getDefaults("classic")).resolves.toMatchObject({ sendPort: 7005 });
	});
});

describe("seeding a button", () => {
	it("fills a brand new button and persists it", async () => {
		store.value = { defaultHost: "10.0.0.9", defaultSendPort: "7003", defaultReceivePort: "9003" };
		const action = fakeAction();
		const settings: Record<string, unknown> = {};

		await expect(seedDefaults(action, settings, "classic")).resolves.toBe(true);

		expect(settings).toEqual({ host: "10.0.0.9", sendPort: 7003, receivePort: 9003 });
		expect(action.saved).toEqual([settings]);
	});

	it("leaves a button that already has a connection alone", async () => {
		store.value = { defaultHost: "10.0.0.9" };
		const action = fakeAction();
		const settings: Record<string, unknown> = { host: "192.168.5.5", sendPort: 7001, receivePort: 9001 };

		await expect(seedDefaults(action, settings, "classic")).resolves.toBe(false);

		expect(settings.host).toBe("192.168.5.5");
		expect(action.saved).toHaveLength(0);
		// Short-circuits before any websocket traffic.
		expect(getGlobalSettings).not.toHaveBeenCalled();
	});

	it("does not re-seed on a later appearance", async () => {
		store.value = { defaultHost: "10.0.0.9" };
		const action = fakeAction();
		const settings: Record<string, unknown> = {};

		await seedDefaults(action, settings, "classic");
		store.value = { defaultHost: "172.16.0.1" };
		resetDefaultsCache();
		await seedDefaults(action, settings, "classic");

		// Changing a default does not affect an already-seeded button.
		expect(settings.host).toBe("10.0.0.9");
		expect(action.saved).toHaveLength(1);
	});

	it("respects a field the user deliberately cleared", async () => {
		store.value = { defaultHost: "10.0.0.9" };
		const action = fakeAction();
		const settings: Record<string, unknown> = { host: "", sendPort: 7001, receivePort: 9001 };

		await expect(seedDefaults(action, settings, "classic")).resolves.toBe(false);
		expect(settings.host).toBe("");
	});

	it("seeds only the missing half of a partly configured button", async () => {
		store.value = { defaultSendPort: 7003, defaultReceivePort: 9003 };
		const action = fakeAction();
		const settings: Record<string, unknown> = { host: "192.168.5.5" };

		await seedDefaults(action, settings, "classic");

		expect(settings).toEqual({ host: "192.168.5.5", sendPort: 7003, receivePort: 9003 });
	});

	it("seeds the step size only when the action asks for it", async () => {
		store.value = { defaultStepDb: "3" };
		const dial = fakeAction();
		const toggle = fakeAction();
		const dialSettings: Record<string, unknown> = {};
		const toggleSettings: Record<string, unknown> = {};

		await seedDefaults(dial, dialSettings, "classic", { stepDb: true });
		await seedDefaults(toggle, toggleSettings, "classic");

		expect(dialSettings.stepDb).toBe(3);
		expect(toggleSettings.stepDb).toBeUndefined();
	});

	it("seeds a global action from the global keys", async () => {
		store.value = { defaultSendPort: 7003, defaultGlobalSendPort: 7004 };
		const action = fakeAction();
		const settings: Record<string, unknown> = {};

		await seedDefaults(action, settings, "global");

		expect(settings.sendPort).toBe(7004);
		expect(settings.receivePort).toBe(9002);
	});
});
