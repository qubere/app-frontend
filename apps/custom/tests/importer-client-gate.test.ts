import { describe, expect, it } from "vitest";
import { summarizeImporterClientGate } from "../src/modules/importers/importerClientGate";

describe("importer client NOT NULL release gate", () => {
  it("passes only when every importer is assigned consistently", () => {
    expect(summarizeImporterClientGate([{
      id: "ior-ready",
      name: "Northwind Retail Inc.",
      clientId: "client-northwind",
      legalEntityId: "entity-northwind",
      legalEntity: { clientId: "client-northwind" },
    }])).toMatchObject({ readyForNotNull: true, total: 1, assigned: 1 });
  });

  it("reports unassigned importers without guessing a client", () => {
    const summary = summarizeImporterClientGate([{
      id: "ior-legacy",
      name: "Legacy Importer Co.",
      clientId: null,
      legalEntityId: null,
      legalEntity: null,
    }]);

    expect(summary.readyForNotNull).toBe(false);
    expect(summary.unassigned).toEqual([{ id: "ior-legacy", name: "Legacy Importer Co." }]);
  });

  it("blocks rollout when importer and legal-entity clients disagree", () => {
    const summary = summarizeImporterClientGate([{
      id: "ior-mismatch",
      name: "Mismatched Importer",
      clientId: "client-a",
      legalEntityId: "entity-1",
      legalEntity: { clientId: "client-b" },
    }]);

    expect(summary.readyForNotNull).toBe(false);
    expect(summary.clientMismatches[0]).toMatchObject({ importerClientId: "client-a", legalEntityClientId: "client-b" });
  });
});
