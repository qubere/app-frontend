import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@qubere/auth";
import { sendToCustoms } from "@/modules/shipments/services/customsHandoffService";

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ ctx, params }) => {
    try {
      const resolvedParams = await params;
      const shipmentId = resolvedParams.id;

      if (!shipmentId) {
        return NextResponse.json({ error: "Shipment ID is required" }, { status: 400 });
      }

      const result = await sendToCustoms({
        accountId: ctx.accountId,
        userId: ctx.userId,
        shipmentId,
      });

      return NextResponse.json(result);
    } catch (err: any) {
      const message = err.message || "Failed to send shipment to Customs";
      const status = message.includes("not found") ? 404 : 500;
      return NextResponse.json({ error: message }, { status });
    }
  },
  { permission: "customs.handoff", write: true }
);
