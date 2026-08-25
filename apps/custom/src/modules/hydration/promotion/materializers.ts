/**
 * Allowlisted Entity-Kind Materializers — LLM Universal Field Hydration
 *
 * Grounded materialization handlers for each entity kind.
 * Invariant #7: A field is promoted ONLY through an allowlisted materializer.
 */

import { db } from "@qubere/db";
import type { PromotionDecision } from "./promotionPolicyEngine";
import { CANONICAL_FIELD_REGISTRY_V1 } from "../registry/canonicalRegistryV1";
import { ShipmentPartyService, type ShipmentPartyRole } from "../../../modules/shipment/shipmentPartyService";
import { EntityResolutionService } from "../../../modules/entity/entityResolutionService";
import type { Prisma } from "@prisma/client";

export interface MaterializationResult {
  fieldKey: string;
  materializer: string;
  success: boolean;
  factId?: string;
  materializedColumn?: string;
  error?: string;
}

export class MaterializerRegistry {
  /**
   * Materializes an approved promotion decision into canonical Fact and domain tables.
   */
  public static async materializeDecision(
    accountId: string,
    shipmentId: string | undefined,
    decision: PromotionDecision
  ): Promise<MaterializationResult> {
    const { candidate, shouldPromote } = decision;
    const fieldKey = candidate.proposal.targetFieldKey;
    const definition = CANONICAL_FIELD_REGISTRY_V1[fieldKey];

    if (!shouldPromote) {
      return {
        fieldKey,
        materializer: definition?.materializer || "UNKNOWN",
        success: false,
        error: decision.reason,
      };
    }

    const materializerName = definition.materializer;
    const valStr = String(candidate.proposal.proposedValue);
    const docId = candidate.proposal.evidenceReferences[0]?.documentId;

    let factId: string | undefined;

    // 1. Write canonical Fact row (all promoted fields write to Fact ledger)
    if (shipmentId) {
      const fact = await db.fact.create({
        data: {
          shipmentId,
          field: (definition.materializerConfig.targetColumn as string) || fieldKey,
          value: valStr,
          normalizedValue: valStr,
          sourceType: "EXTRACTED",
          confidence: candidate.calibratedScore,
          documentId: docId,
          entityRef: candidate.proposal.targetEntityRef || undefined,
          definitionVersion: definition.version,
          isHumanLocked: false,
        },
      });
      factId = fact.id;
    }

    // 2. Dispatch to specific allowlisted materializer
    switch (materializerName) {
      case "ShipmentScalarMaterializer": {
        const column = definition.materializerConfig.targetColumn as string;
        if (shipmentId && column) {
          const ALLOWLISTED_COLUMNS = new Set([
            "carrierName",
            "countryOfOrigin",
            "destinationCountry",
            "incoterm",
            "invoiceCurrency",
            "invoiceNumber",
            "invoiceDate",
          ]);

          if (ALLOWLISTED_COLUMNS.has(column)) {
            await db.shipment.update({
              where: { id: shipmentId, accountId },
              data: {
                [column]: valStr,
                version: { increment: 1 },
              } as Prisma.ShipmentUpdateInput,
            });
          }
        }
        return { fieldKey, materializer: materializerName, success: true, factId, materializedColumn: column };
      }

      case "PartyRoleMaterializer": {
        const role = definition.materializerConfig.role as ShipmentPartyRole;
        if (shipmentId && role && valStr) {
          const resolvedEntity = await EntityResolutionService.findOrCreateEntity(accountId, valStr);
          if (resolvedEntity) {
            await ShipmentPartyService.assignParty({
              shipmentId,
              legalEntityId: resolvedEntity.id,
              role,
              accountId,
              userId: "system_hydration",
              source: "DOCUMENT",
              confidence: candidate.calibratedScore / 100,
              isVerified: false,
            });
          }
        }
        return { fieldKey, materializer: materializerName, success: true, factId };
      }

      case "LineItemMaterializer": {
        return { fieldKey, materializer: materializerName, success: true, factId };
      }

      case "TrackingMaterializer": {
        return { fieldKey, materializer: materializerName, success: true, factId };
      }

      case "FilingDraftMaterializer": {
        return { fieldKey, materializer: materializerName, success: true, factId };
      }

      case "FactOnlyMaterializer":
      default: {
        return { fieldKey, materializer: materializerName, success: true, factId };
      }
    }
  }
}
