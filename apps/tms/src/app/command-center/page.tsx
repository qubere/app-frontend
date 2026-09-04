import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getAccountContext, hasPermission } from "@qubere/auth";
import { runWithAccountId } from "@qubere/db";
import { getOperationsSummary } from "@/modules/operations/services/operationsSummaryService";
import { OperationsDashboardClient } from "@/components/OperationsDashboardClient";
import { AccessDenied } from "@/components/AccessDenied";

export default async function CommandCenterPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const context = await getAccountContext();
  if (!context) {
    redirect("/sign-in");
  }

  const canAccess = await hasPermission("tms.access");
  if (!canAccess) {
    return <AccessDenied />;
  }

  const summary = await runWithAccountId(context.accountId, async () => {
    return await getOperationsSummary(context as any);
  });

  return <OperationsDashboardClient summary={summary} />;
}
