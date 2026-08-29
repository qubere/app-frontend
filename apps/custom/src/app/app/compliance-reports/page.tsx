import { getAccountContext } from "@/lib/auth";
import { holdsPermission } from "@/modules/party/partyActor";
import { redirect } from "next/navigation";
import { ComplianceReportsClient } from "./ComplianceReportsClient";

export const dynamic = "force-dynamic";

export default async function ComplianceReportsPage() {
  const context = await getAccountContext();
  if (!context) return null;

  if (!holdsPermission(context, "compliance.reports.view")) {
    redirect("/app/dashboard");
  }

  const canGenerate = holdsPermission(context, "compliance.reports.generate");
  const canManage = holdsPermission(context, "compliance.reports.manage");

  return <ComplianceReportsClient canGenerate={canGenerate} canManage={canManage} />;
}
