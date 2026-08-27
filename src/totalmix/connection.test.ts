import dgram from "node:dgram";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The SDK expects to be launched by Stream Deck with registration arguments, so
// it is stubbed here. Only the logger is touched by the connection.
vi.mock("@elgato/streamdeck", () => ({
	default: {
		logger: { info: () => {}, error: () => {}, warn: () => {}, debug: () => {}, trace: () => {} },
	},
}));

const { TotalMixConnection } = await import("./connection.js");
const { encodeFloat, parsePacket } = await import("../osc/codec.js");

/**
 * Stands in for TotalMix: receives our commands, and can push state at us.
 *
 * A real socket rather than a mock, so the tests exercise actual encoding,
 * datagram framing and the asynchrony that comes with them. The cost is that
 * assertions need a short delay to let packets round-trip through the loopback.
 */
class FakeTotalMix {
	private readonly socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

	/** Everything the connection has sent, in order. Cleared to scope assertions. */
	readonly received: { address: string; value: unknown }[] = [];
	private clientPort = 0;

	async start(listenPort: number): Promise<void> {
		this.socket.on("message", (buf) => {
			for (const m of parsePacket(buf)) {
				this.received.push({ address: m.address, value: m.value });
			}
		});

		await new Promise<void>((resolve) => {
			this.socket.once("listening", () => resolve());
			this.socket.bind(listenPort, "127.0.0.1");
		});
	}

	/** Pushes a string value, e.g. a label. */
	pushString(toPort: number, address: string, value: string): Promise<void> {
		const addr = oscString(address);
		const tags = oscString(",s");
		const arg = oscString(value);
		const buf = Buffer.concat([addr, tags, arg]);
		return new Promise((resolve, reject) => {
			this.socket.send(buf, toPort, "127.0.0.1", (err) => (err ? reject(err) : resolve()));
		});
	}

	/** Pushes a parameter change, as TotalMix does for its selected page. */
	push(toPort: number, address: string, value: number): Promise<void> {
		return new Promise((resolve, reject) => {
			this.socket.send(encodeFloat(address, value), toPort, "127.0.0.1", (err) =>
				err ? reject(err) : resolve(),
			);
		});
	}

	close(): void {
		this.socket.close();
	}
}

/**
 * Lets loopback packets land before asserting. Values are generous relative to
 * the ~1ms a local round-trip actually takes, so a loaded CI machine does not
 * turn these into flakes.
 */
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Null-terminated, 4-byte-padded OSC string. */
function oscString(s: string): Buffer {
	const raw = Buffer.from(s, "utf8");
	const b = Buffer.alloc((raw.length + 1 + 3) & ~3);
	raw.copy(b, 0);
	return b;
}

// Ports well clear of the TotalMix defaults so a real device on the machine
// running these tests cannot interfere.
const TMX_PORT = 47311;
const PLUGIN_PORT = 47312;

/**
 * Core connection behaviour, exercised against a real UDP socket rather than a
 * mock: the parsing, coalescing and page handling all depend on datagram
 * boundaries, which an in-process fake would paper over.
 */
describe("TotalMixConnection", () => {
	let fake: FakeTotalMix;
	let conn: InstanceType<typeof TotalMixConnection>;

	beforeEach(async () => {
		fake = new FakeTotalMix();
		await fake.start(TMX_PORT);

		conn = new TotalMixConnection();
		await conn.connect({ host: "127.0.0.1", sendPort: TMX_PORT, receivePort: PLUGIN_PORT });
	});

	afterEach(() => {
		conn.dispose();
		fake.close();
	});

	/**
	 * The premise of the whole redesign: state arrives because TotalMix pushes
	 * it, with nothing asked for after the initial refresh. If this fails, the
	 * plugin is back to polling.
	 */
	it("caches pushed values without any polling", async () => {
		await fake.push(PLUGIN_PORT, "/1/mainVolume", 0.5);
		await delay(60);

		expect(conn.getNumber("/1/mainVolume")).toBeCloseTo(0.5, 5);
	});

	/** Dozens of buttons share one socket, so delivery has to be per-address. */
	it("notifies only the subscribers of that address", async () => {
		const main = vi.fn();
		const other = vi.fn();

		conn.subscribe("/1/mainVolume", main);
		conn.subscribe("/1/mainDim", other);

		await fake.push(PLUGIN_PORT, "/1/mainVolume", 0.25);
		await delay(60);

		expect(main).toHaveBeenCalledWith(expect.closeTo(0.25, 5));
		expect(other).not.toHaveBeenCalled();
	});

	/**
	 * TotalMix re-sends unchanged values in every page dump. Waking listeners on
	 * those would repaint every key several times a second for nothing.
	 */
	it("does not wake subscribers when the value is unchanged", async () => {
		const listener = vi.fn();
		conn.subscribe("/1/mainVolume", listener);

		await fake.push(PLUGIN_PORT, "/1/mainVolume", 0.5);
		await delay(50);
		const afterFirst = listener.mock.calls.length;

		await fake.push(PLUGIN_PORT, "/1/mainVolume", 0.5);
		await delay(50);

		expect(listener.mock.calls.length).toBe(afterFirst);
	});

	/**
	 * A button appearing mid-session (profile switch, page change) must paint
	 * from cache at once rather than showing a placeholder until the value next
	 * happens to move — which for a resting fader could be never.
	 */
	it("delivers the cached value to a late subscriber immediately", async () => {
		await fake.push(PLUGIN_PORT, "/1/mainVolume", 0.75);
		await delay(50);

		const listener = vi.fn();
		conn.subscribe("/1/mainVolume", listener);
		await delay(20);

		expect(listener).toHaveBeenCalledWith(expect.closeTo(0.75, 5));
	});

	/** Leaked subscriptions would accumulate across profile switches. */
	it("stops notifying after unsubscribe", async () => {
		const listener = vi.fn();
		const off = conn.subscribe("/1/mainVolume", listener);
		off();

		await fake.push(PLUGIN_PORT, "/1/mainVolume", 0.3);
		await delay(60);

		expect(listener).not.toHaveBeenCalled();
	});

	/**
	 * TotalMix pings bare "/" continuously. It proves the link is alive but
	 * carries no state, so it must never reach the cache — the distinction the
	 * `primed` flag depends on.
	 */
	it("ignores heartbeats", async () => {
		const before = conn.get("/");
		await fake.push(PLUGIN_PORT, "/", 0);
		await delay(50);

		expect(conn.get("/")).toBe(before);
	});

	/**
	 * The behaviour that makes dials viable: a burst of rotation must not become a
	 * burst of datagrams. Only the final position needs to reach TotalMix.
	 */
	it("coalesces a burst of dial movement into one send", async () => {
		fake.received.length = 0;

		for (let i = 1; i <= 40; i++) {
			conn.sendCoalesced("/1/mainVolume", i / 100);
		}

		await delay(120);

		const sends = fake.received.filter((m) => m.address === "/1/mainVolume");
		expect(sends.length).toBeLessThanOrEqual(3);
		expect(sends.at(-1)!.value).toBeCloseTo(0.4, 5);
	});

	/**
	 * Each step is computed from the previous value, so during a burst the dial
	 * must read back its own pending position. Reading the last value TotalMix
	 * confirmed would make a fast spin crawl.
	 */
	it("reads back its own optimistic value during a burst", () => {
		conn.sendCoalesced("/1/mainVolume", 0.42);
		expect(conn.getNumber("/1/mainVolume")).toBeCloseTo(0.42, 5);
	});

	/** The counterpart to coalescing: discrete commands must never be delayed or merged. */
	it("sends discrete commands immediately", async () => {
		fake.received.length = 0;
		conn.toggle("/1/mainDim");
		await delay(60);

		const dim = fake.received.filter((m) => m.address === "/1/mainDim");
		expect(dim).toHaveLength(1);
		expect(dim[0]!.value).toBe(1);
	});

	/**
	 * The port is open to anything on the machine. A stray or truncated datagram
	 * must be dropped without killing the socket, or one bad packet from an
	 * unrelated program takes the plugin down until it is restarted.
	 */
	it("survives a malformed datagram without dropping the connection", async () => {
		const listener = vi.fn();
		conn.subscribe("/1/mainVolume", listener);

		const junk = dgram.createSocket("udp4");
		await new Promise<void>((resolve) =>
			junk.send(Buffer.from([0x2f, 0xff, 0xff, 0xfe, 0x01]), PLUGIN_PORT, "127.0.0.1", () => {
				junk.close();
				resolve();
			}),
		);
		await delay(40);

		// Still alive and still delivering.
		await fake.push(PLUGIN_PORT, "/1/mainVolume", 0.6);
		await delay(60);

		expect(listener).toHaveBeenCalledWith(expect.closeTo(0.6, 5));
	});

	/**
	 * There is no handshake in OSC, so "connected" is inferred purely from
	 * inbound traffic — and starts false until something actually arrives.
	 */
	it("reports connection state from inbound traffic", async () => {
		expect(conn.connected).toBe(false);
		await fake.push(PLUGIN_PORT, "/1/mainVolume", 0.1);
		await delay(60);
		expect(conn.connected).toBe(true);
	});

	/**
	 * A slot mirrors one page at a time, so a refresh must touch a single page.
	 * Cycling all four leaves the slot on page 4 and page 1 never updates.
	 */
	it("refreshes a single page and stays on it", async () => {
		// Let the refresh issued by connect() land before measuring.
		await delay(60);
		fake.received.length = 0;
		conn.requestFullRefresh();
		await delay(60);

		// Away-and-back: forces a page *change* so TotalMix's re-send actually
		// triggers even when the slot is already parked on the target page. Both
		// touches must be addresses that exist in RME's table for their page.
		expect(fake.received.map((m) => m.address)).toEqual(["/2/mute", "/1/globalMute"]);
		// 0.0 is inert on a toggle; it must not actually flip anything.
		expect(fake.received.every((r) => r.value === 0)).toBe(true);
	});

	/**
	 * Switching pages hops via page 1 (the "away" page for anything but page 1),
	 * so the destination is always entered as a change and its re-send fires.
	 */
	it("re-requests when the page changes", async () => {
		await delay(60);
		fake.received.length = 0;
		conn.setPage(3);
		await delay(60);

		expect(fake.received.map((m) => m.address)).toEqual(["/1/globalMute", "/3/globalMute"]);
	});

	it("returns to its own page after an off-page command", async () => {
		// A snapshot address selects page 3 for the slot, which stops updates for
		// every page-1 address on the same connection until page 1 is reselected.
		await delay(60);
		fake.received.length = 0;

		conn.sendOffPage("/3/snapshots/8/1", 1.0);
		await delay(60);
		// The command goes out immediately; the page is restored later.
		expect(fake.received.map((m) => m.address)).toEqual(["/3/snapshots/8/1"]);

		await delay(300);
		// A full refresh rather than a bare page select: a snapshot changes the
		// mixer without emitting individual parameters, so the values must be
		// re-requested. The away-hop forces the re-send.
		expect(fake.received.map((m) => m.address)).toEqual([
			"/3/snapshots/8/1",
			"/2/mute",
			"/1/globalMute",
		]);
		// 0.0 is inert on a toggle, so refreshing changes nothing.
		const touches = fake.received.filter((m) => m.address !== "/3/snapshots/8/1");
		expect(touches.every((m) => m.value === 0)).toBe(true);
	});

	it("restores after a toggle() too, not just an explicit sendOffPage", async () => {
		// toggle() is the path snapshots, groups and FX enables take; the on/off
		// branch calling sendOffPage directly is not reached by snapshots.
		await delay(60);
		fake.received.length = 0;

		conn.toggle("/3/snapshots/7/1");
		await delay(360);

		expect(fake.received.map((m) => m.address)).toEqual([
			"/3/snapshots/7/1",
			"/2/mute",
			"/1/globalMute",
		]);
	});

	it("revisits every bus an action needs after a snapshot", async () => {
		// Page-1 addresses mean "strip N of the currently selected bus", so a
		// refresh carries one bus only and every other view stays stale.
		// The prime walk waits for inbound data before starting.
		await fake.push(PLUGIN_PORT, "/1/mute/1/1", 0);
		await delay(60);

		conn.requireView({ bus: "input" });
		conn.requireView({ bus: "playback" });
		await delay(1200); // let the startup walk finish
		fake.received.length = 0;

		conn.toggle("/3/snapshots/7/1");
		await delay(1400);

		const sent = fake.received.map((m) => m.address);
		expect(sent).toContain("/1/busInput");
		expect(sent).toContain("/1/busPlayback");
		// The page is restored as well.
		expect(sent).toContain("/1/globalMute");
	});

	it("leaves a page-1 toggle alone", async () => {
		await delay(60);
		fake.received.length = 0;

		conn.toggle("/1/busInput");
		await delay(360);

		expect(fake.received.map((m) => m.address)).toEqual(["/1/busInput"]);
	});

	it("does not bounce pages for a command already on our page", async () => {
		await delay(60);
		fake.received.length = 0;

		conn.sendOffPage("/1/mainDim", 1.0);
		await delay(360);

		expect(fake.received.map((m) => m.address)).toEqual(["/1/mainDim"]);
	});

	it("restores once after a burst, not once per message", async () => {
		// A dial burst must produce one refresh, not one per detent.
		await delay(60);
		fake.received.length = 0;

		for (let i = 0; i < 5; i++) {
			conn.sendOffPage("/3/reverbVolume", 0.5);
			await delay(30);
		}
		await delay(320);

		expect(fake.received.filter((m) => m.address === "/3/reverbVolume")).toHaveLength(5);
		expect(fake.received.filter((m) => m.address === "/1/globalMute")).toHaveLength(1);
	});
});

/**
 * Settings arriving from the property inspector, which persists everything as
 * strings. These guard the coercion in connect() — the bugs here are silent
 * ones, where the connection appears fine but tears down its socket repeatedly.
 */
describe("property inspector string settings", () => {
	let fake: FakeTotalMix;
	let conn: InstanceType<typeof TotalMixConnection>;

	beforeEach(async () => {
		fake = new FakeTotalMix();
		await fake.start(TMX_PORT);
		conn = new TotalMixConnection();
	});

	afterEach(() => {
		conn.dispose();
		fake.close();
	});

	/**
	 * sdpi-textfield persists numbers as strings. A string port must neither break
	 * the connection nor register as a port change, which would tear down the
	 * shared socket on every action appearance.
	 */
	it("accepts string ports and still delivers commands", async () => {
		// String ports exactly as the PI saves them.
		await conn.connect({
			host: "127.0.0.1",
			sendPort: String(TMX_PORT) as unknown as number,
			receivePort: String(PLUGIN_PORT) as unknown as number,
		});

		conn.toggle("/1/mainDim");
		await delay(60);

		expect(fake.received.some((m) => m.address === "/1/mainDim")).toBe(true);
	});

	it("does not reopen the socket when the same port arrives as a string", async () => {
		await conn.connect({ host: "127.0.0.1", sendPort: TMX_PORT, receivePort: PLUGIN_PORT });
		await delay(30);
		fake.received.length = 0;

		// Second appearance, same ports but string-typed: must be a no-op, not a
		// close/reopen — a reopen re-sends the page refresh, which we can observe.
		await conn.connect({
			host: "127.0.0.1",
			sendPort: String(TMX_PORT) as unknown as number,
			receivePort: String(PLUGIN_PORT) as unknown as number,
		});
		await delay(60);

		const refreshes = fake.received.filter((m) => m.address.endsWith("globalMute"));
		expect(refreshes).toHaveLength(0);
	});

	it("ignores garbage ports rather than dying", async () => {
		await conn.connect({
			host: "127.0.0.1",
			sendPort: "not-a-port" as unknown as number,
			receivePort: PLUGIN_PORT,
		});
		// No socket, but also no throw — and a later valid connect still works.
		await conn.connect({ host: "127.0.0.1", sendPort: TMX_PORT, receivePort: PLUGIN_PORT });
		conn.toggle("/1/mainDim");
		await delay(60);
		expect(fake.received.some((m) => m.address === "/1/mainDim")).toBe(true);
	});
});

/**
 * Startup ordering. UDP has no delivery guarantee and no handshake, so the
 * initial refresh can simply be lost — most often because Stream Deck launched
 * the plugin before TotalMix finished booting. Uses millisecond timings.
 */
describe("startup refresh resilience", () => {
	let fake: FakeTotalMix;
	let conn: InstanceType<typeof TotalMixConnection>;

	beforeEach(async () => {
		fake = new FakeTotalMix();
		await fake.start(TMX_PORT);
		// Millisecond timing so the retry behaviour is observable in a test.
		conn = new TotalMixConnection({ refreshMs: 40, staleMs: 2000 });
		await conn.connect({ host: "127.0.0.1", sendPort: TMX_PORT, receivePort: PLUGIN_PORT });
	});

	afterEach(() => {
		conn.dispose();
		fake.close();
	});

	/**
	 * The bug this guards: TotalMix heartbeats arriving while the initial page
	 * dump was lost (plugin started before TotalMix was ready). Heartbeats must
	 * not count as "cache populated" — the connection has to keep asking until
	 * real data lands, then go quiet.
	 */
	it("keeps re-requesting while only heartbeats arrive, stops once data lands", async () => {
		// Simulate TotalMix alive but the dump lost: heartbeats only.
		await fake.push(PLUGIN_PORT, "/", 0);
		await delay(150);
		await fake.push(PLUGIN_PORT, "/", 0);
		await delay(150);

		const asksWhileEmpty = fake.received.filter((m) =>
			String(m.address).endsWith("globalMute") || String(m.address).endsWith("/2/mute"),
		).length;
		expect(asksWhileEmpty).toBeGreaterThan(2); // initial + retries

		// Now the "dump" arrives.
		await fake.push(PLUGIN_PORT, "/1/mastervolume", 0.7);
		await delay(60);
		fake.received.length = 0;

		// Heartbeats continue, as in normal idle — no further refreshes allowed.
		await fake.push(PLUGIN_PORT, "/", 0);
		await delay(150);

		const asksAfterData = fake.received.filter((m) =>
			String(m.address).endsWith("globalMute") || String(m.address).endsWith("/2/mute"),
		).length;
		expect(asksAfterData).toBe(0);
	});
});

/**
 * The positional/global cache split. Page-1 strip addresses name a position in
 * the current view, not a channel, so they must be invalidated or re-keyed when
 * the view moves — whether we moved it or TotalMix reported it moving.
 */
describe("positional view cache", () => {
	let fake: FakeTotalMix;
	let conn: InstanceType<typeof TotalMixConnection>;

	beforeEach(async () => {
		fake = new FakeTotalMix();
		await fake.start(TMX_PORT);
		conn = new TotalMixConnection();
		await conn.connect({ host: "127.0.0.1", sendPort: TMX_PORT, receivePort: PLUGIN_PORT });
	});

	afterEach(() => {
		conn.dispose();
		fake.close();
	});

	/**
	 * /1/volumeN is a position, not a channel. Any view move must drop the
	 * positional entries — reading them across a view change is how a dial ends
	 * up stepping from another channel's fader value.
	 */
	it("invalidates positional entries when the bank moves", async () => {
		await fake.push(PLUGIN_PORT, "/1/volume3", 0.7);
		await fake.push(PLUGIN_PORT, "/1/mastervolume", 0.5);
		await delay(60);
		expect(conn.get("/1/volume3")).toBeDefined();

		conn.send("/setBankStart", 8);

		expect(conn.get("/1/volume3")).toBeUndefined();
		// Non-positional state survives: main volume is the same fader in any view.
		expect(conn.get("/1/mastervolume")).toBeDefined();
	});

	it("invalidates when TotalMix itself reports a bus change", async () => {
		conn.send("/1/busOutput", 1.0); // our view: output
		await fake.push(PLUGIN_PORT, "/1/volume1", 0.4);
		await delay(60);
		expect(conn.get("/1/volume1")).toBeDefined();

		// Another actor's pin moved the slot; TotalMix reports input active.
		await fake.push(PLUGIN_PORT, "/1/busInput", 1.0);
		await delay(60);

		expect(conn.get("/1/volume1")).toBeUndefined();
		expect(conn.viewMatches({ bus: "input" })).toBe(true);
		expect(conn.viewMatches({ bus: "output" })).toBe(false);
	});

	it("viewMatches treats an unknown view as mismatch when a requirement exists", () => {
		expect(conn.viewMatches({})).toBe(true);
		expect(conn.viewMatches({ bus: "input" })).toBe(false);
	});
});

/**
 * Submix is the third view dimension, alongside bus and bank — and the least
 * obvious, since it changes what every fader means without changing any
 * address.
 */
describe("submix as a view dimension", () => {
	let fake: FakeTotalMix;
	let conn: InstanceType<typeof TotalMixConnection>;

	beforeEach(async () => {
		fake = new FakeTotalMix();
		await fake.start(TMX_PORT);
		conn = new TotalMixConnection();
		await conn.connect({ host: "127.0.0.1", sendPort: TMX_PORT, receivePort: PLUGIN_PORT });
	});

	afterEach(() => {
		conn.dispose();
		fake.close();
	});

	/**
	 * From a real capture: changing submix in the TotalMix GUI re-sends every
	 * volumeN as that submix's send level. Same positions, different meaning — so
	 * positional cache from the previous submix must not survive.
	 */
	it("invalidates positional state when the submix changes", async () => {
		await fake.pushString(PLUGIN_PORT, "/1/labelSubmix", "Main");
		await fake.push(PLUGIN_PORT, "/1/volume1", 0.8);
		await delay(60);
		expect(conn.get("/1/volume1")).toBeDefined();

		await fake.pushString(PLUGIN_PORT, "/1/labelSubmix", "> Apollo C");
		await delay(60);

		expect(conn.get("/1/volume1")).toBeUndefined();
	});
});

/**
 * Retention is what makes several dials on different buses usable at once.
 * Invalidation alone (see "positional view cache") would leave every dial but
 * the current one blank; here each view keeps its own slice, readable through a
 * view requirement without moving the slot.
 */
describe("per-view state retention", () => {
	let fake: FakeTotalMix;
	let conn: InstanceType<typeof TotalMixConnection>;

	beforeEach(async () => {
		fake = new FakeTotalMix();
		await fake.start(TMX_PORT);
		conn = new TotalMixConnection();
		await conn.connect({ host: "127.0.0.1", sendPort: TMX_PORT, receivePort: PLUGIN_PORT });
	});

	afterEach(() => {
		conn.dispose();
		fake.close();
	});

	/**
	 * The screenshots that motivated this: switching the slot to input made
	 * playback dials show "—" and input channel names. Positional state must be
	 * retained per view, readable through a view requirement, and restored when
	 * the slot returns.
	 */
	it("retains values and names per bus across view switches", async () => {
		// Slot on input: real gain and input names arrive.
		await fake.push(PLUGIN_PORT, "/1/busInput", 1.0);
		await fake.push(PLUGIN_PORT, "/1/micgain1", 0.63);
		await fake.pushString(PLUGIN_PORT, "/1/trackname1", "Mic 1");
		await delay(60);

		// Slot moves to playback; its own data arrives.
		conn.send("/1/busPlayback", 1.0);
		await fake.push(PLUGIN_PORT, "/1/busPlayback", 1.0);
		await fake.push(PLUGIN_PORT, "/1/volume1", 0.2);
		await fake.pushString(PLUGIN_PORT, "/1/trackname1", "AN 1/2");
		await delay(60);

		// Current view reads see playback...
		expect(conn.getNumber("/1/volume1", -1)).toBeCloseTo(0.2, 5);
		expect(conn.getString("/1/trackname1")).toBe("AN 1/2");

		// ...while input-scoped reads still see input's retained data.
		expect(conn.getNumber("/1/micgain1", -1, { bus: "input" })).toBeCloseTo(0.63, 5);
		expect(conn.getString("/1/trackname1", { bus: "input" })).toBe("Mic 1");

		// And moving back restores input as the current view's data.
		conn.send("/1/busInput", 1.0);
		expect(conn.getNumber("/1/micgain1", -1)).toBeCloseTo(0.63, 5);
		expect(conn.getString("/1/trackname1")).toBe("Mic 1");
	});

	it("keeps non-positional state global across view switches", async () => {
		await fake.push(PLUGIN_PORT, "/1/mastervolume", 0.44);
		await delay(60);
		conn.send("/1/busInput", 1.0);
		conn.send("/setBankStart", 8);
		expect(conn.getNumber("/1/mastervolume", -1)).toBeCloseTo(0.44, 5);
	});
});

/**
 * The serial prime walk, which fills every required view's slice at startup so
 * dials arrive populated. Replaces the old appear-time pin scramble, where
 * several actions raced each other for the single shared slot.
 */
describe("startup view priming", () => {
	let fake: FakeTotalMix;
	let conn: InstanceType<typeof TotalMixConnection>;

	beforeEach(async () => {
		fake = new FakeTotalMix();
		await fake.start(TMX_PORT);
		conn = new TotalMixConnection({ refreshMs: 40, staleMs: 2000 });
		await conn.connect({ host: "127.0.0.1", sendPort: TMX_PORT, receivePort: PLUGIN_PORT });
	});

	afterEach(() => {
		conn.dispose();
		fake.close();
	});

	/**
	 * Per-view slices start empty, so every view an action requires must be
	 * visited once at startup — bus (and bank) asserted so TotalMix dumps it —
	 * or dials sit on "—" until first touched. Registration is deduplicated and
	 * the visits happen without any user gesture.
	 */
	it("visits each required view once after the connection is primed", async () => {
		conn.requireView({ bus: "input" });
		conn.requireView({ bus: "input" }); // duplicate: must not cause a second visit
		conn.requireView({ bus: "output", bank: 0 });

		// The startup refresh must land first; simulate TotalMix answering it.
		await fake.push(PLUGIN_PORT, "/1/busPlayback", 1.0);
		await fake.push(PLUGIN_PORT, "/1/volume1", 0.5);
		await delay(1000); // two 400ms visit slots plus slack

		const busSelects = fake.received.filter((m) => String(m.address).startsWith("/1/bus"));
		expect(busSelects.map((m) => m.address)).toEqual(["/1/busInput", "/1/busOutput"]);
		const bankSelects = fake.received.filter((m) => m.address === "/setBankStart");
		expect(bankSelects).toHaveLength(1);
		expect(bankSelects[0]!.value).toBe(0);

		// The dump TotalMix sends for the visited view lands in that view's slice.
		await fake.push(PLUGIN_PORT, "/1/busOutput", 1.0);
		await fake.push(PLUGIN_PORT, "/1/volume2", 0.9);
		await delay(60);
		expect(conn.getNumber("/1/volume2", -1, { bus: "output", bank: 0 })).toBeCloseTo(0.9, 5);
	});
});

/**
 * The startup case behind "a button only follows the mixer once you press it".
 *
 * A positional value is filed under the view current when it arrives, and the
 * first dump is the one that reveals that view — so anything preceding the busX
 * and labelSubmix messages in it lands under the placeholder view instead.
 */
describe("re-request once the view is known", () => {
	let fake: FakeTotalMix;
	let conn: InstanceType<typeof TotalMixConnection>;

	beforeEach(async () => {
		fake = new FakeTotalMix();
		await fake.start(TMX_PORT);
		conn = new TotalMixConnection();
		await conn.connect({ host: "127.0.0.1", sendPort: TMX_PORT, receivePort: PLUGIN_PORT });
	});

	afterEach(() => {
		conn.dispose();
		fake.close();
	});

	it("makes a value that arrived before the view readable afterwards", async () => {
		await delay(60);

		// A dump in the awkward order: the fader first, the view second.
		await fake.push(PLUGIN_PORT, "/1/volume1", 0.8);
		await fake.push(PLUGIN_PORT, "/1/busInput", 1.0);
		await fake.pushString(PLUGIN_PORT, "/1/labelSubmix", "Main");
		await delay(60);

		// Stranded: filed under the placeholder view, unreadable from the real one.
		expect(conn.get("/1/volume1", { bus: "input" })).toBeUndefined();

		// The re-request goes out, and the second dump files correctly.
		fake.received.length = 0;
		await delay(500);
		expect(fake.received.map((m) => m.address)).toEqual(["/2/mute", "/1/globalMute"]);

		await fake.push(PLUGIN_PORT, "/1/volume1", 0.8);
		await delay(60);
		// OSC carries 32-bit floats, so 0.8 comes back as its nearest single.
		expect(conn.get("/1/volume1", { bus: "input" })).toBeCloseTo(0.8, 6);
	});

	it("re-requests only once, so it cannot loop", async () => {
		await delay(60);
		await fake.push(PLUGIN_PORT, "/1/busInput", 1.0);
		await delay(500);

		fake.received.length = 0;
		await fake.pushString(PLUGIN_PORT, "/1/labelSubmix", "Main");
		await fake.push(PLUGIN_PORT, "/1/busPlayback", 1.0);
		await delay(500);

		expect(fake.received).toEqual([]);
	});
});
