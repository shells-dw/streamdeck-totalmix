import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePacket, type OscMessage } from "./codec.js";

/**
 * Runs the parser over a real captured TotalMix session. Produce the fixture with capture-osc.ps1.
 */
const FIXTURE = "fixtures/osc-capture.log";

function readPackets(): Buffer[] {
    if (!existsSync(FIXTURE)) return [];
    return readFileSync(FIXTURE, "utf8")
        .split("\n")
        .filter((l) => l.startsWith("hex: "))
        .map((l) => Buffer.from(l.slice(5).trim(), "hex"));
}

const packets = readPackets();

describe.skipIf(packets.length === 0)("captured TotalMix session", () => {
    it("parses every captured packet into at least one message", () => {
        const empty = packets.filter((p) => parsePacket(p).length === 0);
        expect(empty, `${empty.length} packets produced no messages`).toHaveLength(0);
    });

    it("produces only finite numeric values", () => {
        for (const p of packets) {
            for (const m of parsePacket(p)) {
                if (typeof m.value === "number") {
                    expect(Number.isFinite(m.value), `${m.address} = ${m.value}`).toBe(true);
                }
            }
        }
    });

    /**
     * Prints what TotalMix actually sends.
     */
    it("address inventory", () => {
        const counts = new Map<string, number>();
        const all: OscMessage[] = packets.flatMap((p) => parsePacket(p));

        for (const m of all) {
            counts.set(m.address, (counts.get(m.address) ?? 0) + 1);
        }

        const sorted = [...counts].sort((a, b) => b[1] - a[1]);
        for (const [address, n] of sorted) {
            console.log(`${String(n).padStart(6)}  ${address}`);
        }
        console.log(`\n${packets.length} packets, ${all.length} messages, ${counts.size} addresses`);

        expect(counts.size).toBeGreaterThan(0);
    });
});
