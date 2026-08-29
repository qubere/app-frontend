import { getAccountContext } from "@/lib/auth";
import { holdsPermission } from "@/modules/party/partyActor";
import { redirect } from "next/navigation";
import { LicenseManagementClient } from "./LicenseManagementClient";

export const dynamic = "force-dynamic";

export default async function LicenseManagementPage() {
  const context = await getAccountContext();
  if (!context) return null;

  if (!holdsPermission(context, "licenses.view")) {
    redirect("/app/dashboard");
  }

  return (
    <LicenseManagementClient
      canCreate={holdsPermission(context, "licenses.create")}
      canExecuteDetermination={holdsPermission(context, "licenseDetermination.execute")}
      canViewDetermination={holdsPermission(context, "licenseDetermination.view")}
      canViewAlerts={holdsPermission(context, "licenses.alerts")}
    />
  );
}
