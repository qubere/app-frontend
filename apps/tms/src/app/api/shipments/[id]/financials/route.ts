import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@qubere/auth";
import { computeShipmentFinancials } from "@/modules/financials/services/financialLedgerService";

interface RouteParams {
  id: string;
}

/**
 * GET /api/shipments/[id]/financials
 *
 * Returns the financial ledger for a shipment, computed fresh from DB.
 * Writes the derived cache back to Shipment for fast subsequent reads.
 */
export const GET = withAuthenticatedRoute<RouteParams>(async ({ ctx, params }) => {
  const { id: shipmentId } = await params;
  const ledger = await computeShipmentFinancials(ctx, shipmentId);
  return NextResponse.json(ledger);
});
