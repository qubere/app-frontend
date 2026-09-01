import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { validatePathParams } from "@/lib/api/validation";
import { unlinkDocument, DocumentAssociationError } from "@/modules/documentAssociations/service";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string().min(1) });

// Soft-unlinks a document association (active=false). The row is never
// deleted so linked/unlinked history stays visible on the document and on
// the entity's activity timeline.
export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ ctx, requestId, params }) => {
    const paramsVal = validatePathParams(params, paramsSchema, requestId);
    if ("response" in paramsVal) return paramsVal.response;
    const { id } = paramsVal.data;

    try {
      const association = await unlinkDocument({
        accountId: ctx.accountId,
        associationId: id,
        unlinkedBy: ctx.userId,
        auditSource: "UI",
      });
      return NextResponse.json({ association });
    } catch (error) {
      if (error instanceof DocumentAssociationError) {
        return buildErrorResponse(400, "DOCUMENT_ASSOCIATION_ERROR", error.message, undefined, requestId);
      }
      throw error;
    }
  },
  { permission: { any: ["document.update"] }, write: true }
);
