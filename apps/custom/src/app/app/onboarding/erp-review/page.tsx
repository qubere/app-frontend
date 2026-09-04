import { getAccountContext, hasPermission } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ErpReviewClient } from "./ErpReviewClient";

export default async function ErpReviewPage() {
  const context = await getAccountContext();
  if (!context) redirect("/sign-in");
  if (!(await hasPermission("onboarding.manage"))) redirect("/app/dashboard");

  // Load available ERP integrations for this account
  const erpConfigs = await db.integrationConfig.findMany({
    where: { accountId: context.accountId, category: "ERP" },
    select: { id: true, provider: true, name: true, status: true, lastSyncAt: true },
    orderBy: { createdAt: "desc" },
  });

  return <ErpReviewClient erpConfigs={JSON.parse(JSON.stringify(erpConfigs))} />;
}
