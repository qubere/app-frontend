import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getAccountContext, hasPermission } from "@qubere/auth";
import { runWithAccountId } from "@qubere/db";
import { getShipmentWorkspaceDetails } from "@/modules/shipments/services/shipmentWorkspaceService";
import { ShipmentWorkspaceClient } from "./ShipmentWorkspaceClient";
import { Card, Button } from "@/components/ui";
import { AccessDenied } from "@/components/AccessDenied";
import { Package } from "lucide-react";
import Link from "next/link";

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  const { id } = await params;

  const workspace = await runWithAccountId(context.accountId, async () => {
    return await getShipmentWorkspaceDetails(context as any, id);
  });

  if (!workspace) {
    return (
      <div className="min-h-screen bg-surface-muted flex items-center justify-center p-8">
        <Card className="p-8 text-center max-w-md space-y-4">
          <Package className="w-10 h-10 text-ink-muted mx-auto" />
          <h2 className="text-lg font-extrabold text-ink">Shipment Not Found</h2>
          <p className="text-xs text-ink-muted font-medium">The requested shipment ID could not be loaded from active context.</p>
          <Link href="/shipments">
            <Button variant="primary" size="sm">Back to Active Shipments</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const { journey, crossDomainRisks, healthSnapshot, financials, lifecycleStatus } = workspace;
  const shipment: any = workspace.shipment;

  return (
    <ShipmentWorkspaceClient
      shipment={shipment}
      journey={journey}
      crossDomainRisks={crossDomainRisks}
      healthSnapshot={healthSnapshot}
      financials={financials}
      lifecycleStatus={lifecycleStatus}
    />
  );
}
