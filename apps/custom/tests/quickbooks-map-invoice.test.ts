import { describe, expect, it } from "vitest";
import { mapInvoiceToQbo, type QubereInvoiceInput } from "@/lib/integrations/quickbooks/mapInvoice";

const base: QubereInvoiceInput = {
  invoiceNumber: "INV-202608-A138DA8B",
  issueDate: new Date("2026-08-10T00:00:00Z"),
  dueDate: new Date("2026-09-09T00:00:00Z"),
  currency: "USD",
  subtotal: 1000,
  totalDiscounts: 0,
  totalTax: 0,
  totalAmount: 1000,
  notes: null,
  lines: [
    { description: "Customs entry filing", quantity: 1, unitPrice: 750, amount: 750 },
    { description: "ISF filing", quantity: 1, unitPrice: 250, amount: 250 },
  ],
};

const opts = { customerId: "42", itemId: "7" };

describe("mapInvoiceToQbo", () => {
  it("maps one QBO line per Qubere line", () => {
    const { payload } = mapInvoiceToQbo(base, opts);
    expect(payload.Line).toHaveLength(2);
    expect(payload.Line[0]).toMatchObject({
      DetailType: "SalesItemLineDetail",
      Amount: 750,
      Description: "Customs entry filing",
      SalesItemLineDetail: { ItemRef: { value: "7" }, Qty: 1, UnitPrice: 750 },
    });
    expect(payload.CustomerRef).toEqual({ value: "42" });
    expect(payload.TxnDate).toBe("2026-08-10");
    expect(payload.DueDate).toBe("2026-09-09");
  });

  it("reconciles totals with no adjustments", () => {
    const res = mapInvoiceToQbo(base, opts);
    expect(res.computedTotal).toBe(1000);
    expect(res.totalsReconcile).toBe(true);
  });

  it("adds a discount line and reconciles", () => {
    const res = mapInvoiceToQbo(
      { ...base, totalDiscounts: 100, totalAmount: 900 },
      opts,
    );
    expect(res.payload.Line).toHaveLength(3);
    expect(res.payload.Line[2]).toMatchObject({ DetailType: "DiscountLineDetail", Amount: 100 });
    expect(res.totalsReconcile).toBe(true);
  });

  it("adds a tax line and reconciles", () => {
    const res = mapInvoiceToQbo(
      { ...base, totalTax: 80, totalAmount: 1080 },
      opts,
    );
    expect(res.payload.Line).toHaveLength(3);
    expect(res.payload.Line[2]).toMatchObject({ Amount: 80, Description: "Tax (imported from Qubere)" });
    expect(res.totalsReconcile).toBe(true);
  });

  it("flags a mismatch when the Qubere total is inconsistent", () => {
    const res = mapInvoiceToQbo({ ...base, totalAmount: 1234 }, opts);
    expect(res.totalsReconcile).toBe(false);
  });

  it("collapses a line where qty * unitPrice != amount (QBO error 6070)", () => {
    const { payload } = mapInvoiceToQbo(
      {
        ...base,
        subtotal: 7,
        totalAmount: 7,
        lines: [{ description: "Additional Lines", quantity: 14, unitPrice: 1.75, amount: 7 }],
      },
      opts,
    );
    expect(payload.Line[0]).toMatchObject({
      Amount: 7,
      SalesItemLineDetail: { Qty: 1, UnitPrice: 7 },
    });
  });

  it("keeps real qty/unitPrice when the line reconciles", () => {
    const { payload } = mapInvoiceToQbo(
      {
        ...base,
        subtotal: 120,
        totalAmount: 120,
        lines: [{ description: "Entry Processing", quantity: 2, unitPrice: 60, amount: 120 }],
      },
      opts,
    );
    expect(payload.Line[0]).toMatchObject({
      Amount: 120,
      SalesItemLineDetail: { Qty: 2, UnitPrice: 60 },
    });
  });

  it("truncates DocNumber to 21 characters", () => {
    const res = mapInvoiceToQbo(
      { ...base, invoiceNumber: "INV-202608-THIS-IS-WAY-TOO-LONG-1234567" },
      opts,
    );
    expect(res.payload.DocNumber.length).toBe(21);
  });

  it("includes the Qubere invoice number in PrivateNote", () => {
    const res = mapInvoiceToQbo(base, opts);
    expect(res.payload.PrivateNote).toContain("INV-202608-A138DA8B");
  });
});
