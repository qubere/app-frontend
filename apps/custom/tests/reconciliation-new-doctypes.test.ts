import { describe, it, expect } from "vitest";
import { runReconciliationEngine, type DocumentGroup } from "@/lib/reconciliation/reconciliationEngine";

function makeGroup(docType: string, fields: Record<string, string>, id?: string): DocumentGroup {
  return {
    documentId: id ?? `doc_${docType.replace(/\s/g, "_")}`,
    docType,
    fields: Object.entries(fields).map(([fieldName, value]) => ({ fieldName, value })),
  };
}

describe("runReconciliationEngine — new document-type rules", () => {
  it("flags an EUR.1 certificate invoice reference that doesn't match the commercial invoice number", () => {
    const { results } = runReconciliationEngine([
      makeGroup("Commercial Invoice", { invoiceNumber: "INV-100" }),
      makeGroup("EUR.1 Certificate", { invoiceNumber: "INV-999" }),
    ]);

    const hit = results.find((r) => r.ruleId === "EUR1_INV_REF");
    expect(hit).toBeDefined();
    expect(hit?.match).toBe(false);
  });

  it("flags a bill of lading number that doesn't match the arrival notice reference", () => {
    const { results } = runReconciliationEngine([
      makeGroup("Bill of Lading", { billOfLadingNumber: "BL-1" }),
      makeGroup("Arrival Notice", { billOfLadingNumber: "BL-2" }),
    ]);

    const hit = results.find((r) => r.ruleId === "ARRIVAL_NOTICE_BL_REF");
    expect(hit).toBeDefined();
    expect(hit?.match).toBe(false);
  });

  it("flags a BLOCKING origin conflict between a EUR.1 certificate and the invoice", () => {
    const { results } = runReconciliationEngine([
      makeGroup("EUR.1 Certificate", { countryOfOrigin: "Germany" }),
      makeGroup("Commercial Invoice", { countryOfOrigin: "France" }),
    ]);

    const hit = results.find((r) => r.ruleId === "ORIGIN_EUR1_INV");
    expect(hit).toBeDefined();
    expect(hit?.match).toBe(false);
    expect(hit?.severity).toBe("BLOCKING");
  });

  it("flags an origin conflict between an A.TR certificate and a certificate of origin", () => {
    const { results } = runReconciliationEngine([
      makeGroup("A.TR Certificate", { countryOfOrigin: "Turkey" }),
      makeGroup("Certificate of Origin", { countryOfOrigin: "Germany" }),
    ]);

    const hit = results.find((r) => r.ruleId === "ORIGIN_ATR_COO");
    expect(hit).toBeDefined();
    expect(hit?.match).toBe(false);
  });

  it("does not flag when a EUR.1 certificate agrees with the invoice and certificate of origin", () => {
    const { results } = runReconciliationEngine([
      makeGroup("EUR.1 Certificate", { countryOfOrigin: "Germany", invoiceNumber: "INV-100" }),
      makeGroup("Commercial Invoice", { countryOfOrigin: "Germany", invoiceNumber: "INV-100" }),
      makeGroup("Certificate of Origin", { countryOfOrigin: "Germany" }),
    ]);

    expect(results.find((r) => r.ruleId === "ORIGIN_EUR1_INV")).toBeUndefined();
    expect(results.find((r) => r.ruleId === "ORIGIN_EUR1_COO")).toBeUndefined();
    expect(results.find((r) => r.ruleId === "EUR1_INV_REF")).toBeUndefined();
  });

  it("tolerates a 5% weight difference between a sea waybill and the packing list", () => {
    const { results } = runReconciliationEngine([
      makeGroup("Sea Waybill", { grossWeight: "100 kg" }),
      makeGroup("Packing List", { grossWeight: "97 kg" }),
    ]);

    expect(results.find((r) => r.ruleId === "WEIGHT_SEAWB_PACK")).toBeUndefined();
  });

  it("flags a sea waybill gross weight that differs from the invoice by more than 5%", () => {
    const { results } = runReconciliationEngine([
      makeGroup("Sea Waybill", { grossWeight: "100 kg" }),
      makeGroup("Commercial Invoice", { grossWeight: "80 kg" }),
    ]);

    const hit = results.find((r) => r.ruleId === "WEIGHT_SEAWB_INV");
    expect(hit).toBeDefined();
    expect(hit?.match).toBe(false);
  });

  it("flags a BLOCKING value conflict between the invoice and a customs entry", () => {
    const { results } = runReconciliationEngine([
      makeGroup("Commercial Invoice", { totalValue: "1000" }),
      makeGroup("Customs Entry", { totalValue: "500" }),
    ]);

    const hit = results.find((r) => r.ruleId === "VAL_INV_CUSTENTRY");
    expect(hit).toBeDefined();
    expect(hit?.severity).toBe("BLOCKING");
  });

  it("flags a BLOCKING quantity conflict between the invoice and a customs entry", () => {
    const { results } = runReconciliationEngine([
      makeGroup("Commercial Invoice", { totalQuantity: "100" }),
      makeGroup("Customs Entry", { totalQuantity: "90" }),
    ]);

    const hit = results.find((r) => r.ruleId === "QTY_INV_CUSTENTRY");
    expect(hit).toBeDefined();
    expect(hit?.severity).toBe("BLOCKING");
  });

  it("tolerates a 5% quantity difference between the invoice and a CMR consignment note", () => {
    const { results } = runReconciliationEngine([
      makeGroup("Commercial Invoice", { totalQuantity: "100" }),
      makeGroup("CMR Consignment Note", { totalQuantity: "97" }),
    ]);

    expect(results.find((r) => r.ruleId === "QTY_INV_CMR")).toBeUndefined();
  });

  it("flags a quantity difference between the invoice and a CMR consignment note beyond tolerance", () => {
    const { results } = runReconciliationEngine([
      makeGroup("Commercial Invoice", { totalQuantity: "100" }),
      makeGroup("CMR Consignment Note", { totalQuantity: "50" }),
    ]);

    const hit = results.find((r) => r.ruleId === "QTY_INV_CMR");
    expect(hit).toBeDefined();
    expect(hit?.match).toBe(false);
  });
});
