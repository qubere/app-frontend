/**
 * Maps a Qubere invoice to a QuickBooks Online Invoice create/update payload.
 *
 * Line strategy (per product decision): one QBO line per Qubere InvoiceLine,
 * all pointing at a single generic service Item. Discounts and tax are added
 * as explicit adjustment lines so the QBO document total reconciles to the
 * Qubere total.
 */

export interface QubereInvoiceLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface QubereInvoiceInput {
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  currency: string;
  subtotal: number;
  totalDiscounts: number;
  totalTax: number;
  totalAmount: number;
  notes?: string | null;
  lines: QubereInvoiceLineInput[];
}

export interface MapInvoiceOptions {
  customerId: string;
  /** QBO Item id used for every service line. */
  itemId: string;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// QBO DocNumber max length is 21 characters.
function toDocNumber(invoiceNumber: string): string {
  return invoiceNumber.slice(0, 21);
}

export interface QboInvoicePayload {
  CustomerRef: { value: string };
  TxnDate: string;
  DueDate: string;
  DocNumber: string;
  PrivateNote?: string;
  Line: Array<Record<string, unknown>>;
}

export interface MappedInvoice {
  payload: QboInvoicePayload;
  /** Sum of all payload lines — should equal the Qubere total. */
  computedTotal: number;
  /** True when computedTotal matches the Qubere totalAmount within 1 cent. */
  totalsReconcile: boolean;
}

export function mapInvoiceToQbo(
  invoice: QubereInvoiceInput,
  opts: MapInvoiceOptions,
): MappedInvoice {
  const lines: Array<Record<string, unknown>> = invoice.lines.map((line) => ({
    DetailType: "SalesItemLineDetail",
    Amount: round2(line.amount),
    Description: line.description,
    SalesItemLineDetail: {
      ItemRef: { value: opts.itemId },
      Qty: line.quantity,
      UnitPrice: round2(line.unitPrice),
    },
  }));

  if (invoice.totalDiscounts && invoice.totalDiscounts > 0) {
    lines.push({
      DetailType: "DiscountLineDetail",
      Amount: round2(invoice.totalDiscounts),
      DiscountLineDetail: { PercentBased: false },
    });
  }

  if (invoice.totalTax && invoice.totalTax > 0) {
    lines.push({
      DetailType: "SalesItemLineDetail",
      Amount: round2(invoice.totalTax),
      Description: "Tax (imported from Qubere)",
      SalesItemLineDetail: {
        ItemRef: { value: opts.itemId },
        Qty: 1,
        UnitPrice: round2(invoice.totalTax),
      },
    });
  }

  const computedTotal = round2(
    invoice.lines.reduce((s, l) => s + l.amount, 0) -
      (invoice.totalDiscounts || 0) +
      (invoice.totalTax || 0),
  );

  const noteParts = [
    `Synced from Qubere invoice ${invoice.invoiceNumber}.`,
    invoice.notes?.trim() ? invoice.notes.trim() : null,
  ].filter(Boolean);

  return {
    payload: {
      CustomerRef: { value: opts.customerId },
      TxnDate: ymd(invoice.issueDate),
      DueDate: ymd(invoice.dueDate),
      DocNumber: toDocNumber(invoice.invoiceNumber),
      PrivateNote: noteParts.join(" "),
      Line: lines,
    },
    computedTotal,
    totalsReconcile: Math.abs(computedTotal - round2(invoice.totalAmount)) <= 0.01,
  };
}
