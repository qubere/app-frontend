import { describe, it, expect } from "vitest";
import { toReconciliationFieldName } from "./reconciliationEngine";

describe("toReconciliationFieldName", () => {
  it("resolves an OCR_AI_AGENT freeform label to the reconciliation vocabulary key", () => {
    expect(toReconciliationFieldName("Invoice Number")).toBe("invoiceNumber");
  });

  it("leaves an already-canonical DOC_INTEL_STRUCTURED key unchanged", () => {
    expect(toReconciliationFieldName("invoiceNumber")).toBe("invoiceNumber");
  });

  it("falls back to the raw name when the label can't be resolved", () => {
    expect(toReconciliationFieldName("Some Unrecognized Freeform Label")).toBe(
      "Some Unrecognized Freeform Label"
    );
  });
});
