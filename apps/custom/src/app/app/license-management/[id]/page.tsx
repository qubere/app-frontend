import { getAccountContext } from "@/lib/auth";
import { holdsPermission } from "@/modules/party/partyActor";
import { redirect } from "next/navigation";
import { LicenseDetailClient } from "./LicenseDetailClient";

export const dynamic = "force-dynamic";

export default async function LicenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getAccountContext();
  if (!context) return null;

  if (!holdsPermission(context, "licenses.view")) {
    redirect("/app/dashboard");
  }

  return (
    <LicenseDetailClient
      licenseId={id}
      canUpdate={holdsPermission(context, "licenses.update")}
      canClose={holdsPermission(context, "licenses.delete")}
      canPostEvents={holdsPermission(context, "licenses.post_events")}
      canAdjust={holdsPermission(context, "licenses.adjust")}
      canAllocate={holdsPermission(context, "licenses.allocate")}
      canManageDocuments={holdsPermission(context, "licenses.manage_documents")}
      canManageParties={holdsPermission(context, "licenses.manage_parties")}
    />
  );
}
