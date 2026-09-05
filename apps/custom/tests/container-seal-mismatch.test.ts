import { describe, it, expect } from "vitest";
import { findContainerSealMismatches } from "@/modules/shipment/reconciliationEngine";

describe("findContainerSealMismatches", () => {
  it("flags a container whose two documents report different seal numbers", () => {
    const mismatches = findContainerSealMismatches([
      { id: "f1", field: "container.MSKU1234567.sealNumbers", value: "SEAL001", documentId: "doc_bl" },
      { id: "f2", field: "container.MSKU1234567.sealNumbers", value: "SEAL002", documentId: "doc_pack" },
    ]);

    expect(mismatches).toHaveLength(1);
    expect(mismatches[0].normalizedContainerNumber).toBe("MSKU1234567");
    expect(mismatches[0].claims.map((c) => c.documentId).sort()).toEqual(["doc_bl", "doc_pack"]);
  });

  it("does not flag when both documents agree, even with different casing/spacing/order", () => {
    const mismatches = findContainerSealMismatches([
      { id: "f1", field: "container.MSKU 1234567.sealNumbers", value: "seal001,SEAL002", documentId: "doc_bl" },
      { id: "f2", field: "container.msku1234567.sealNumbers", value: "SEAL002, Seal001", documentId: "doc_pack" },
    ]);

    expect(mismatches).toHaveLength(0);
  });

  it("does not flag a container with only one document's claim", () => {
    const mismatches = findContainerSealMismatches([
      { id: "f1", field: "container.MSKU1234567.sealNumbers", value: "SEAL001", documentId: "doc_bl" },
    ]);

    expect(mismatches).toHaveLength(0);
  });

  it("uses only the latest claim per document, ignoring superseded reparse facts", () => {
    // Facts are passed newest-first, matching the createdAt desc query order.
    const mismatches = findContainerSealMismatches([
      { id: "f3", field: "container.MSKU1234567.sealNumbers", value: "SEAL001", documentId: "doc_bl" }, // latest for doc_bl
      { id: "f2", field: "container.MSKU1234567.sealNumbers", value: "SEAL999", documentId: "doc_bl" }, // superseded
      { id: "f1", field: "container.MSKU1234567.sealNumbers", value: "SEAL001", documentId: "doc_pack" },
    ]);

    expect(mismatches).toHaveLength(0);
  });

  it("ignores facts for unrelated fields", () => {
    const mismatches = findContainerSealMismatches([
      { id: "f1", field: "container.MSKU1234567.containerType", value: "40HC", documentId: "doc_bl" },
      { id: "f2", field: "package.PKG1.containerNumber", value: "MSKU1234567", documentId: "doc_bl" },
    ]);

    expect(mismatches).toHaveLength(0);
  });
});
