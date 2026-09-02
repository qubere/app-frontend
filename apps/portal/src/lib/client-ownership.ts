import { db } from '@qubere/db';
import type { Prisma } from '@prisma/client';

const importerOwnerSelect = {
  id: true, accountId: true, clientId: true,
  onboardingEntities: { where: { case: { status: { not: 'withdrawn' }, clientId: { not: null } } }, select: { case: { select: { accountId: true, clientId: true } } } },
} as const;

type ImporterOwner = Prisma.ImporterOfRecordGetPayload<{ select: typeof importerOwnerSelect }>;
export function importerClientId(importer: ImporterOwner, accountId: string): string | null {
  if (importer.accountId !== accountId) return null;
  if (importer.clientId) return importer.clientId;
  const ids = [...new Set(importer.onboardingEntities.filter(e => e.case.accountId === accountId).flatMap(e => e.case.clientId ? [e.case.clientId] : []))];
  // Old onboarding records can establish ownership, but conflicting client
  // links require a broker correction rather than guessing from a name.
  return ids.length === 1 ? ids[0] : null;
}

export async function loadImporterOwners(accountId: string, clientIds: string[] | null) {
  if (clientIds === null) return new Map<string, string>();
  const importers = await db.importerOfRecord.findMany({
    where: { accountId, ...(clientIds === null ? {} : { OR: [
      { clientId: { in: clientIds } },
      { clientId: null, onboardingEntities: { some: { accountId, case: { accountId, clientId: { in: clientIds }, status: { not: 'withdrawn' } } } } },
    ] }) }, select: importerOwnerSelect,
  });
  return new Map(importers.flatMap(i => {
    const clientId = importerClientId(i, accountId);
    return clientId && (clientIds === null || clientIds.includes(clientId)) ? [[i.id, clientId] as const] : [];
  }));
}

export function shipmentClientWhere(clientIds: string[] | null, owners: Map<string, string>): Prisma.ShipmentWhereInput {
  if (clientIds === null) return {};
  return { OR: [{ clientId: { in: clientIds } }, { clientId: null, importerOfRecordId: { in: [...owners.keys()] } }] };
}

export async function shipmentClientId(accountId: string, shipment: { clientId: string | null; importerOfRecordId?: string | null }): Promise<string | null> {
  if (shipment.clientId) return shipment.clientId;
  if (!shipment.importerOfRecordId) return null;
  const importer = await db.importerOfRecord.findFirst({ where: { id: shipment.importerOfRecordId, accountId }, select: importerOwnerSelect });
  return importer ? importerClientId(importer, accountId) : null;
}

export function documentClientWhere(accountId: string, clientIds: string[] | null, owners: Map<string, string>): Prisma.ShipmentDocumentWhereInput {
  const shipment = { accountId, deletedAt: null, ...shipmentClientWhere(clientIds, owners) };
  return { accountId, status: { not: "DISCARDED" }, AND: [
    { OR: [{ source: { not: "INBOUND_EMAIL" } }, { portalVisibility: "CUSTOMER" }] },
    ...(clientIds === null ? [] : [{ OR: [{ clientId: { in: clientIds } }, { clientId: null, shipment }] }]),
    // Don't expose a linked shipment's identity when it belongs outside scope.
    { OR: [{ shipmentId: null }, { shipment }] },
  ] };
}
