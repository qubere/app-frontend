import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@qubere/auth";
import { z } from "zod";
import { respondToTender } from "@/modules/tenders/services/tenderService";

const respondTenderSchema = z.object({
  status: z.enum(["ACCEPTED", "REJECTED"]),
  reason: z.string().trim().min(1).optional().nullable(),
});

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ req, ctx, params }) => {
    const { id } = await params;
    const body = await req.json();
    const parsed = respondTenderSchema.parse(body);

    if (parsed.status === "REJECTED" && !parsed.reason) {
      return NextResponse.json(
        { error: "A rejection reason is required" },
        { status: 400 }
      );
    }

    const updatedTender = await respondToTender(ctx, {
      tenderId: id,
      accept: parsed.status === "ACCEPTED",
      rejectionReason: parsed.reason ?? undefined,
    });

    return NextResponse.json({ tender: updatedTender });
  },
  { permission: "tenders.send", write: true }
);
