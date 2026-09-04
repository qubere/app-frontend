import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { parseAndValidateBody, validatePathParams } from "@/lib/api/validation";
import { db } from "@/lib/db";
import { buildAlsoKnownAs } from "@/modules/importers/alsoKnownAs";
import { ImporterClientLinkError, linkImporterClient } from "@/modules/importers/importerClientLink.service";
import { importerReadiness } from "@/modules/importers/importerReadiness";

const pathSchema = z.object({ id: z.string().min(1) });
const patchSchema = z.object({
  clientId: z.string().min(1),
  confirmHistoricalReassignment: z.boolean().optional().default(false),
}).strict();

export const GET = withAuthenticatedRoute<{ id: string }>(async ({ ctx, params, requestId }) => {
  const path = validatePathParams(params, pathSchema, requestId);
  if ("response" in path) return path.response;
  const importer = await db.importerOfRecord.findFirst({
    where: { id: path.data.id, accountId: ctx.accountId },
    include: {
      client: { select: { id: true, name: true, paymentTermsDays: true } },
      legalEntity: {
        include: {
          // #320 Phase 1 bridge (spec §3.5's "Also known as" panel): present
          // only once resolvePartyForCompany has linked this legal entity to
          // a Party -- null until then, which is an expected, unremarkable
          // state (pre-backfill, or a resolution that only found candidates).
          party: {
            select: {
              id: true,
              roles: { where: { status: "ACTIVE" }, select: { roleType: true, status: true } },
              legalEntities: { select: { id: true, _count: { select: { productParties: true, shipmentParties: true } } } },
            },
          },
        },
      },
      bond: { include: { verifications: { orderBy: { performedAt: "desc" }, take: 10 } } },
      powersOfAttorney: { include: { envelope: true }, orderBy: { createdAt: "desc" } },
      onboardingEntities: { include: { case: { select: { id: true, path: true, status: true, currentStep: true } } }, orderBy: { updatedAt: "desc" } },
      onboardingCases: { include: { fiveOhSixRecords: { orderBy: { createdAt: "desc" } }, events: { orderBy: { createdAt: "desc" }, take: 50 } }, orderBy: { updatedAt: "desc" } },
      shipments: { select: { id: true, shipmentNumber: true, status: true, estimatedArrival: true }, orderBy: { createdAt: "desc" }, take: 10 },
      _count: { select: { shipments: true, customsFilings: true } },
    },
  });
  if (!importer) return buildErrorResponse(404, "NOT_FOUND", "Importer not found.", undefined, requestId);

  const party = importer.legalEntity?.party ?? null;
  const enriched = {
    ...importer,
    readiness: importerReadiness(importer),
    party: party ? { id: party.id, roles: party.roles, alsoKnownAs: buildAlsoKnownAs(party, importer.legalEntity!.id) } : null,
  };
  return NextResponse.json({ importer: enriched, requestId }, {
    headers: { "Cache-Control": "no-store" },
  });
}, { permission: { any: ["parties.manage", "client.read"] } });

export const PATCH = withAuthenticatedRoute<{ id: string }>(async ({ req, ctx, params, requestId }) => {
  const path = validatePathParams(params, pathSchema, requestId);
  if ("response" in path) return path.response;

  const body = await parseAndValidateBody(req, patchSchema, requestId);
  if ("response" in body) return body.response;

  try {
    const result = await linkImporterClient({
      accountId: ctx.accountId,
      importerId: path.data.id,
      clientId: body.data.clientId,
      userId: ctx.userId,
      requestId,
      confirmHistoricalReassignment: body.data.confirmHistoricalReassignment,
    });
    return NextResponse.json({ ...result, requestId }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ImporterClientLinkError) {
      if (error.code === "NOT_FOUND") {
        return buildErrorResponse(404, error.code, error.message, undefined, requestId);
      }
      return buildErrorResponse(409, error.code, error.message, error.details, requestId);
    }
    throw error;
  }
}, { permission: "parties.manage", write: true });
