import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { resolveNewLegalEntityParty } from "@/modules/importers/importerCreate.service";

export const GET = withAuthenticatedRoute(async ({ ctx }) => {
  const importers = await db.importerOfRecord.findMany({
    where: { accountId: ctx.accountId },
    include: {
      bond: true,
      powersOfAttorney: true,
      client: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ importersOfRecord: importers });
});

export const POST = withAuthenticatedRoute(async ({ req, ctx }) => {
  const body = await req.json();
  const { name, irsEin, cbpImporterNumber, address, bondId, clientId } = body;

  if (!name || !cbpImporterNumber) {
    return NextResponse.json({ error: "Name and cbpImporterNumber are required" }, { status: 400 });
  }

  if (clientId) {
    const client = await db.client.findFirst({ where: { id: clientId, accountId: ctx.accountId } });
    if (!client) {
      return NextResponse.json({ error: "Invalid clientId: Client not found in this account" }, { status: 400 });
    }
  }

  // Same Party-graph bridge importerCreate.service.ts's UI onboarding flow
  // uses: resolve (or create) the Party this legal entity matches -- fail-open,
  // never blocks this create -- then bridge the new LegalEntity to it.
  const { partyId } = await resolveNewLegalEntityParty(
    { accountId: ctx.accountId, userId: ctx.userId },
    {
      legalName: name,
      entityType: "US_CORPORATION",
      country: address?.country || "US",
      importerNumberType: "EIN",
      importerNumber: irsEin || null,
      addressLine1: address?.street || "",
      city: address?.city || "",
      stateProvince: address?.state || null,
      postalCode: address?.zip || "",
    }
  );

  const legalEntity = await db.legalEntity.create({
    data: {
      accountId: ctx.accountId,
      clientId: clientId || null,
      legalName: name,
      country: address?.country || "US",
      addressLine1: address?.street || null,
      city: address?.city || null,
      stateProvince: address?.state || null,
      postalCode: address?.zip || null,
      taxIdentifier: irsEin || null,
      taxIdentifierType: "EIN",
      partyId,
    },
  });

  const importer = await db.importerOfRecord.create({
    data: {
      accountId: ctx.accountId,
      name,
      // Not collected by the create form yet; leave honestly blank rather than
      // fabricating a plausible-looking EIN/address (see bulkImport.service.ts,
      // which uses the same blank-not-fake convention for unknown values).
      irsEin: irsEin || "",
      cbpImporterNumber,
      address: address || {},
      bondId,
      clientId: clientId || null,
      legalEntityId: legalEntity.id,
    },
    include: { bond: true, client: true },
});

  await createAuditLog({
    accountId: ctx.accountId,
    userId: ctx.userId,
    action: "importer.create",
    entity: "ImporterOfRecord",
    entityId: importer.id,
    source: "UI",
    metadata: { name, cbpImporterNumber },
  });

  return NextResponse.json({ importerOfRecord: importer }, { status: 201 });

}, { permission: "parties.manage", write: true });
