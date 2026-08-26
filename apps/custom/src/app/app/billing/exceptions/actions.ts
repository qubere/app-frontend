"use server";

import { createAuditLog } from "@/lib/audit";
import { getAccountContext, hasPermission } from "@/lib/auth";
import { db, isDataMode, withAccountIdContext, withDataModeContext } from "@/lib/db";
import { revalidatePath } from "next/cache";

async function updateBillingException(exceptionId: string, reason: string, status: "RESOLVED" | "WAIVED") {
  const context = await getAccountContext();
  if (!context) throw new Error("Unauthorized: Account context required");
  const permission = status === "WAIVED" ? "billing.exception.waive" : "billing.exception.resolve";
  if (!(await hasPermission(permission))) throw new Error(`Forbidden: ${permission} permission required`);
  if (!reason.trim()) throw new Error("A resolution reason is required");

  // db.billingException.findFirst and the updateMany below both touch
  // BillingException (dataMode-scoped via Account relation) -- without this
  // wrapper both would silently default to PRODUCTION isolation, and the
  // updateMany would match 0 rows on a DEMO/SANDBOX account.
  return withDataModeContext(isDataMode(context.dataMode) ? context.dataMode : null, async () => withAccountIdContext(context.accountId, async () => {
    const exception = await db.billingException.findFirst({
      where: { id: exceptionId, accountId: context.accountId },
      select: { id: true, type: true, status: true },
    });
    if (!exception) throw new Error("Billing exception not found");
    if (exception.status !== "OPEN") throw new Error("Only open billing exceptions can be resolved or waived");

    const updated = await db.billingException.updateMany({
      where: { id: exception.id, accountId: context.accountId, status: "OPEN" },
      data: { status, resolutionNote: reason.trim(), resolvedAt: new Date() },
    });
    if (updated.count !== 1) throw new Error("This billing exception was already updated by another user");

    await createAuditLog({
      accountId: context.accountId,
      userId: context.userId,
      action: status === "WAIVED" ? "billing.exception.waive" : "billing.exception.resolve",
      entity: "BillingException",
      entityId: exception.id,
      metadata: { type: exception.type, previousStatus: exception.status, status, reason: reason.trim() },
    });
    revalidatePath("/app/billing/exceptions");
    revalidatePath("/app/billing");
    return { success: true };
  }));
}

export async function resolveExceptionAction(exceptionId: string, formData: FormData) {
  return updateBillingException(exceptionId, String(formData.get("reason") || ""), "RESOLVED");
}

export async function waiveExceptionAction(exceptionId: string, formData: FormData) {
  return updateBillingException(exceptionId, String(formData.get("reason") || ""), "WAIVED");
}
