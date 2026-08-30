import { createAuditLog } from "@/lib/audit";
import { db, isDataMode, withAccountIdContext, withDataModeContext } from "@/lib/db";

export type BillingExceptionDisposition = "RESOLVED" | "WAIVED";

export interface DisposeContext {
  accountId: string;
  userId: string;
  dataMode: string | null | undefined;
}

/**
 * Core resolve/waive transition for a BillingException. Shared by the billing
 * workspace server action and the Today lane's JSON route so both apply the
 * same optimistic-lock + audit behavior. The caller owns the permission check
 * (resolve vs waive gate on different permissions).
 *
 * BillingException is dataMode-scoped via its Account relation -- without the
 * context wrappers the findFirst/updateMany silently default to PRODUCTION
 * isolation and match 0 rows for a DEMO/SANDBOX account.
 */
export async function disposeBillingException(
  context: DisposeContext,
  exceptionId: string,
  reason: string,
  status: BillingExceptionDisposition
): Promise<{ success: true }> {
  if (!reason.trim()) throw new Error("A resolution reason is required");

  return withDataModeContext(isDataMode(context.dataMode) ? context.dataMode : null, async () =>
    withAccountIdContext(context.accountId, async () => {
      const exception = await db.billingException.findFirst({
        where: { id: exceptionId, accountId: context.accountId },
        select: { id: true, type: true, status: true },
      });
      if (!exception) throw new Error("Billing exception not found");
      if (exception.status !== "OPEN") {
        throw new Error("Only open billing exceptions can be resolved or waived");
      }

      const updated = await db.billingException.updateMany({
        where: { id: exception.id, accountId: context.accountId, status: "OPEN" },
        data: { status, resolutionNote: reason.trim(), resolvedAt: new Date() },
      });
      if (updated.count !== 1) {
        throw new Error("This billing exception was already updated by another user");
      }

      await createAuditLog({
        accountId: context.accountId,
        userId: context.userId,
        action: status === "WAIVED" ? "billing.exception.waive" : "billing.exception.resolve",
        entity: "BillingException",
        entityId: exception.id,
        metadata: { type: exception.type, previousStatus: exception.status, status, reason: reason.trim() },
      });

      return { success: true };
    })
  );
}
