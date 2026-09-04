import { db } from "@/lib/db";

export interface ImporterContext {
  importerOfRecordId: string | null;
  importerName: string | null;
  bondId: string | null;
  needsImporterSelection: boolean;
}

/** Compatibility helper for callers that begin with client context.
 * ImporterOfRecord is authoritative; the onboarding-entity triangle is no
 * longer used to infer filing identity.
 */
export async function resolveImporterContext(
  accountId: string,
  clientId: string | null | undefined,
): Promise<ImporterContext> {
  if (!clientId) return { importerOfRecordId: null, importerName: null, bondId: null, needsImporterSelection: false };

  const [client, importers] = await Promise.all([
    db.client.findFirst({ where: { id: clientId, accountId }, select: { name: true } }),
    db.importerOfRecord.findMany({
      where: { accountId, clientId },
      select: { id: true, name: true, bondId: true },
      orderBy: { createdAt: "asc" },
      take: 2,
    }),
  ]);

  if (importers.length !== 1) {
    return {
      importerOfRecordId: null,
      importerName: importers.length === 0 ? client?.name ?? null : null,
      bondId: null,
      needsImporterSelection: importers.length > 1,
    };
  }

  return {
    importerOfRecordId: importers[0].id,
    importerName: importers[0].name,
    bondId: importers[0].bondId,
    needsImporterSelection: false,
  };
}
