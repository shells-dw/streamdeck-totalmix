import dgram from "node:dgram";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@elgato/streamdeck", () => ({
	default: {
		logger: { info: () => {}, error: () => {}, warn: () => {}, debug: () => {}, trace: () => {} },
	},
}));

const { GlobalConnection } = await import("./connection.js");
const { encodeFloat, parsePacket } = await import("../osc/codec.js");

/** Stands in for a TotalMix Global OSC controller slot. */
class FakeGlobalTotalMix {
	private readonly socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
	readonly received: { address: string; value: unknown }[] = [];

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

	push(toPort: number, address: string, value: number): Promise<void> {
		return new Promise((resolve, reject) => {
			this.socket.send(encodeFloat(address, value), toPort, "127.0.0.1", (err) =>
				err ? reject(err) : resolve(),
			);
		});
	}

	pushString(toPort: number, address: string, value: string): Promise<void> {
		const buf = Buffer.concat([oscString(address), oscString(",s"), oscString(value)]);
		return new Promise((resolve, reject) => {
			this.socket.send(buf, toPort, "127.0.0.1", (err) => (err ? reject(err) : resolve()));
		});
	}

	close(): void {
		this.socket.close();
	}
}

function oscString(s: string): Buffer {
	const raw = Buffer.from(s, "utf8");
	const b = Buffer.alloc((raw.length + 1 + 3) & ~3);
	raw.copy(b, 0);
	return b;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Clear of both the classic tests' ports and the TotalMix defaults.
const TMX_PORT = 47411;
const PLUGIN_PORT = 47412;

describe("GlobalConnection", () => {
	let fake: FakeGlobalTotalMix;
	let conn: InstanceType<typeof GlobalConnection>;

	beforeEach(async () => {
		fake = new FakeGlobalTotalMix();
		await fake.start(TMX_PORT);
		conn = new GlobalConnection({ staleMs: 300, refreshMs: 100 });
		await conn.connect({ host: "127.0.0.1", sendPort: TMX_PORT, receivePort: PLUGIN_PORT });
	});

	afterEach(() => {
		conn.dispose();
		fake.close();
	});

	it("primes by requesting /sendall on connect", async () => {
		await delay(60);
		expect(fake.received.some((m) => m.address === "/sendall" && Number(m.value) >= 1)).toBe(true);
	});

	it("keeps re-requesting /sendall until real state arrives, then stops", async () => {
		await delay(260);
		const before = fake.received.filter((m) => m.address === "/sendall").length;
		expect(before).toBeGreaterThan(1); // connect + at least one retry

		await fake.push(PLUGIN_PORT, "/controlroom/dim", 0.0);
		await delay(150);
		const primed = fake.received.filter((m) => m.address === "/sendall").length;

		// Primed, and kept fresh with regular pushes (as TotalMix's ~1/s status
		// stream does in reality): no further refreshes may fire.
		for (let i = 0; i < 3; i++) {
			await fake.push(PLUGIN_PORT, "/status/dsp", i);
			await delay(100);
		}
		const after = fake.received.filter((m) => m.address === "/sendall").length;
		expect(after).toBe(primed);
	});

	it("caches inbound state and notifies subscribers", async () => {
		const seen: unknown[] = [];
		conn.subscribe("/output/2/faderlin", (v) => seen.push(v));

		await fake.push(PLUGIN_PORT, "/output/2/faderlin", 0.75);
		await delay(50);

		expect(conn.getNumber("/output/2/faderlin")).toBeCloseTo(0.75);
		expect(seen.length).toBe(1);
	});

	it("set() writes the wire AND the cache, so toggling works without echo", async () => {
		conn.set("/input/3/mute", 1);
		await delay(50);

		expect(fake.received.some((m) => m.address === "/input/3/mute" && Number(m.value) === 1)).toBe(
			true,
		);
		// No echo was sent back, yet the state is known locally:
		expect(conn.getNumber("/input/3/mute")).toBe(1);

		// The next toggle therefore inverts correctly.
		conn.toggleSet("/input/3/mute");
		await delay(50);
		const mutes = fake.received.filter((m) => m.address === "/input/3/mute");
		expect(Number(mutes[mutes.length - 1]?.value)).toBe(0);
		expect(conn.getNumber("/input/3/mute")).toBe(0);
	});

	it("toggleSet() with no cached state turns the parameter ON first", async () => {
		conn.toggleSet("/mutegroup/2");
		await delay(50);
		const sent = fake.received.filter((m) => m.address === "/mutegroup/2");
		expect(Number(sent[0]?.value)).toBe(1);

		// Receive-only address: TotalMix never reports it, but alternating
		// presses still alternate because our own writes are the cache.
		conn.toggleSet("/mutegroup/2");
		await delay(50);
		const sent2 = fake.received.filter((m) => m.address === "/mutegroup/2");
		expect(Number(sent2[1]?.value)).toBe(0);
	});

	it("trigger() sends but never caches", async () => {
		// TotalMix has told us snapshot 2 is active (value 2).
		await fake.push(PLUGIN_PORT, "/snapshot/load/2", 2.0);
		await delay(50);
		expect(conn.getNumber("/snapshot/load/2")).toBe(2);

		conn.trigger("/snapshot/load/2", 1.0);
		await delay(50);

		// The wire saw the 1.0, the cache kept TotalMix's state signalling.
		expect(
			fake.received.some((m) => m.address === "/snapshot/load/2" && Number(m.value) === 1),
		).toBe(true);
		expect(conn.getNumber("/snapshot/load/2")).toBe(2);
	});

	it("setCoalesced() collapses a dial burst to the final value", async () => {
		await fake.push(PLUGIN_PORT, "/output/0/faderlin", 0.5);
		await delay(50);

		for (let i = 1; i <= 10; i++) {
			conn.setCoalesced("/output/0/faderlin", 0.5 + i * 0.01);
		}
		await delay(80);

		const sends = fake.received.filter((m) => m.address === "/output/0/faderlin");
		expect(sends.length).toBeLessThan(10);
		expect(Number(sends[sends.length - 1]?.value)).toBeCloseTo(0.6);
		expect(conn.getNumber("/output/0/faderlin")).toBeCloseTo(0.6);
	});

	it("re-requests /sendall after going stale and marks disconnected", async () => {
		await fake.push(PLUGIN_PORT, "/controlroom/dim", 0.0);
		await delay(50);
		expect(conn.connected).toBe(true);

		const states: boolean[] = [];
		conn.onConnectionChange((c) => states.push(c));

		await delay(600); // > staleMs with nothing inbound
		expect(conn.connected).toBe(false);

		const refreshes = fake.received.filter((m) => m.address === "/sendall").length;
		expect(refreshes).toBeGreaterThan(1);

		// TotalMix comes back: connection recovers on the next inbound packet.
		await fake.push(PLUGIN_PORT, "/controlroom/dim", 1.0);
		await delay(50);
		expect(conn.connected).toBe(true);
	});

	it("handles inbound strings (names, DURec state)", async () => {
		await fake.pushString(PLUGIN_PORT, "/input/0/name", "Vocal Mic");
		await fake.pushString(PLUGIN_PORT, "/durec/state", "Record");
		await delay(50);

		expect(conn.getString("/input/0/name")).toBe("Vocal Mic");
		expect(conn.getString("/durec/state")).toBe("Record");
	});

	it("addresses() filters cached keys for the datasource", async () => {
		await fake.pushString(PLUGIN_PORT, "/input/0/name", "Mic L");
		await fake.pushString(PLUGIN_PORT, "/input/2/name", "Guitar");
		await fake.pushString(PLUGIN_PORT, "/output/0/name", "Main");
		await delay(50);

		const inputs = conn.addresses(/^\/input\/\d+\/name$/);
		expect(inputs.sort()).toEqual(["/input/0/name", "/input/2/name"]);
	});
});
