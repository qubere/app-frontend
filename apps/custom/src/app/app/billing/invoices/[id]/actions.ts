"use server";

import { db, isDataMode, withAccountIdContext, withDataModeContext } from "@/lib/db";
import { getAccountContext, hasPermission } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { recordInvoicePayment } from "@/lib/billing/invoicing";
import { revalidatePath } from "next/cache";

async function requirePermission(...permissions: string[]) {
  const context = await getAccountContext();
  if (!context) throw new Error("Unauthorized: Account context required");
  const checks = await Promise.all(permissions.map((p) => hasPermission(p)));
  if (!checks.some(Boolean)) throw new Error(`Forbidden: one of [${permissions.join(", ")}] permission required`);
  return context;
}

export async function recordPaymentAction(invoiceId: string, formData: FormData) {
  const context = await requirePermission("billing.payment.record");

  const amountRaw = String(formData.get("amount") || "");
  const amount = parseFloat(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid payment amount greater than zero");

  const paymentMethod = String(formData.get("paymentMethod") || "").trim();
  if (!paymentMethod) throw new Error("Payment method is required");

  // recordInvoicePayment queries/updates Invoice (dataMode-scoped via Account
  // relation) -- without this wrapper it silently defaults to PRODUCTION isolation.
  return withDataModeContext(isDataMode(context.dataMode) ? context.dataMode : null, async () => withAccountIdContext(context.accountId, async () => {
    const payment = await recordInvoicePayment({
      accountId: context.accountId,
      invoiceId,
      amount,
      paymentMethod,
      referenceNo: String(formData.get("referenceNo") || "") || undefined,
      notes: String(formData.get("notes") || "") || undefined,
    });

    await createAuditLog({
      accountId: context.accountId,
      userId: context.userId,
      action: "billing.payment.record",
      entity: "Invoice",
      entityId: invoiceId,
      metadata: { amount, paymentMethod, paymentId: payment.id },
    });
    revalidatePath(`/app/billing/invoices/${invoiceId}`);
    revalidatePath("/app/billing/invoices");
    revalidatePath("/app/billing");
    return { success: true };
  }));
}

export async function submitInvoiceForApprovalAction(invoiceId: string) {
  const context = await requirePermission("billing.invoice.create");

  // db.invoice.findFirst touches Invoice (dataMode-scoped via Account relation) --
  // without this wrapper it silently defaults to PRODUCTION isolation.
  return withDataModeContext(isDataMode(context.dataMode) ? context.dataMode : null, async () => withAccountIdContext(context.accountId, async () => {
    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId, accountId: context.accountId },
      select: { id: true, status: true, invoiceNumber: true, createdById: true },
    });
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status !== "DRAFT") throw new Error("Only DRAFT invoices can be submitted for approval");

    await db.invoice.update({ where: { id: invoiceId }, data: { status: "PENDING_APPROVAL" } });

    await createAuditLog({
      accountId: context.accountId,
      userId: context.userId,
      action: "billing.invoice.submit_for_approval",
      entity: "Invoice",
      entityId: invoiceId,
      metadata: { invoiceNumber: invoice.invoiceNumber },
    });
    revalidatePath(`/app/billing/invoices/${invoiceId}`);
    revalidatePath("/app/billing/invoices");
    return { success: true };
  }));
}

export async function approveInvoiceAction(invoiceId: string) {
  const context = await requirePermission("billing.invoice.approve");

  // db.invoice.findFirst touches Invoice (dataMode-scoped via Account relation) --
  // without this wrapper it silently defaults to PRODUCTION isolation.
  return withDataModeContext(isDataMode(context.dataMode) ? context.dataMode : null, async () => withAccountIdContext(context.accountId, async () => {
    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId, accountId: context.accountId },
      select: { id: true, status: true, invoiceNumber: true, createdById: true },
    });
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status !== "PENDING_APPROVAL") throw new Error("Only PENDING_APPROVAL invoices can be approved");
    if (invoice.createdById && invoice.createdById === context.userId) throw new Error("Maker-checker control: the invoice creator cannot approve the same invoice");

    await db.invoice.update({ where: { id: invoiceId }, data: { status: "APPROVED", approvedById: context.userId } });

    await createAuditLog({
      accountId: context.accountId,
      userId: context.userId,
      action: "billing.invoice.approve",
      entity: "Invoice",
      entityId: invoiceId,
      metadata: { invoiceNumber: invoice.invoiceNumber },
    });
    revalidatePath(`/app/billing/invoices/${invoiceId}`);
    revalidatePath("/app/billing/invoices");
    return { success: true };
  }));
}

export async function sendInvoiceAction(invoiceId: string) {
  const context = await requirePermission("billing.invoice.send");

  // db.invoice.findFirst touches Invoice (dataMode-scoped via Account relation) --
  // without this wrapper it silently defaults to PRODUCTION isolation.
  return withDataModeContext(isDataMode(context.dataMode) ? context.dataMode : null, async () => withAccountIdContext(context.accountId, async () => {
    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId, accountId: context.accountId },
      select: { id: true, status: true, invoiceNumber: true },
    });
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status !== "APPROVED" && invoice.status !== "SENT") throw new Error("Only APPROVED invoices can be marked as sent");
    if (invoice.status === "SENT") return { success: true }; // idempotent

    await db.invoice.update({ where: { id: invoiceId }, data: { status: "SENT", sentById: context.userId } });

    await createAuditLog({
      accountId: context.accountId,
      userId: context.userId,
      action: "billing.invoice.send",
      entity: "Invoice",
      entityId: invoiceId,
      metadata: { invoiceNumber: invoice.invoiceNumber },
    });
    revalidatePath(`/app/billing/invoices/${invoiceId}`);
    revalidatePath("/app/billing/invoices");
    return { success: true };
  }));
}

export async function voidInvoiceAction(invoiceId: string, reason: string) {
  const context = await requirePermission("billing.invoice.void");
  if (!reason.trim()) throw new Error("A reason is required to void an invoice");

  // db.invoice.findFirst and tx.shipmentCharge.updateMany below both touch
  // dataMode-scoped models (Account relation) -- without this wrapper both
  // would silently default to PRODUCTION isolation.
  return withDataModeContext(isDataMode(context.dataMode) ? context.dataMode : null, async () => withAccountIdContext(context.accountId, async () => {
    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId, accountId: context.accountId },
      include: { lines: { include: { charges: { select: { id: true } } } } },
    });
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status === "VOID") return { success: true };
    if (Number(invoice.paidAmount) > 0) throw new Error("Cannot void an invoice that has received payment. Create a credit note instead.");

    // Void invoice + unlock all charges back to RATED in one atomic transaction.
    // Charges become eligible for a new invoice without mutation of historical records.
    await db.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: "VOID", voidedById: context.userId },
      });

      const chargeIds = invoice.lines.flatMap((line) => line.charges.map((c) => c.id));
      if (chargeIds.length > 0) {
        await tx.shipmentCharge.updateMany({
          where: { id: { in: chargeIds }, accountId: context.accountId },
          data: { status: "RATED", invoiceLineId: null },
        });
      }
    });

    await createAuditLog({
      accountId: context.accountId,
      userId: context.userId,
      action: "billing.invoice.void",
      entity: "Invoice",
      entityId: invoiceId,
      metadata: { invoiceNumber: invoice.invoiceNumber, reason },
    });
    revalidatePath(`/app/billing/invoices/${invoiceId}`);
    revalidatePath("/app/billing/invoices");
    revalidatePath("/app/billing");
    return { success: true };
  }));
}
