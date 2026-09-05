import { db } from "@/lib/db";
import { parseArtifactIndex, loadNormalizedResult } from "../parser/artifactStore";
import { buildParsedDocumentSearchText } from "../parser/searchText";

export interface BackfillParsedSearchTextOptions {
  accountId?: string;
  batchSize?: number;
  limit?: number;
}

export interface BackfillParsedSearchTextResult {
  scanned: number;
  updated: number;
  skipped: number;
  errors: number;
}

interface DocumentBackfillRecord {
  id: string;
  accountId: string;
  fileName: string;
  rawContent: string | null;
  extractedJson: string | null;
  activeParseVersionId: string | null;
}

/**
 * Backfills `parsedSearchText` for historical `ShipmentDocument` rows where `parsedSearchText` is null.
 *
 * For documents with a succeeded `DocumentParseVersion`, loads the normalized result from object storage
 * and builds the full searchable text index. Falls back to stored `rawContent` or `extractedJson` when
 * no parse version artifacts exist.
 */
export async function backfillParsedSearchText(
  options?: BackfillParsedSearchTextOptions
): Promise<BackfillParsedSearchTextResult> {
  const batchSize = Math.max(1, Math.min(500, options?.batchSize ?? 100));
  const maxLimit = options?.limit ?? Infinity;

  const result: BackfillParsedSearchTextResult = {
    scanned: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  const whereClause = {
    parsedSearchText: null,
    ...(options?.accountId ? { accountId: options.accountId } : {}),
  };

  let cursor: string | undefined = undefined;

  while (result.scanned < maxLimit) {
    const take = Math.min(batchSize, maxLimit - result.scanned);
    const documents: DocumentBackfillRecord[] = await db.shipmentDocument.findMany({
      where: whereClause,
      select: {
        id: true,
        accountId: true,
        fileName: true,
        rawContent: true,
        extractedJson: true,
        activeParseVersionId: true,
      },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
    });

    if (documents.length === 0) break;

    for (const doc of documents) {
      cursor = doc.id;
      result.scanned += 1;

      try {
        let searchText: string | null = null;

        // 1. Try active parse version artifacts first
        const parseVersion = doc.activeParseVersionId
          ? await db.documentParseVersion.findUnique({
              where: { id: doc.activeParseVersionId },
              select: { artifactsJson: true },
            })
          : await db.documentParseVersion.findFirst({
              where: { documentId: doc.id, status: "SUCCEEDED" },
              orderBy: { createdAt: "desc" },
              select: { artifactsJson: true },
            });

        if (parseVersion?.artifactsJson) {
          const index = parseArtifactIndex(parseVersion.artifactsJson);
          if (index) {
            try {
              const normalized = await loadNormalizedResult(index);
              searchText = buildParsedDocumentSearchText(normalized);
            } catch (err) {
              console.warn(
                `[backfillParsedSearchText] Could not load normalized artifacts for doc ${doc.id}:`,
                err instanceof Error ? err.message : String(err)
              );
            }
          }
        }

        // 2. Fallback to rawContent or extractedJson if no parse artifacts yielded text
        if (!searchText?.trim()) {
          const parts: string[] = [];
          if (doc.rawContent?.trim()) parts.push(doc.rawContent.trim());
          if (doc.extractedJson?.trim()) parts.push(doc.extractedJson.trim());
          if (parts.length > 0) {
            searchText = parts.join("\n");
          }
        }

        if (searchText && searchText.trim().length > 0) {
          await db.shipmentDocument.update({
            where: { id: doc.id },
            data: { parsedSearchText: searchText.trim() },
          });
          result.updated += 1;
        } else {
          result.skipped += 1;
        }
      } catch (error) {
        console.error(
          `[backfillParsedSearchText] Failed processing document ${doc.id}:`,
          error instanceof Error ? error.message : String(error)
        );
        result.errors += 1;
      }
    }
  }

  return result;
}
