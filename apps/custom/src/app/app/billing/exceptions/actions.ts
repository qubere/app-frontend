"use server";

import { getAccountContext, hasPermission } from "@/lib/auth";
import { disposeBillingException } from "@/lib/billing/disposeBillingException";
import { revalidatePath } from "next/cache";

async function updateBillingException(exceptionId: string, reason: string, status: "RESOLVED" | "WAIVED") {
  const context = await getAccountContext();
  if (!context) throw new Error("Unauthorized: Account context required");
  const permission = status === "WAIVED" ? "billing.exception.waive" : "billing.exception.resolve";
  if (!(await hasPermission(permission))) throw new Error(`Forbidden: ${permission} permission required`);

  const result = await disposeBillingException(
    { accountId: context.accountId, userId: context.userId, dataMode: context.dataMode },
    exceptionId,
    reason,
    status
  );
  revalidatePath("/app/billing/exceptions");
  revalidatePath("/app/billing");
  return result;
}

export async function resolveExceptionAction(exceptionId: string, formData: FormData) {
  return updateBillingException(exceptionId, String(formData.get("reason") || ""), "RESOLVED");
}

export async function waiveExceptionAction(exceptionId: string, formData: FormData) {
  return updateBillingException(exceptionId, String(formData.get("reason") || ""), "WAIVED");
}

/**
 * Applies the same reason/status to many exceptions in one submit. Reuses
 * disposeBillingException per row (permission check, optimistic lock, audit
 * log) rather than a bulk updateMany, so one already-disposed or missing row
 * fails on its own without blocking the rest of the batch.
 */
async function bulkUpdateBillingExceptions(
  exceptionIds: string[],
  reason: string,
  status: "RESOLVED" | "WAIVED"
) {
  const context = await getAccountContext();
  if (!context) throw new Error("Unauthorized: Account context required");
  const permission = status === "WAIVED" ? "billing.exception.waive" : "billing.exception.resolve";
  if (!(await hasPermission(permission))) throw new Error(`Forbidden: ${permission} permission required`);

  const results = await Promise.allSettled(
    exceptionIds.map((id) =>
      disposeBillingException({ accountId: context.accountId, userId: context.userId, dataMode: context.dataMode }, id, reason, status)
    )
  );

  revalidatePath("/app/billing/exceptions");
  revalidatePath("/app/billing");

  const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  if (failed.length > 0) {
    throw new Error(
      `${results.length - failed.length} of ${results.length} succeeded. First failure: ${
        failed[0].reason instanceof Error ? failed[0].reason.message : String(failed[0].reason)
      }`
    );
  }
  return { success: true, count: results.length };
}

export async function bulkResolveExceptionsAction(exceptionIds: string[], formData: FormData) {
  return bulkUpdateBillingExceptions(exceptionIds, String(formData.get("reason") || ""), "RESOLVED");
}

export async function bulkWaiveExceptionsAction(exceptionIds: string[], formData: FormData) {
  return bulkUpdateBillingExceptions(exceptionIds, String(formData.get("reason") || ""), "WAIVED");
}
