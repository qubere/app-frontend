import { describe, it, expect } from "vitest";
import { findLineItemQuantityMismatches } from "@/modules/shipment/reconciliationEngine";

describe("findLineItemQuantityMismatches", () => {
  it("flags a line whose two documents report different quantities", () => {
    const mismatches = findLineItemQuantityMismatches([
      { id: "f1", field: "lineItem.3.quantity", value: "100", documentId: "doc_invoice" },
      { id: "f2", field: "lineItem.3.quantity", value: "120", documentId: "doc_pack" },
    ]);

    expect(mismatches).toHaveLength(1);
    expect(mismatches[0].lineNumber).toBe(3);
    expect(mismatches[0].claims.map((c) => c.documentId).sort()).toEqual(["doc_invoice", "doc_pack"]);
  });

  it("does not flag when both documents agree, even with different string formatting", () => {
    const mismatches = findLineItemQuantityMismatches([
      { id: "f1", field: "lineItem.3.quantity", value: "100", documentId: "doc_invoice" },
      { id: "f2", field: "lineItem.3.quantity", value: "100.0", documentId: "doc_pack" },
    ]);

    expect(mismatches).toHaveLength(0);
  });

  it("does not flag a line with only one document's claim", () => {
    const mismatches = findLineItemQuantityMismatches([
      { id: "f1", field: "lineItem.3.quantity", value: "100", documentId: "doc_invoice" },
    ]);

    expect(mismatches).toHaveLength(0);
  });

  it("uses only the latest claim per document, ignoring superseded reparse facts", () => {
    // Facts are passed newest-first, matching the createdAt desc query order.
    const mismatches = findLineItemQuantityMismatches([
      { id: "f3", field: "lineItem.3.quantity", value: "100", documentId: "doc_invoice" }, // latest for doc_invoice
      { id: "f2", field: "lineItem.3.quantity", value: "999", documentId: "doc_invoice" }, // superseded
      { id: "f1", field: "lineItem.3.quantity", value: "100", documentId: "doc_pack" },
    ]);

    expect(mismatches).toHaveLength(0);
  });

  it("tracks mismatches independently per line number", () => {
    const mismatches = findLineItemQuantityMismatches([
      { id: "f1", field: "lineItem.1.quantity", value: "50", documentId: "doc_invoice" },
      { id: "f2", field: "lineItem.1.quantity", value: "50", documentId: "doc_pack" },
      { id: "f3", field: "lineItem.2.quantity", value: "10", documentId: "doc_invoice" },
      { id: "f4", field: "lineItem.2.quantity", value: "15", documentId: "doc_pack" },
    ]);

    expect(mismatches).toHaveLength(1);
    expect(mismatches[0].lineNumber).toBe(2);
  });

  it("ignores facts for unrelated fields", () => {
    const mismatches = findLineItemQuantityMismatches([
      { id: "f1", field: "lineItem.3.unitPrice", value: "9.99", documentId: "doc_invoice" },
      { id: "f2", field: "lineItem.3.description", value: "Widget", documentId: "doc_invoice" },
    ]);

    expect(mismatches).toHaveLength(0);
  });
});
