import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { validatePathParams } from "@/lib/api/validation";
import { db } from "@/lib/db";
import { getDocumentAssociationHistory } from "@/modules/documentAssociations/service";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string().min(1) });

// Full association history (active + unlinked) for a single document --
// the "Linked To" panel on the document detail view.
export const GET = withAuthenticatedRoute<{ id: string }>(
  async ({ ctx, requestId, params }) => {
    const paramsVal = validatePathParams(params, paramsSchema, requestId);
    if ("response" in paramsVal) return paramsVal.response;
    const { id } = paramsVal.data;

    const document = await db.shipmentDocument.findFirst({
      where: { id, accountId: ctx.accountId },
      select: { id: true },
    });
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const associations = await getDocumentAssociationHistory(ctx.accountId, id);
    return NextResponse.json({ associations });
  },
  { permission: { any: ["document.read"] } }
);
