import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { parseAndValidateBody } from "@/lib/api/validation";
import {
  linkDocument,
  getEntityDocuments,
  DocumentAssociationError,
} from "@/modules/documentAssociations/service";
import { z } from "zod";

const entityTypeEnum = z.enum(["SHIPMENT", "PARTY", "PRODUCT", "LICENSE", "FILING"]);
const relationshipTypeEnum = z.enum([
  "SOURCE_DOCUMENT",
  "SUPPORTING_DOCUMENT",
  "FILING_ATTACHMENT",
  "LICENSE_EVIDENCE",
  "ORIGIN_EVIDENCE",
  "GENERAL",
]);

const bodySchema = z.object({
  documentId: z.string().min(1),
  entityType: entityTypeEnum,
  entityId: z.string().min(1),
  relationshipType: relationshipTypeEnum.optional(),
});

// Links a document to a business entity (Shipment/Party/Product/License/Filing).
// Idempotent: re-linking an already-active pair returns the existing row.
export const POST = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const bodyVal = await parseAndValidateBody(req, bodySchema, requestId);
    if ("response" in bodyVal) return bodyVal.response;
    const { documentId, entityType, entityId, relationshipType } = bodyVal.data;

    try {
      const { association, created } = await linkDocument({
        accountId: ctx.accountId,
        documentId,
        entityType,
        entityId,
        relationshipType,
        source: "USER",
        linkedBy: ctx.userId,
        auditSource: "UI",
      });
      return NextResponse.json({ association, created }, { status: created ? 201 : 200 });
    } catch (error) {
      if (error instanceof DocumentAssociationError) {
        return buildErrorResponse(400, "DOCUMENT_ASSOCIATION_ERROR", error.message, undefined, requestId);
      }
      throw error;
    }
  },
  { permission: { any: ["document.update"] }, write: true }
);

const listQuerySchema = z.object({
  entityType: entityTypeEnum,
  entityId: z.string().min(1),
});

// Lists all active documents linked to a business entity -- the query the
// EntityDocuments UI component uses regardless of which entity type it's
// rendered for.
export const GET = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const url = new URL(req.url);
    const parsed = listQuerySchema.safeParse({
      entityType: url.searchParams.get("entityType"),
      entityId: url.searchParams.get("entityId"),
    });
    if (!parsed.success) {
      return buildErrorResponse(400, "INVALID_QUERY", "Invalid query", parsed.error.flatten(), requestId);
    }

    const associations = await getEntityDocuments(
      ctx.accountId,
      parsed.data.entityType,
      parsed.data.entityId
    );
    return NextResponse.json({ associations });
  },
  { permission: { any: ["document.read"] } }
);
