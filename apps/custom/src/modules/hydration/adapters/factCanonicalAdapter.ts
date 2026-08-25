/**
 * Fact Canonical Adapter — Read-only compatibility adapter for legacy Fact records
 *
 * Wraps existing database `Fact` records and projects them into canonical field candidates,
 * allowing legacy UI and agent readers to view facts through the new canonical contracts.
 */

import type { Fact } from "@prisma/client";
import type { HydrationCandidate } from "../types/canonicalRegistry";
import { FIELD_INVENTORY } from "../inventory/fieldInventory";
import { RegistrySlicer } from "../registry/registrySlicer";
import { DomainError } from "../../../lib/api/error";

export type FactWithShipment = Fact & { shipment?: { accountId: string } };

export class FactCanonicalAdapter {
  /**
   * Projects a legacy Fact record into a Canonical HydrationCandidate interface.
   * Requires tenant accountId from parameter or fact.shipment.accountId (fails closed).
   */
  public static toCanonicalCandidate(fact: FactWithShipment, accountId?: string): HydrationCandidate {
    const resolvedAccountId = accountId || fact.shipment?.accountId;
    if (!resolvedAccountId) {
      throw new DomainError(
        `FAIL_CLOSED: Cannot adapt Fact '${fact.id}' without valid tenant accountId.`,
        "FAIL_CLOSED",
        400
      );
    }

    // Find canonical key mapping from field inventory
    const inventoryEntry = FIELD_INVENTORY.find(
      (item) =>
        item.factFieldName === fact.field ||
        item.legacyKey === fact.field ||
        item.tradeMetadataKey === fact.field ||
        item.directShipmentColumn === fact.field
    );

    const fieldDefinitionKey = inventoryEntry?.canonicalKey || `unknown.${fact.field}`;
    const isRegistered = RegistrySlicer.isRegisteredKey(fieldDefinitionKey);

    let status: HydrationCandidate["status"] = "PROMOTED";
    if (!isRegistered) {
      status = "UNMAPPED_LEGACY";
    } else if (fact.isHumanLocked) {
      status = "HUMAN_LOCKED";
    }

    return {
      id: `fact_adapter_${fact.id}`,
      hydrationRunId: fact.hydrationRunId || `legacy_run_${fact.shipmentId}`,
      accountId: resolvedAccountId,
      shipmentId: fact.shipmentId,
      documentId: fact.documentId || "legacy_doc",
      fieldDefinitionKey,
      targetEntityRef: fact.entityRef || undefined,
      rawValue: fact.value,
      normalizedValue: fact.normalizedValue || fact.value,
      extractionConfidence: fact.confidence ?? 100,
      mappingConfidence: fact.confidence ?? 100,
      validationScore: 100,
      corroborationScore: 100,
      calibratedDecisionScore: fact.confidence ?? 100,
      status,
      reasonCodes: isRegistered ? ["ADAPTED_FROM_LEGACY_FACT"] : ["UNREGISTERED_LEGACY_FACT_FIELD"],
      sourceExtractionFieldIds: [],
      evidenceReferences: fact.documentId
        ? [
            {
              documentId: fact.documentId,
              parseVersionId: "legacy_pv",
              pageNumber: fact.documentPage || 1,
              rawLabel: fact.field,
              rawValue: fact.value,
              confidence: fact.confidence ?? 100,
            },
          ]
        : [],
      createdAt: fact.createdAt.toISOString(),
    };
  }

  /**
   * Projects a list of Fact records into canonical candidates.
   */
  public static toCanonicalCandidates(facts: FactWithShipment[], accountId?: string): HydrationCandidate[] {
    return facts.map((fact) => this.toCanonicalCandidate(fact, accountId));
  }
}
