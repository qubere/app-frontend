import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { logger } from "@/lib/logging/logger";
import { resolvePartyForCompany } from "@/modules/party/partyResolutionService";
import { z } from "zod";

export const GET = withAuthenticatedRoute(async ({ ctx }) => {
  const legalEntities = await db.legalEntity.findMany({
    where: { accountId: ctx.accountId },
    include: {
      client: true,
      importerOfRecord: {
        include: {
          bond: true,
          powersOfAttorney: { orderBy: { signedDate: "desc" }, take: 1 },
        },
      },
    },
    orderBy: { legalName: "asc" },
  });

  return NextResponse.json({ legalEntities });
});

const createLegalEntitySchema = z.object({
  clientId: z.string().optional(),
  legalName: z.string().min(1),
  tradeName: z.string().optional(),
  entityType: z.string().optional(),
  country: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  stateProvince: z.string().optional(),
  postalCode: z.string().optional(),
  taxIdentifier: z.string().optional(),
});

export const POST = withAuthenticatedRoute(async ({ req, ctx }) => {
  const body = await req.json();
  if (Object.prototype.hasOwnProperty.call(body, "cbpImporterNumber")) {
    return NextResponse.json({
      error: {
        code: "IMPORTER_WORKFLOW_REQUIRED",
        message: "CBP importer numbers must be created through Add importer so registration, POA, bond, and screening stay linked.",
        href: "/app/importers",
      },
    }, { status: 400 });
  }
  const val = createLegalEntitySchema.safeParse(body);
  if (!val.success) {
    return NextResponse.json({ error: "Invalid payload", details: val.error.format() });
  }

  const data = val.data;

  if (data.clientId) {
    const client = await db.client.findFirst({ where: { id: data.clientId, accountId: ctx.accountId } });
    if (!client) {
      return NextResponse.json({ error: "Invalid clientId: Client not found in this account" }, { status: 400 });
    }
  }

  const country = data.country || "US";

  // Resolve/create this legal entity's Party twin before writing the row
  // (#320 Phase 1, spec §6.2) -- outside any transaction, since resolution
  // can trigger Restricted Party Screening, and never blocking creation:
  // a failure or an uncertain (POSSIBLE_MATCH/AMBIGUOUS) match just leaves
  // this entity unbridged, exactly today's behavior.
  let partyId: string | null = null;
  try {
    const resolved = await resolvePartyForCompany(
      { accountId: ctx.accountId, userId: ctx.userId, requestId: null },
      {
        legalName: data.legalName,
        country,
        taxId: data.taxIdentifier || null,
        address: data.addressLine1
          ? {
              addressLine1: data.addressLine1,
              addressLine2: data.addressLine2 || null,
              city: data.city || null,
              stateProvince: data.stateProvince || null,
              postalCode: data.postalCode || null,
              country,
            }
          : null,
      }
    );
    partyId = resolved.outcome === "CANDIDATES" ? null : resolved.partyId;
  } catch (error) {
    logger.warn("legal-entities: resolvePartyForCompany failed, creating the entity without a party link", {
      accountId: ctx.accountId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const entity = await db.legalEntity.create({
    data: {
      accountId: ctx.accountId,
      clientId: data.clientId || null,
      legalName: data.legalName,
      tradeName: data.tradeName || null,
      entityType: data.entityType || "US_CORPORATION",
      country,
      addressLine1: data.addressLine1 || null,
      addressLine2: data.addressLine2 || null,
      city: data.city || null,
      stateProvince: data.stateProvince || null,
      postalCode: data.postalCode || null,
      taxIdentifier: data.taxIdentifier || null,
      status: "ACTIVE",
      partyId,
    },
    include: {
      client: true,
      importerOfRecord: true,
    },
});

  return NextResponse.json({ legalEntity: entity }, { status: 201 });

}, { permission: "parties.manage", write: true });
