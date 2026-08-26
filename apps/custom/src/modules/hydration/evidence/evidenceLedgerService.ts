/**
 * Evidence Ledger Service — Batch persistence and compatibility projection engine
 *
 * Persists atomic evidence items into the `ExtractionField` table with strict parse version
 * lineage. Generates `extractedJson` as a backward-compatible projection.
 */

import { db } from "@qubere/db";
import { Prisma } from "@prisma/client";
import { UniversalEvidenceExtractor, type RawExtractionContext } from "./universalEvidenceExtractor";
import { DomainError } from "@/lib/api/error";
import { HydrationLogger } from "../logging/hydrationLogger";

export class EvidenceLedgerService {
  /**
   * Persists extraction output into atomic evidence records (ExtractionField).
   */
  public static async persistEvidenceLedger(ctx: RawExtractionContext, accountId: string) {
    HydrationLogger.info(`Persisting evidence ledger for document ${ctx.documentId}`, { accountId, documentId: ctx.documentId, parseVersionId: ctx.parseVersionId });
    // Defect 4: Tenant ownership check
    const doc = await db.shipmentDocument.findFirst({
      where: { id: ctx.documentId, accountId },
    });

    if (!doc) {
      throw new DomainError(
        `FAIL_CLOSED: Document '${ctx.documentId}' not found for account '${accountId}'.`,
        "FAIL_CLOSED",
        400
      );
    }

    if (doc.activeParseVersionId && doc.activeParseVersionId !== ctx.parseVersionId) {
      throw new DomainError(
        `FAIL_CLOSED: Parse version '${ctx.parseVersionId}' is not the active parse for document '${ctx.documentId}'.`,
        "STALE_PARSE_VERSION",
        409
      );
    }

    const effectiveCtx = { ...ctx, source: ctx.source || "UNIVERSAL_HYDRATION" };
    const items = UniversalEvidenceExtractor.extractAtomicEvidence(effectiveCtx);

    const createdFields = [];

    // Batch insert evidence items
    for (const item of items) {
      const bboxJson = item.bbox
        ? (item.bbox as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull;

      const field = await db.extractionField.create({
        data: {
          documentId: item.documentId,
          fieldName: item.stableKey,
          value: item.rawValue,
          confidence: Math.round(item.confidence),
          pageNumber: item.pageNumber,
          bbox: bboxJson,
          source: item.source,
        },
      });
      createdFields.push(field);
    }

    // Parse promotion owns activeParseVersionId. Hydration only refreshes the
    // compatibility projection for the already-active parse and fails honestly.
    const extractedJsonProjection = this.projectExtractedJson(effectiveCtx);
    await db.shipmentDocument.update({
      where: { id: ctx.documentId },
      data: {
        extractedJson: JSON.stringify(extractedJsonProjection),
      },
    });

    return createdFields;
  }

  /**
   * Projects a backward-compatible `extractedJson` blob from the evidence context.
   */
  public static projectExtractedJson(ctx: RawExtractionContext) {
    const tradeMetadata: Record<string, string> = {
      ...ctx.extractedFields,
      ...ctx.tradeMetadata,
    };

    return {
      version: "1.0",
      extractedAt: new Date().toISOString(),
      tradeMetadata,
      lineItems: ctx.lineItems || [],
      entities: ctx.entities || [],
    };
  }

  /**
   * Retrieves all evidence rows for a given document with tenant isolation check.
   */
  public static async getEvidenceForDocument(documentId: string, accountId: string) {
    const doc = await db.shipmentDocument.findFirst({
      where: { id: documentId, accountId },
    });

    if (!doc) {
      throw new DomainError(
        `FAIL_CLOSED: Document '${documentId}' not found for account '${accountId}'.`,
        "FAIL_CLOSED",
        400
      );
    }

    return db.extractionField.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" },
    });
  }
}
