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
