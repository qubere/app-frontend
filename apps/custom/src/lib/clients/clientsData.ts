import { db, isDataMode, withDataModeContext } from "@/lib/db";
import type { AccountContext } from "@/lib/auth";
import { importerReadiness } from "@/modules/importers/importerReadiness";

export interface FormattedClientImporter {
  id: string;
  name: string;
  cbpImporterNumber: string | null;
  registrationStatus: string;
  bondStatus: string | null;
  poaStatus: string | null;
  readiness: ReturnType<typeof importerReadiness>;
}

export interface FormattedLegalEntity {
  id: string;
  legalName: string;
  tradeName: string | null;
  entityType: string;
  country: string;
  taxIdentifier: string | null;
  status: string;
  registeredImporterId: string | null;
}

export interface FormattedClient {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: string;
  createdAt: string;
  shipmentCount: number;
  shipmentCount90d: number;
  productCount: number;
  partyCount: number;
  paymentTermsDays: number;
  portalUserCount: number;
  importers: FormattedClientImporter[];
  legalEntities: FormattedLegalEntity[];
}

export interface ClientsData {
  clients: FormattedClient[];
  portfolio: {
    clientCount: number;
    importerCount: number;
    readyImporterCount: number;
    onboardingImporterCount: number;
    unassignedImporterCount: number;
  };
}

export async function getClientsData(ctx: AccountContext): Promise<ClientsData> {
  const since90Days = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // Client carries an Account relation (dataMode-scoped) -- without this wrapper
  // the query silently defaults to PRODUCTION isolation for DEMO/SANDBOX accounts.
  const [clients, recentShipmentCounts, unassignedImporterCount] = await withDataModeContext(
    isDataMode(ctx.dataMode) ? ctx.dataMode : null,
    async () => Promise.all([
      db.client.findMany({
        where: { accountId: ctx.accountId },
        include: {
          _count: { select: { shipments: true, products: true, parties: true, clientStakeholders: true } },
          legalEntities: { orderBy: { legalName: "asc" } },
          importersOfRecord: {
            include: {
              bond: true,
              powersOfAttorney: { orderBy: { signedDate: "desc" }, take: 1 },
              onboardingEntities: { select: { screeningStatus: true, bondCoverage: true } },
            },
            orderBy: { name: "asc" },
          },
        },
        orderBy: { name: "asc" },
      }),
      db.shipment.groupBy({
        by: ["clientId"],
        where: { accountId: ctx.accountId, clientId: { not: null }, createdAt: { gte: since90Days } },
        _count: { _all: true },
      }),
      db.importerOfRecord.count({ where: { accountId: ctx.accountId, clientId: null } }),
    ]),
  );

  const shipments90dByClient = new Map(recentShipmentCounts.map((row) => [row.clientId, row._count._all]));
  let importerCount = 0;
  let readyImporterCount = 0;

  const formattedClients = clients.map((client) => {
    const importers = client.importersOfRecord.map((importer) => {
      const readiness = importerReadiness(importer);
      importerCount += 1;
      if (readiness.ready) readyImporterCount += 1;
      return {
        id: importer.id,
        name: importer.name,
        cbpImporterNumber: importer.cbpImporterNumber,
        registrationStatus: importer.registrationStatus,
        bondStatus: importer.bond?.status ?? null,
        poaStatus: importer.powersOfAttorney[0]?.status ?? null,
        readiness,
      };
    });
    const importerByLegalEntity = new Map(
      client.importersOfRecord
        .filter((importer) => importer.legalEntityId)
        .map((importer) => [importer.legalEntityId, importer.id]),
    );

    return {
      id: client.id,
      name: client.name,
      contactName: client.contactName,
      contactEmail: client.contactEmail,
      contactPhone: client.contactPhone,
      status: client.status,
      createdAt: client.createdAt.toISOString(),
      shipmentCount: client._count.shipments,
      shipmentCount90d: shipments90dByClient.get(client.id) ?? 0,
      productCount: client._count.products,
      partyCount: client._count.parties,
      paymentTermsDays: client.paymentTermsDays,
      portalUserCount: client._count.clientStakeholders,
      importers,
      legalEntities: client.legalEntities.map((entity) => ({
        id: entity.id,
        legalName: entity.legalName,
        tradeName: entity.tradeName,
        entityType: entity.entityType,
        country: entity.country,
        taxIdentifier: entity.taxIdentifier,
        status: entity.status,
        registeredImporterId: importerByLegalEntity.get(entity.id) ?? null,
      })),
    };
  });

  return {
    clients: formattedClients,
    portfolio: {
      clientCount: formattedClients.length,
      importerCount,
      readyImporterCount,
      onboardingImporterCount: importerCount - readyImporterCount,
      unassignedImporterCount,
    },
  };
}
