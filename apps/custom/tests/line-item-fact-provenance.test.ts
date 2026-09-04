import { describe, it, expect, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    shipmentLineItem: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
    fact: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/tariff/dutyEngine", () => ({
  loadHtsCodesMap: vi.fn().mockResolvedValue({}),
  calculateDutyStack: vi.fn().mockReturnValue({}),
}));

import { LineItemReconciler } from "@/modules/shipment/lineItemReconciler";

describe("LineItemReconciler line-item Fact provenance", () => {
  it("tags every line-item Fact with entityRef and carries htsConfidence through", async () => {
    await LineItemReconciler.applyDiscoveries({
      shipmentId: "shp_1",
      accountId: "acc_1",
      documentId: "doc_1",
      sourceType: "AGENT_PROPOSED",
      items: [
        {
          lineNumber: 3,
          description: "Stainless Steel Valve",
          htsCode: "8481.80.5090",
          htsConfidence: 92,
        },
      ],
    });

    expect(dbMock.fact.createMany).toHaveBeenCalledTimes(1);
    const rows = dbMock.fact.createMany.mock.calls[0][0].data as Array<Record<string, unknown>>;
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.entityRef).toBe("line:3");
    }

    const htsRow = rows.find((r) => String(r.field).endsWith(".htsCode"));
    expect(htsRow?.confidence).toBe(92);

    const descriptionRow = rows.find((r) => String(r.field).endsWith(".description"));
    expect(descriptionRow?.confidence).toBeNull();
  });
});
