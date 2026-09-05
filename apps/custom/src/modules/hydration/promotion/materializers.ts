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
import { LineItemReconciler, type LineItemDiscovery } from "../../../modules/shipment/lineItemReconciler";
import type { Prisma } from "@prisma/client";

import { HydrationLogger } from "../logging/hydrationLogger";

export interface MaterializationResult {
  fieldKey: string;
  materializer: string;
  success: boolean;
  factId?: string;
  materializedColumn?: string;
  materialized?: boolean;
  reason?: string;
  error?: string;
}

export interface MaterializeOptions {
  mode?: "shadow" | "live";
  expectedVersion?: number;
}

export class MaterializationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "MaterializationError";
  }
}

/**
 * Extracts the line number from a targetEntityRef. Producers disagree on the
 * prefix -- live extraction (universalEvidenceExtractor.ts) emits "line_item:N",
 * while LineItemReconciler's own Fact entityRef convention and the eval corpus
 * fixtures use "line:N" -- so match on the trailing digits, not a fixed prefix.
 * Returns null (never guesses line 1) when absent/unparseable.
 */
function parseLineNumber(ref: string | null | undefined): number | null {
  const match = /:(\d+)$/.exec(ref ?? "");
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const LINE_ITEM_NUMERIC_COLUMNS = new Set(["quantity", "unitPrice"]);

/** Converts a materialized scalar value to the type LineItemDiscovery expects for the given column. */
function parseLineItemValue(column: string, valStr: string): string | number {
  return LINE_ITEM_NUMERIC_COLUMNS.has(column) ? Number(valStr) : valStr;
}

export class MaterializerRegistry {
  /**
   * Materializes an approved promotion decision into canonical Fact and domain tables.
   * Transactional, idempotent, and mode-gated.
   */
  public static async materializeDecision(
    accountId: string,
    shipmentId: string | undefined,
    decision: PromotionDecision,
    options: MaterializeOptions = {}
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

    // E1 check: Safe non-mutating shadow mode gate
    if (options.mode === "shadow") {
      return {
        fieldKey,
        materializer: materializerName,
        success: true,
        materializedColumn: definition.materializerConfig.targetColumn as string,
        materialized: false,
        reason: "SHADOW_MODE_DRY_RUN",
      };
    }

    if (!shipmentId) {
      throw new MaterializationError(
        "SHIPMENT_REQUIRED",
        `Live materialization for '${fieldKey}' requires a tenant-owned shipment.`
      );
    }

    const factField = (definition.materializerConfig.targetColumn as string) || fieldKey;
    const realCandidateId = candidate.candidateId || candidate.proposal.targetFieldKey;

    // Execute materializer operations inside an atomic transaction (C3 check)
    return await db.$transaction(async (tx) => {
      let factId: string | undefined;

      // 1. Write canonical Fact row with real candidate identity idempotency check (C1 check)
      if (shipmentId) {
        const existingFact = await tx.fact.findFirst({
          where: {
            shipmentId,
            field: factField,
            candidateId: realCandidateId,
          },
        });

        if (existingFact) {
          factId = existingFact.id;
        } else {
          const fact = await tx.fact.create({
            data: {
              shipmentId,
              field: factField,
              value: valStr,
              normalizedValue: valStr,
              sourceType: "EXTRACTED",
              confidence: candidate.calibratedScore,
              documentId: docId,
              entityRef: candidate.proposal.targetEntityRef || undefined,
              definitionVersion: definition.version,
              candidateId: realCandidateId,
              isHumanLocked: false,
            },
          });
          factId = fact.id;
        }
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
              "portOfEntry",
              "countryOfExport",
              "ladingDate",
              "estimatedArrival",
              "lastFreeDay",
            ]);

            if (ALLOWLISTED_COLUMNS.has(column)) {
              if (typeof options.expectedVersion !== "number") {
                HydrationLogger.warn("Missing expectedVersion for ShipmentScalarMaterializer", { shipmentId, fieldKey });
                throw new MaterializationError(
                  "MISSING_EXPECTED_VERSION",
                  `Shipment version is required to materialize '${fieldKey}'.`
                );
              }

              // C2 check: Atomic optimistic concurrency check
              const updated = await tx.shipment.update({
                where: { id: shipmentId, accountId, version: options.expectedVersion },
                data: {
                  [column]: valStr,
                  version: { increment: 1 },
                } as Prisma.ShipmentUpdateInput,
              }).catch((err) => {
                if ((err as any)?.code === "P2025") return null;
                throw err;
              });

              if (!updated) {
                HydrationLogger.warn("Stale shipment version on materialization", { shipmentId, fieldKey, expectedVersion: options.expectedVersion });
                throw new MaterializationError(
                  "STALE_SHIPMENT_VERSION",
                  `Shipment '${shipmentId}' changed before '${fieldKey}' could be materialized.`
                );
              }
            }
          }
          return {
            fieldKey,
            materializer: materializerName,
            success: true,
            factId,
            materializedColumn: column,
            materialized: true,
          };
        }

        case "PartyRoleMaterializer": {
          const role = definition.materializerConfig.role as ShipmentPartyRole;
          if (shipmentId && role && valStr) {
            const resolvedEntity = await EntityResolutionService.findOrCreateEntity(accountId, valStr, undefined, tx);
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
              }, tx);
            } else {
              throw new MaterializationError(
                "ENTITY_RESOLUTION_FAILED",
                `No legal entity could be resolved for '${fieldKey}'.`
              );
            }
          }
          return { fieldKey, materializer: materializerName, success: true, factId, materialized: true };
        }

        case "LineItemMaterializer": {
          const column = definition.materializerConfig.column as string | undefined;
          const lineNumber = parseLineNumber(candidate.proposal.targetEntityRef);
          if (shipmentId && column && lineNumber) {
            try {
              await LineItemReconciler.applyDiscoveries({
                shipmentId,
                accountId,
                documentId: docId || "hydration",
                sourceType: "EXTRACTED",
                items: [{ lineNumber, [column]: parseLineItemValue(column, valStr) } as LineItemDiscovery],
              }, tx);
            } catch (err) {
              HydrationLogger.error("LineItemMaterializer failed during applyDiscoveries", err, { shipmentId, accountId, fieldKey });
              throw err;
            }
          }
          return {
            fieldKey,
            materializer: materializerName,
            success: true,
            factId,
            materialized: !!(shipmentId && column && lineNumber),
            reason: column && lineNumber ? undefined : "NO_TYPED_PROJECTION",
          };
        }

        case "TrackingMaterializer":
        case "FilingDraftMaterializer": {
          // C8 check: Honest reporting for unhandled typed projections
          return {
            fieldKey,
            materializer: materializerName,
            success: true,
            factId,
            materialized: false,
            reason: "NO_TYPED_PROJECTION",
          };
        }

        case "FactOnlyMaterializer":
        default: {
          return { fieldKey, materializer: materializerName, success: true, factId, materialized: true };
        }
      }
    });
  }
}
