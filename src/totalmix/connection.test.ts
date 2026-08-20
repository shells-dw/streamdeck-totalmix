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

/** Stands in for TotalMix: receives our commands, and can push state at us. */
class FakeTotalMix {
	private readonly socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
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

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Ports well clear of the TotalMix defaults so a real device on the machine
// running these tests cannot interfere.
const TMX_PORT = 47311;
const PLUGIN_PORT = 47312;

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

	it("caches pushed values without any polling", async () => {
		await fake.push(PLUGIN_PORT, "/1/mainVolume", 0.5);
		await delay(60);

		expect(conn.getNumber("/1/mainVolume")).toBeCloseTo(0.5, 5);
	});

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

	it("delivers the cached value to a late subscriber immediately", async () => {
		await fake.push(PLUGIN_PORT, "/1/mainVolume", 0.75);
		await delay(50);

		const listener = vi.fn();
		conn.subscribe("/1/mainVolume", listener);
		await delay(20);

		expect(listener).toHaveBeenCalledWith(expect.closeTo(0.75, 5));
	});

	it("stops notifying after unsubscribe", async () => {
		const listener = vi.fn();
		const off = conn.subscribe("/1/mainVolume", listener);
		off();

		await fake.push(PLUGIN_PORT, "/1/mainVolume", 0.3);
		await delay(60);

		expect(listener).not.toHaveBeenCalled();
	});

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

	it("reads back its own optimistic value during a burst", () => {
		conn.sendCoalesced("/1/mainVolume", 0.42);
		expect(conn.getNumber("/1/mainVolume")).toBeCloseTo(0.42, 5);
	});

	it("sends discrete commands immediately", async () => {
		fake.received.length = 0;
		conn.toggle("/1/mainDim");
		await delay(60);

		const dim = fake.received.filter((m) => m.address === "/1/mainDim");
		expect(dim).toHaveLength(1);
		expect(dim[0]!.value).toBe(1);
	});

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

	it("reports connection state from inbound traffic", async () => {
		expect(conn.connected).toBe(false);
		await fake.push(PLUGIN_PORT, "/1/mainVolume", 0.1);
		await delay(60);
		expect(conn.connected).toBe(true);
	});

	/**
	 * A slot mirrors one page at a time, so refreshing must not cycle through all
	 * four — that would leave TotalMix parked on page 4 and page 1 would never
	 * update. This is the regression guard for exactly that bug.
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

	it("re-requests when the page changes", async () => {
		await delay(60);
		fake.received.length = 0;
		conn.setPage(3);
		await delay(60);

		expect(fake.received.map((m) => m.address)).toEqual(["/1/globalMute", "/3/globalMute"]);
	});
});

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
	 * the connection nor register as a port change — the regression here was every
	 * action appearance tearing the socket down because "9001" !== 9001.
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
