import { describe, it, expect } from "vitest";
import { RECONCILIATION_RULES } from "./reconciliationRules";

function findRule(id: string) {
  const rule = RECONCILIATION_RULES.find((r) => r.id === id);
  expect(rule).toBeDefined();
  return rule!;
}

describe("RECONCILIATION_RULES — triangulation gap rules", () => {
  it("adds an Invoice vs Lading gross weight check", () => {
    const rule = findRule("WEIGHT_INV_BL");
    expect(rule.fieldKey).toBe("grossWeight");
    expect(rule.docTypeA).toBe("Invoice");
    expect(rule.docTypeB).toBe("Lading");
    expect(rule.blocksFiling).toBe(false);
  });

  it("adds a Packing vs Lading quantity check", () => {
    const rule = findRule("QTY_PACK_BL");
    expect(rule.fieldKey).toBe("totalQuantity");
    expect(rule.docTypeA).toBe("Packing");
    expect(rule.docTypeB).toBe("Lading");
    expect(rule.blocksFiling).toBe(false);
  });

  it("adds a Certificate of Origin vs Lading origin check, non-blocking", () => {
    const rule = findRule("ORIGIN_COO_BL");
    expect(rule.fieldKey).toBe("countryOfOrigin");
    expect(rule.docTypeA).toBe("Certificate of Origin");
    expect(rule.docTypeB).toBe("Lading");
    // The Invoice/Packing legs of this triangle stay blocking (the primary
    // authority); this third leg is confirmatory, not a new gate.
    expect(rule.blocksFiling).toBe(false);
  });

  it("adds a Forwarding Instruction vs Shipping Instruction booking number check", () => {
    const rule = findRule("BOOKING_NUM_FWDINSTR_SHIPINSTR");
    expect(rule.fieldKey).toBe("bookingNumber");
    expect(rule.docTypeA).toBe("Forwarding Instruction");
    expect(rule.docTypeB).toBe("Shipping Instruction");
    expect(rule.discrepancyType).toBe("REFERENCE");
    expect(rule.blocksFiling).toBe(false);
  });

  it("adds a Booking Request vs Forwarding Instruction booking number check", () => {
    const rule = findRule("BOOKING_NUM_BOOKINGREQ_FWDINSTR");
    expect(rule.fieldKey).toBe("bookingNumber");
    expect(rule.docTypeA).toBe("Booking Request");
    expect(rule.docTypeB).toBe("Forwarding Instruction");
  });

  it("adds a Booking Request vs Shipping Instruction booking number check", () => {
    const rule = findRule("BOOKING_NUM_BOOKINGREQ_SHIPINSTR");
    expect(rule.fieldKey).toBe("bookingNumber");
    expect(rule.docTypeA).toBe("Booking Request");
    expect(rule.docTypeB).toBe("Shipping Instruction");
  });

  it("has no duplicate rule ids", () => {
    const ids = RECONCILIATION_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
