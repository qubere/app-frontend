/**
 * Universal Evidence Extractor — Document Intelligence Output Flattener
 *
 * Flattens all visible document labels, values, structured tradeMetadata,
 * table cells, and entity discoveries into grounded, atomic evidence items.
 */

import type { BoundingBox } from "../types/canonicalRegistry";

export interface RawExtractionContext {
  documentId: string;
  parseVersionId: string;
  extractedFields?: Record<string, string>;
  tradeMetadata?: Record<string, string>;
  keyValuePairs?: Array<{ label: string; value: string; confidence?: number; page?: number }>;
  lineItems?: Array<Record<string, unknown>>;
  entities?: Array<{ key: string; value: string; confidence?: number; page?: number; bbox?: BoundingBox }>;
  source?: string; // OCR_AI_AGENT | PARSER | HUMAN_CORRECTION
}

export interface AtomicEvidenceItem {
  stableKey: string;
  groupKey?: string;
  rawLabel: string;
  rawValue: string;
  typedValueJson?: unknown;
  documentId: string;
  parseVersionId: string;
  pageNumber: number;
  bbox?: BoundingBox;
  confidence: number;
  source: string;
  status: "OBSERVED" | "SUPERSEDED" | "UNREADABLE" | "HUMAN_CORRECTED";
}

export class UniversalEvidenceExtractor {
  /**
   * Flattens raw extraction context into atomic evidence items with stable keys.
   */
  public static extractAtomicEvidence(ctx: RawExtractionContext): AtomicEvidenceItem[] {
    const items: AtomicEvidenceItem[] = [];
    const source = ctx.source || "OCR_AI_AGENT";

    // 1. Process tradeMetadata / extractedFields
    const metadata = { ...ctx.extractedFields, ...ctx.tradeMetadata };
    for (const [key, value] of Object.entries(metadata)) {
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        items.push({
          stableKey: `tradeMetadata.${key}`,
          rawLabel: key,
          rawValue: String(value),
          typedValueJson: value,
          documentId: ctx.documentId,
          parseVersionId: ctx.parseVersionId,
          pageNumber: 1,
          confidence: 95,
          source,
          status: "OBSERVED",
        });
      }
    }

    // 2. Process free-form Key-Value pairs
    if (ctx.keyValuePairs) {
      for (let i = 0; i < ctx.keyValuePairs.length; i++) {
        const kv = ctx.keyValuePairs[i];
        if (kv.value && kv.value.trim() !== "") {
          items.push({
            stableKey: `kvPair.${kv.label || `kv_${i}`}`,
            rawLabel: kv.label || `Key_${i}`,
            rawValue: kv.value,
            documentId: ctx.documentId,
            parseVersionId: ctx.parseVersionId,
            pageNumber: kv.page || 1,
            confidence: kv.confidence || 90,
            source,
            status: "OBSERVED",
          });
        }
      }
    }

    // 3. Process entities
    if (ctx.entities) {
      for (const ent of ctx.entities) {
        if (ent.value && ent.value.trim() !== "") {
          items.push({
            stableKey: `entity.${ent.key}`,
            rawLabel: ent.key,
            rawValue: ent.value,
            documentId: ctx.documentId,
            parseVersionId: ctx.parseVersionId,
            pageNumber: ent.page || 1,
            bbox: ent.bbox,
            confidence: ent.confidence || 95,
            source,
            status: "OBSERVED",
          });
        }
      }
    }

    // 4. Process line item tables
    if (ctx.lineItems) {
      for (let index = 0; index < ctx.lineItems.length; index++) {
        const line = ctx.lineItems[index];
        const lineNum = Number(line.lineNumber) || index + 1;
        const groupKey = `line_item:${lineNum}`;

        for (const [fieldKey, val] of Object.entries(line)) {
          if (val !== undefined && val !== null && String(val).trim() !== "") {
            items.push({
              stableKey: `lineItem[${lineNum}].${fieldKey}`,
              groupKey,
              rawLabel: fieldKey,
              rawValue: String(val),
              typedValueJson: val,
              documentId: ctx.documentId,
              parseVersionId: ctx.parseVersionId,
              pageNumber: 1,
              confidence: 90,
              source,
              status: "OBSERVED",
            });
          }
        }
      }
    }

    return items;
  }
}
