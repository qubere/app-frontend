import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import {
  listImporterSecurityFilings,
  upsertImporterSecurityFiling,
} from "@/modules/isf/isfTransactionService";

const elementsSchema = z
  .object({
    sellerNameAddress: z.string().optional(),
    buyerNameAddress: z.string().optional(),
    importerOfRecordNumber: z.string().optional(),
    consigneeNumber: z.string().optional(),
    manufacturerNameAddress: z.string().optional(),
    shipToPartyNameAddress: z.string().optional(),
    countryOfOrigin: z.string().optional(),
    commodityHtsNumber: z.string().optional(),
    containerStuffingLocation: z.string().optional(),
    consolidatorNameAddress: z.string().optional(),
    vesselStowPlan: z.string().optional(),
    containerStatusMessages: z.string().optional(),
  })
  .strip();

const upsertSchema = z.object({
  id: z.string().optional(),
  shipmentId: z.string().nullish(),
  billOfLadingNumber: z.string().nullish(),
  ladingDate: z.string().datetime().nullish(),
  elements: elementsSchema.default({}),
});

export const GET = withAuthenticatedRoute(
  async ({ ctx, req, requestId }) => {
    const url = new URL(req.url);
    const filings = await listImporterSecurityFilings(ctx.accountId, {
      shipmentId: url.searchParams.get("shipmentId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    });
    return NextResponse.json({ filings, requestId });
  },
  { permission: "entry.read" }
);

export const POST = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return buildErrorResponse(400, "MALFORMED_JSON", "Failed to parse JSON body", undefined, requestId);
    }

    let input;
    try {
      input = upsertSchema.parse(raw);
    } catch (err) {
      if (err instanceof ZodError) {
        return buildErrorResponse(400, "INVALID_INPUT", "Invalid ISF payload", err.issues, requestId);
      }
      throw err;
    }

    const filing = await upsertImporterSecurityFiling({
      accountId: ctx.accountId,
      id: input.id,
      shipmentId: input.shipmentId ?? null,
      billOfLadingNumber: input.billOfLadingNumber ?? null,
      ladingDate: input.ladingDate ?? null,
      elements: input.elements,
      createdByUserId: ctx.userId,
    });

    return NextResponse.json({ filing, requestId }, { status: input.id ? 200 : 201 });
  },
  { permission: "entry.create", write: true }
);
