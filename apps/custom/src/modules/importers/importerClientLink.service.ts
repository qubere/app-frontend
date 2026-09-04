import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export class ImporterClientLinkError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "HISTORICAL_FILINGS_CONFIRMATION_REQUIRED",
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ImporterClientLinkError";
  }
}

interface LinkImporterClientInput {
  accountId: string;
  importerId: string;
  clientId: string;
  userId: string;
  requestId?: string;
  confirmHistoricalReassignment?: boolean;
}

/**
 * Assigns the importer's commercial owner without rewriting historical
 * shipments or filings. Those records retain the context under which they
 * were created; new work derives its client from the importer.
 */
export async function linkImporterClient(input: LinkImporterClientInput) {
  return db.$transaction(async (tx) => {
    const [importer, client] = await Promise.all([
      tx.importerOfRecord.findFirst({
        where: { id: input.importerId, accountId: input.accountId },
        select: {
          id: true,
          name: true,
          clientId: true,
          legalEntityId: true,
          _count: { select: { customsFilings: true, shipments: true } },
        },
      }),
      tx.client.findFirst({
        where: { id: input.clientId, accountId: input.accountId },
        select: { id: true, name: true },
      }),
    ]);

    // Return the same response for an unknown importer, unknown client, or a
    // cross-account id so this endpoint cannot confirm another tenant's data.
    if (!importer || !client) {
      throw new ImporterClientLinkError("NOT_FOUND", "Importer or client not found.");
    }

    if (importer.clientId === client.id) {
      return {
        importer: { ...importer, client },
        changed: false,
        historicalRecordsPreserved: true,
      };
    }

    const historicalRecordCount = importer._count.customsFilings + importer._count.shipments;
    if (historicalRecordCount > 0 && !input.confirmHistoricalReassignment) {
      throw new ImporterClientLinkError(
        "HISTORICAL_FILINGS_CONFIRMATION_REQUIRED",
        "This importer has operational history. Confirm the client change after reviewing its impact.",
        {
          previousClientId: importer.clientId,
          nextClient: client,
          customsFilings: importer._count.customsFilings,
          shipments: importer._count.shipments,
        },
      );
    }

    const updated = await tx.importerOfRecord.update({
      where: { id: importer.id, accountId: input.accountId },
      data: { clientId: client.id },
      include: {
        client: { select: { id: true, name: true } },
        _count: { select: { customsFilings: true, shipments: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        accountId: input.accountId,
        userId: input.userId,
        action: "importer.client_linked",
        entity: "ImporterOfRecord",
        entityId: importer.id,
        source: "UI",
        requestId: input.requestId,
        metadata: {
          previousClientId: importer.clientId,
          clientId: client.id,
          historicalCustomsFilings: importer._count.customsFilings,
          historicalShipments: importer._count.shipments,
          historicalReassignmentConfirmed: Boolean(input.confirmHistoricalReassignment),
        },
      },
    });

    return {
      importer: updated,
      changed: true,
      historicalRecordsPreserved: true,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 });
}
