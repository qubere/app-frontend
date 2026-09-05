import { describe, it, expect, vi, beforeEach } from "vitest";

const applyDiscoveriesCalls: any[] = [];
const shipmentUpdateCalls: any[] = [];

vi.mock("@qubere/db", () => ({
  db: {
    $transaction: async (fn: (tx: any) => Promise<any>) => fn(fakeTx),
  },
}));

vi.mock("../../../modules/shipment/lineItemReconciler", () => ({
  LineItemReconciler: {
    applyDiscoveries: vi.fn(async (input: any) => {
      applyDiscoveriesCalls.push(input);
    }),
  },
}));

const fakeTx = {
  fact: {
    findFirst: async () => null,
    create: async ({ data }: any) => ({ id: "fact_1", ...data }),
  },
  shipment: {
    update: async ({ where, data }: any) => {
      shipmentUpdateCalls.push({ where, data });
      return { id: where.id, ...data };
    },
  },
};

import { MaterializerRegistry } from "./materializers";
import { LineItemReconciler } from "../../../modules/shipment/lineItemReconciler";
import type { PromotionDecision } from "./promotionPolicyEngine";
import type { ResolvedCandidate } from "../resolution/corroborationConflictResolver";

function decisionFor(
  targetFieldKey: string,
  proposedValue: unknown,
  targetEntityRef: string | null = null
): PromotionDecision {
  const candidate: ResolvedCandidate = {
    candidateId: `cand_${targetFieldKey}`,
    proposal: {
      targetFieldKey,
      targetEntityRef,
      sourceExtractionFieldIds: [],
      evidenceReferences: [{ documentId: "doc_1" } as any],
      proposedValue,
      mappingConfidence: 95,
      relationConfidence: null,
      reasoning: "test",
      status: "PROPOSED",
      abstainReason: null,
    },
    corroboratingDocumentIds: [],
    corroborationScore: 0,
    calibratedScore: 95,
    status: "PROMOTED",
  };
  return { candidate, shouldPromote: true, reason: "ok", isHumanLocked: false };
}

describe("MaterializerRegistry.materializeDecision", () => {
  beforeEach(() => {
    applyDiscoveriesCalls.length = 0;
    shipmentUpdateCalls.length = 0;
    vi.clearAllMocks();
  });

  describe("LineItemMaterializer", () => {
    it("correlates to the real line number and column for a 'line_item:N' ref (live extraction shape)", async () => {
      const decision = decisionFor("lineItem[].quantity", "7", "line_item:3");
      const result = await MaterializerRegistry.materializeDecision("acct_1", "shp_1", decision);

      expect(result.materialized).toBe(true);
      expect(applyDiscoveriesCalls).toHaveLength(1);
      expect(applyDiscoveriesCalls[0].items).toEqual([{ lineNumber: 3, quantity: 7 }]);
    });

    it("also correlates a 'line:N' ref (LineItemReconciler's own Fact-entityRef convention)", async () => {
      const decision = decisionFor("lineItem[].htsCode", "8471.30", "line:5");
      const result = await MaterializerRegistry.materializeDecision("acct_1", "shp_1", decision);

      expect(result.materialized).toBe(true);
      expect(applyDiscoveriesCalls[0].items).toEqual([{ lineNumber: 5, htsCode: "8471.30" }]);
    });

    it("sets description/unitPrice using the field's own registry column, not a hardcoded one", async () => {
      const decision = decisionFor("lineItem[].description", "Widget", "line_item:2");
      await MaterializerRegistry.materializeDecision("acct_1", "shp_1", decision);
      expect(applyDiscoveriesCalls[0].items).toEqual([{ lineNumber: 2, description: "Widget" }]);

      const priceDecision = decisionFor("lineItem[].unitPrice", "19.99", "line_item:2");
      await MaterializerRegistry.materializeDecision("acct_1", "shp_1", priceDecision);
      expect(applyDiscoveriesCalls[1].items).toEqual([{ lineNumber: 2, unitPrice: 19.99 }]);
    });

    it("does not materialize and does not throw when targetEntityRef is missing or unparseable", async () => {
      const decision = decisionFor("lineItem[].quantity", "7", null);
      const result = await MaterializerRegistry.materializeDecision("acct_1", "shp_1", decision);

      expect(result.materialized).toBe(false);
      expect(result.reason).toBe("NO_TYPED_PROJECTION");
      expect(LineItemReconciler.applyDiscoveries).not.toHaveBeenCalled();
    });
  });

  describe("shipment.invoiceNumber / shipment.invoiceDate", () => {
    it("does not attempt a Shipment scalar write for invoiceNumber (no such column exists)", async () => {
      const decision = decisionFor("shipment.invoiceNumber", "INV-9001");
      const result = await MaterializerRegistry.materializeDecision("acct_1", "shp_1", decision);

      expect(result.materializer).toBe("FactOnlyMaterializer");
      expect(result.materialized).toBe(true);
      expect(shipmentUpdateCalls).toHaveLength(0);
    });

    it("does not attempt a Shipment scalar write for invoiceDate (no such column exists)", async () => {
      const decision = decisionFor("shipment.invoiceDate", "2026-01-15");
      const result = await MaterializerRegistry.materializeDecision("acct_1", "shp_1", decision);

      expect(result.materializer).toBe("FactOnlyMaterializer");
      expect(result.materialized).toBe(true);
      expect(shipmentUpdateCalls).toHaveLength(0);
    });
  });

  describe("filing.portOfEntry", () => {
    it("materializes onto the real Shipment.portOfEntry column via ShipmentScalarMaterializer", async () => {
      const decision = decisionFor("filing.portOfEntry", "3901");
      const result = await MaterializerRegistry.materializeDecision("acct_1", "shp_1", decision, {
        expectedVersion: 1,
      });

      expect(result.materialized).toBe(true);
      expect(result.materializedColumn).toBe("portOfEntry");
      expect(shipmentUpdateCalls).toHaveLength(1);
      expect(shipmentUpdateCalls[0].data.portOfEntry).toBe("3901");
    });
  });
});
