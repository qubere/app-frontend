import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { parseAndValidateBody, validateQueryParams } from "@/lib/api/validation";
import { db } from "@/lib/db";
import { ImporterCreateError, createImporter } from "@/modules/importers/importerCreate.service";
import { importerReadiness } from "@/modules/importers/importerReadiness";

const querySchema = z.object({
  client: z.string().optional(),
  readiness: z.enum(["ready", "blocked", "onboarding"]).optional(),
  missing: z.enum(["client", "5106", "poa", "bond", "screening"]).optional(),
  path: z.enum(["STANDARD", "SWITCHING", "NON_RESIDENT", "BULK", "ERP"]).optional(),
  q: z.string().trim().max(100).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

const legalEntitySchema = z.object({
  legalName: z.string().trim().min(1).max(200),
  tradeName: z.string().trim().max(200).nullable().optional(),
  entityType: z.string().min(1).max(80),
  country: z.string().trim().min(2).max(2).transform((value) => value.toUpperCase()),
  importerNumberType: z.enum(["EIN", "SSN", "CBP_ASSIGNED"]),
  importerNumber: z.string().trim().max(40).nullable().optional(),
  cbpImporterNumber: z.string().trim().max(40).nullable().optional(),
  addressLine1: z.string().trim().min(1).max(200),
  addressLine2: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().min(1).max(120),
  stateProvince: z.string().trim().max(120).nullable().optional(),
  postalCode: z.string().trim().min(1).max(30),
}).strict();

const createSchema = z.object({
  clientId: z.string().min(1),
  path: z.enum(["STANDARD", "SWITCHING", "NON_RESIDENT"]).default("STANDARD"),
  legalEntityId: z.string().min(1).optional(),
  legalEntity: legalEntitySchema.optional(),
}).strict().refine((value) => Boolean(value.legalEntityId) !== Boolean(value.legalEntity), {
  message: "Choose exactly one legal entity source.",
  path: ["legalEntity"],
});

const readinessProjection = {
  id: true,
  clientId: true,
  registrationStatus: true,
  bond: { select: { status: true, expirationDate: true, bondAmount: true, continuousBondFormulaAmount: true } },
  powersOfAttorney: { select: { status: true, expirationDate: true, revokedAt: true }, orderBy: { createdAt: "desc" as const } },
  onboardingEntities: { select: { screeningStatus: true, bondCoverage: true }, orderBy: { updatedAt: "desc" as const }, take: 10 },
} satisfies Prisma.ImporterOfRecordSelect;

export const GET = withAuthenticatedRoute(async ({ req, ctx, requestId }) => {
  const parsed = validateQueryParams(new URL(req.url).toString(), querySchema, requestId);
  if ("response" in parsed) return parsed.response;
  const query = parsed.data;
  const where: Prisma.ImporterOfRecordWhereInput = {
    accountId: ctx.accountId,
    ...(query.client === "none" ? { clientId: null } : query.client ? { clientId: query.client } : {}),
    ...(query.path ? { onboardingCases: { some: { path: query.path } } } : {}),
    ...(query.q ? { OR: [
      { name: { contains: query.q, mode: "insensitive" } },
      { cbpImporterNumber: { contains: query.q, mode: "insensitive" } },
      { irsEin: { contains: query.q, mode: "insensitive" } },
      { client: { name: { contains: query.q, mode: "insensitive" } } },
    ] } : {}),
  };
  const scanSize = Math.min(query.limit * 4, 200);
  const raw = await db.importerOfRecord.findMany({
    where,
    select: {
      ...readinessProjection,
      name: true,
      irsEin: true,
      cbpImporterNumber: true,
      createdAt: true,
      client: { select: { id: true, name: true } },
      onboardingCases: { select: { id: true, path: true, status: true, currentStep: true }, orderBy: { updatedAt: "desc" }, take: 1 },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    take: scanSize + 1,
  });
  const scanned = raw.slice(0, scanSize);
  const enriched = scanned.map((importer) => ({ ...importer, readiness: importerReadiness(importer) }));
  const missingCode = query.missing === "5106" ? "FIVE_OH_SIX" : query.missing?.toUpperCase();
  const filtered = enriched.filter((importer) => {
    if (missingCode && !importer.readiness.blockers.some((blocker) => blocker.code === missingCode)) return false;
    if (query.readiness === "ready" && !importer.readiness.ready) return false;
    if (query.readiness === "blocked" && importer.readiness.ready) return false;
    if (query.readiness === "onboarding" && !importer.onboardingCases.some((item) => item.status !== "active")) return false;
    return true;
  });
  const importers = filtered.slice(0, query.limit);
  const nextCursor = filtered.length > query.limit
    ? importers.at(-1)?.id
    : raw.length > scanSize
      ? scanned.at(-1)?.id
      : null;
  return NextResponse.json({ importers, nextCursor, requestId }, { headers: { "Cache-Control": "no-store" } });
}, { permission: { any: ["parties.manage", "client.read"] } });

export const POST = withAuthenticatedRoute(async ({ req, ctx, requestId }) => {
  const parsed = await parseAndValidateBody(req, createSchema, requestId);
  if ("response" in parsed) return parsed.response;
  try {
    const result = await createImporter({
      ...parsed.data,
      accountId: ctx.accountId,
      userId: ctx.userId,
      requestId,
    });
    return NextResponse.json({ ...result, requestId }, { status: 201 });
  } catch (error) {
    if (error instanceof ImporterCreateError) {
      return buildErrorResponse(error.code === "NOT_FOUND" ? 404 : 409, error.code, error.message, error.details, requestId);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return buildErrorResponse(409, "CONFLICT", "An importer already uses this legal identity or CBP number.", undefined, requestId);
    }
    throw error;
  }
}, { permission: "onboarding.manage", write: true });
