import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { resequenceLegs, nextStopSequence } from "./legService";

type Leg = { id: string; sequence: number; originStopId: string; destinationStopId: string };

/**
 * In-memory stand-in for a Prisma transaction client covering only what
 * resequenceLegs / nextStopSequence touch. It enforces the real
 * @@unique([shipmentId, sequence]) constraint so a naive one-pass re-number
 * would throw here just like it does against Postgres.
 */
function fakeTx(legs: Leg[], stopSeqs: number[] = []) {
  const byId = new Map(legs.map((l) => [l.id, { ...l }]));
  return {
    shipmentLeg: {
      async update({ where, data, select }: any) {
        const leg = byId.get(where.id);
        if (!leg) throw new Error(`leg ${where.id} not found`);
        if (data.sequence !== undefined && data.sequence >= 0) {
          for (const other of byId.values()) {
            if (other.id !== leg.id && other.sequence === data.sequence) {
              throw new Error(`unique constraint: sequence ${data.sequence} already held by ${other.id}`);
            }
          }
        }
        if (data.sequence !== undefined) leg.sequence = data.sequence;
        if (data.originStopId !== undefined) leg.originStopId = data.originStopId;
        return select ? { destinationStopId: leg.destinationStopId } : { ...leg };
      },
    },
    shipmentStop: {
      async aggregate() {
        return { _max: { sequence: stopSeqs.length ? Math.max(...stopSeqs) : null } };
      },
    },
    _dump: () => [...byId.values()].sort((a, b) => a.sequence - b.sequence),
  };
}

describe("resequenceLegs", () => {
  it("renumbers to 1..N and repairs the shared-stop chain for an arbitrary permutation", async () => {
    // s0 → s1 → s2 → s3
    const legs: Leg[] = [
      { id: "L1", sequence: 1, originStopId: "s0", destinationStopId: "s1" },
      { id: "L2", sequence: 2, originStopId: "s1", destinationStopId: "s2" },
      { id: "L3", sequence: 3, originStopId: "s2", destinationStopId: "s3" },
    ];
    const tx = fakeTx(legs);
    // reverse the order
    await resequenceLegs(tx as any, "shp", ["L3", "L2", "L1"]);
    const out = tx._dump();
    expect(out.map((l) => l.id)).toEqual(["L3", "L2", "L1"]);
    expect(out.map((l) => l.sequence)).toEqual([1, 2, 3]);
    // chain intact: each leg's origin is the previous leg's destination
    for (let i = 1; i < out.length; i++) {
      expect(out[i].originStopId).toBe(out[i - 1].destinationStopId);
    }
  });

  it("does not throw on a full reversal even though sequences transiently collide", async () => {
    const legs: Leg[] = Array.from({ length: 5 }, (_, i) => ({
      id: `L${i + 1}`,
      sequence: i + 1,
      originStopId: `s${i}`,
      destinationStopId: `s${i + 1}`,
    }));
    const tx = fakeTx(legs);
    await expect(
      resequenceLegs(tx as any, "shp", ["L5", "L4", "L3", "L2", "L1"])
    ).resolves.not.toThrow();
    expect(tx._dump().map((l) => l.sequence)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("nextStopSequence", () => {
  it("returns 1 when the shipment has no stops", async () => {
    expect(await nextStopSequence(fakeTx([], []) as any, "shp")).toBe(1);
  });
  it("returns max+1 otherwise", async () => {
    expect(await nextStopSequence(fakeTx([], [1, 2, 7]) as any, "shp")).toBe(8);
  });
});
