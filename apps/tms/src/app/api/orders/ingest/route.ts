import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@qubere/auth";
import { ingestErpPurchaseOrder } from "@/modules/orders/services/erpConnectorService";

export const POST = withAuthenticatedRoute(
  async ({ req, ctx }: any) => {
    try {
      const body = await req.json();

      if (!body.poNumber || !body.lineItems) {
        return NextResponse.json({ error: "poNumber and lineItems are required" }, { status: 400 });
      }

      const result = await ingestErpPurchaseOrder(ctx, body);
      return NextResponse.json(result);
    } catch (err: any) {
      return NextResponse.json({ error: err.message || "ERP order ingestion failed" }, { status: 500 });
    }
  },
  { permission: "transportation_orders.write", write: true }
);
