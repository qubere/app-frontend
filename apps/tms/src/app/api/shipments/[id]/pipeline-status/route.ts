import { withAuthenticatedRoute } from "@qubere/auth";
import { getTmsPipelineStatus } from "@/lib/tmsPipelineEngine";
import { NextResponse } from "next/server";

export const GET = withAuthenticatedRoute<{ id: string }>(
  async ({ ctx, params, requestId }) => {
    const status = await getTmsPipelineStatus(ctx.accountId, params.id);
    if (!status) {
      return NextResponse.json(
        { error: "No TMS processing run exists for this shipment.", requestId },
        { status: 404 }
      );
    }
    return NextResponse.json({ ...status, requestId });
  },
  { permission: "shipment.read" }
);
