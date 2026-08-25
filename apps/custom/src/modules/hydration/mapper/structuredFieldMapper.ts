/**
 * Structured Field Mapper — Grounded Semantic Candidate Generator
 *
 * Maps atomic evidence items to canonical field keys present in the active field registry.
 * Enforces Invariant #1 (cites persisted evidence IDs) and Invariant #2 (target keys must
 * exist in active field registry).
 */

import type { AtomicEvidenceItem } from "../evidence/universalEvidenceExtractor";
import type { HydrationProposal } from "../types/canonicalRegistry";
import { RegistrySlicer } from "../registry/registrySlicer";
import { FIELD_INVENTORY } from "../inventory/fieldInventory";
import { normalizeValue } from "../validation/normalizerRegistry";
import { validateValue } from "../validation/validators";
import { calculateCalibratedScore } from "../validation/calibratedScoreCalculator";

export interface MapEvidenceOptions {
  documentType?: string;
  product?: "CUSTOMS" | "TMS";
  jurisdiction?: string;
}

export class StructuredFieldMapper {
  /**
   * Generates grounded hydration proposals from atomic evidence items.
   */
  public static mapEvidenceToProposals(
    items: AtomicEvidenceItem[],
    options: MapEvidenceOptions = {}
  ): HydrationProposal[] {
    const registrySlice = RegistrySlicer.getSlice({
      documentType: options.documentType,
      product: options.product,
      jurisdiction: options.jurisdiction,
    });

    const proposals: HydrationProposal[] = [];

    for (const [canonicalKey, definition] of Object.entries(registrySlice)) {
      // Find matching inventory mapping
      const inventoryEntry = FIELD_INVENTORY.find((i) => i.canonicalKey === canonicalKey);
      const possibleKeys = [
        canonicalKey,
        inventoryEntry?.tradeMetadataKey,
        inventoryEntry?.legacyKey,
        inventoryEntry?.factFieldName,
        inventoryEntry?.directShipmentColumn,
        canonicalKey.replace("lineItem[].", ""),
      ].filter(Boolean) as string[];

      // Match evidence items
      const matchingItems = items.filter((item) =>
        possibleKeys.some(
          (k) =>
            item.stableKey === `tradeMetadata.${k}` ||
            item.stableKey === k ||
            item.rawLabel === k ||
            item.stableKey.endsWith(`.${k}`) ||
            (canonicalKey.startsWith("lineItem[]") && item.stableKey.includes(k))
        )
      );

      if (matchingItems.length === 0) {
        continue;
      }

      // Group matching items by entity reference (for line items or scalar)
      const groupedByEntity = new Map<string | null, AtomicEvidenceItem[]>();
      for (const item of matchingItems) {
        const entityRef = item.groupKey || null;
        const group = groupedByEntity.get(entityRef) || [];
        group.push(item);
        groupedByEntity.set(entityRef, group);
      }

      for (const [entityRef, evItems] of groupedByEntity.entries()) {
        const primaryEv = evItems[0];
        const rawVal = primaryEv.rawValue;

        // D3 check: Cardinality validation
        const isCardinalityViolation = definition.cardinality === "ONE" && groupedByEntity.size > 1;

        // D4 check: Calculate mapping confidence based on match quality
        let mappingConfidence = 65; // Substring / fuzzy match fallback
        if (primaryEv.stableKey === canonicalKey || primaryEv.stableKey === `tradeMetadata.${canonicalKey}`) {
          mappingConfidence = 95; // Exact key match
        } else if (possibleKeys.includes(primaryEv.rawLabel)) {
          mappingConfidence = 80; // Grounded label match
        }

        // Apply normalizer
        const normalizedVal = normalizeValue(definition.normalizer, rawVal);

        // Apply validators
        const validationResult = validateValue(definition.validators, normalizedVal);

        const isValid = validationResult.isValid && !isCardinalityViolation && normalizedVal !== null;

        // Calculate calibrated score
        const valScore = isValid ? 100 : 0;
        const _calibratedScore = calculateCalibratedScore({
          extractionConfidence: primaryEv.confidence,
          mappingConfidence,
          validationScore: valScore,
          corroborationScore: 0,
        });

        proposals.push({
          targetFieldKey: canonicalKey,
          targetEntityRef: entityRef,
          sourceExtractionFieldIds: evItems.map((i) => i.stableKey),
          evidenceReferences: evItems.map((i) => ({
            documentId: i.documentId,
            parseVersionId: i.parseVersionId,
            pageNumber: i.pageNumber,
            bbox: i.bbox,
            rawLabel: i.rawLabel,
            rawValue: i.rawValue,
            confidence: i.confidence,
          })),
          proposedValue: normalizedVal,
          mappingConfidence,
          relationConfidence: entityRef ? 90 : null,
          reasoning: isValid
            ? `Mapped from grounded evidence label '${primaryEv.rawLabel}'.`
            : isCardinalityViolation
            ? `Cardinality violation: Multiple entity references proposed for single-cardinality field '${canonicalKey}'.`
            : `Validation failed: ${validationResult.failedValidator}`,
          status: isValid ? "PROPOSED" : "ABSTAINED",
          abstainReason: isValid
            ? null
            : isCardinalityViolation
            ? `Cardinality violation for ONE-cardinality field '${canonicalKey}'.`
            : `Failed validator: ${validationResult.failedValidator}`,
        });
      }
    }

    return proposals;
  }
}
