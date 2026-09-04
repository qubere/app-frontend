import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@qubere/db";
import { getAccountContext } from "@qubere/auth";
import { TmsAdminWorkbenchClient } from "./TmsAdminWorkbenchClient";
import { getTmsAiAnalytics } from "@/lib/tmsAiAnalytics";

export default async function AdminPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const context = await getAccountContext();
  const currentAccount = context?.accountId
    ? await db.account.findUnique({ where: { id: context.accountId } }).catch(() => null)
    : null;

  const [
    allAccounts,
    agentDecisionCount,
    openExceptionCount,
    carrierInvoiceCount,
    aiAnalytics,
  ] = await Promise.all([
    db.account.findMany({ take: 20, orderBy: { createdAt: "desc" } }).catch(() => []),
    db.agentDecision.count().catch(() => 0),
    db.exceptionItem.count({ where: { status: "Open" } }).catch(() => 0),
    db.carrierInvoice.count().catch(() => 0),
    getTmsAiAnalytics({ level: "OVERALL", rangeDays: 30 }),
  ]);

  const initialAccounts = allAccounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    status: a.status,
    createdAt: new Date(a.createdAt).toLocaleDateString(),
    dataMode: (a.dataMode as any) || "PRODUCTION",
  }));

  return (
    <TmsAdminWorkbenchClient
      currentAccount={
        currentAccount
          ? {
              id: currentAccount.id,
              name: currentAccount.name,
              dataMode: (currentAccount.dataMode as any) || "PRODUCTION",
            }
          : undefined
      }
      initialAccounts={initialAccounts}
      aiAnalytics={aiAnalytics}
      telemetry={{
        agentDecisionCount,
        openExceptionCount,
        carrierInvoiceCount,
      }}
    />
  );
}
