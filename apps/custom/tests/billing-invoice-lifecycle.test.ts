import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  actor: { userId: "maker" },
  invoice: { id: "invoice-a", accountId: "account-a", invoiceNumber: "INV-1", status: "DRAFT", createdById: "maker", paidAmount: 0, lines: [{ charges: [{ id: "charge-a" }] }] } as any,
  update: vi.fn(),
  unlock: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getAccountContext: vi.fn(async () => ({ accountId: "account-a", userId: harness.actor.userId })),
  hasPermission: vi.fn(async () => true),
}));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn() }));
vi.mock("@/lib/billing/invoicing", () => ({ recordInvoicePayment: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => {
  const tx = {
    invoice: {
      update: vi.fn(async ({ data }: any) => {
        Object.assign(harness.invoice, data);
        harness.update(data);
        return harness.invoice;
      }),
    },
    shipmentCharge: { updateMany: vi.fn(async (args: any) => { harness.unlock(args); return { count: 1 }; }) },
  };
  return {
    withAccountIdContext: vi.fn(async (_accountId: string, callback: () => unknown) => callback()),
    withDataModeContext: vi.fn(async (_mode: unknown, callback: () => unknown) => callback()),
    isDataMode: vi.fn(() => false),
    db: {
      invoice: {
        findFirst: harness.findFirst,
        update: tx.invoice.update,
      },
      $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
    },
  };
});

import { approveInvoiceAction, sendInvoiceAction, submitInvoiceForApprovalAction, voidInvoiceAction } from "@/app/app/billing/invoices/[id]/actions";

describe("invoice lifecycle integration", () => {
  beforeEach(() => {
    harness.actor.userId = "maker";
    Object.assign(harness.invoice, { status: "DRAFT", createdById: "maker", paidAmount: 0, approvedById: null, sentById: null, voidedById: null });
    harness.update.mockClear();
    harness.unlock.mockClear();
    harness.findFirst.mockReset();
    harness.findFirst.mockImplementation(async () => ({ ...harness.invoice }));
  });

  it("enforces draft → checker approval → sent and stamps actors", async () => {
    await submitInvoiceForApprovalAction(harness.invoice.id);
    expect(harness.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "invoice-a", accountId: "account-a" } }));
    expect(harness.invoice.status).toBe("PENDING_APPROVAL");

    await expect(approveInvoiceAction(harness.invoice.id)).rejects.toThrow("creator cannot approve");
    harness.actor.userId = "checker";
    await approveInvoiceAction(harness.invoice.id);
    expect(harness.invoice).toMatchObject({ status: "APPROVED", approvedById: "checker" });

    await sendInvoiceAction(harness.invoice.id);
    expect(harness.invoice).toMatchObject({ status: "SENT", sentById: "checker" });
  });

  it("voids an unpaid invoice and unlocks its charges", async () => {
    harness.invoice.status = "SENT";
    harness.actor.userId = "checker";
    await voidInvoiceAction(harness.invoice.id, "Customer account corrected");
    expect(harness.invoice).toMatchObject({ status: "VOID", voidedById: "checker" });
    expect(harness.unlock).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "RATED", invoiceLineId: null } }));
  });

  it("rejects voiding any invoice that has received payment", async () => {
    harness.invoice.status = "PARTIALLY_PAID";
    harness.invoice.paidAmount = 1;
    await expect(voidInvoiceAction(harness.invoice.id, "Not allowed")).rejects.toThrow("received payment");
  });
});
