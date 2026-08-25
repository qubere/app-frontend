/**
 * Evidence Ledger Service — Batch persistence and compatibility projection engine
 *
 * Persists atomic evidence items into the `ExtractionField` table with strict parse version
 * lineage. Generates `extractedJson` as a backward-compatible projection.
 */

import { db } from "@qubere/db";
import type { AtomicEvidenceItem, RawExtractionContext } from "./universalEvidenceExtractor";
import { UniversalEvidenceExtractor } from "./universalEvidenceExtractor";
import { Prisma } from "@prisma/client";

export class EvidenceLedgerService {
  /**
   * Batch persists atomic evidence items into the ExtractionField table.
   * Deduplicates exact observations within one run.
   */
  public static async persistEvidenceLedger(ctx: RawExtractionContext) {
    const items = UniversalEvidenceExtractor.extractAtomicEvidence(ctx);

    const createdFields = [];

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

    // Update ShipmentDocument active parse version & extractedJson compatibility projection
    const extractedJsonProjection = this.projectExtractedJson(ctx);

    await db.shipmentDocument.update({
      where: { id: ctx.documentId },
      data: {
        activeParseVersionId: ctx.parseVersionId,
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
   * Retrieves all evidence rows for a given document.
   */
  public static async getEvidenceForDocument(documentId: string) {
    return db.extractionField.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" },
    });
  }
}
