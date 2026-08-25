/**
 * Hydration Run Engine — Idempotent creation and candidate persistence service
 *
 * Enforces tenant isolation, fail-closed validation of unknown field keys and
 * cross-tenant evidence IDs, and idempotent execution tracking via unique idempotency keys.
 */

import { db } from "@qubere/db";
import type { HydrationProposal, GroundedEvidenceReference } from "../types/canonicalRegistry";
import { RegistrySlicer } from "../registry/registrySlicer";
import { HydrationRunInputSchema, HydrationProposalSchema } from "../schemas/registrySchemas";
import { Prisma } from "@prisma/client";

export interface CreateHydrationRunParams {
  accountId: string;
  shipmentId?: string;
  documentId: string;
  activeParseVersionId: string;
  fieldSchemaVersion?: string;
  extractionSchemaVersion?: string;
  mapperModelVersion: string;
  mapperPromptVersion: string;
  normalizationPolicyVersion?: string;
}

export class HydrationRunEngine {
  /**
   * Generates a deterministic idempotency key for a hydration run.
   */
  public static generateIdempotencyKey(params: CreateHydrationRunParams): string {
    const fieldVer = params.fieldSchemaVersion || "1.0.0";
    const normVer = params.normalizationPolicyVersion || "1.0.0";
    return `${params.accountId}:${params.documentId}:${params.activeParseVersionId}:${fieldVer}:${params.mapperPromptVersion}:${params.mapperModelVersion}:${normVer}`;
  }

  /**
   * Creates or retrieves an existing HydrationRun using its idempotency key.
   * Verifies tenant isolation on the document and shipment (fails closed).
   */
  public static async createOrGetRun(params: CreateHydrationRunParams) {
    const val = HydrationRunInputSchema.parse(params);
    const idempotencyKey = this.generateIdempotencyKey(params);

    // Verify document belongs to accountId
    const document = await db.shipmentDocument.findFirst({
      where: { id: val.documentId, accountId: val.accountId },
    });

    if (!document) {
      throw new Error(`FAIL_CLOSED: Document '${val.documentId}' not found for tenant account '${val.accountId}'.`);
    }

    // If shipmentId provided, verify shipment belongs to accountId
    if (val.shipmentId) {
      const shipment = await db.shipment.findFirst({
        where: { id: val.shipmentId, accountId: val.accountId },
      });
      if (!shipment) {
        throw new Error(`FAIL_CLOSED: Shipment '${val.shipmentId}' not found for tenant account '${val.accountId}'.`);
      }
    }

    // Check for existing run (Idempotency)
    const existing = await db.hydrationRun.findUnique({
      where: { idempotencyKey },
      include: { candidates: true },
    });

    if (existing) {
      return { run: existing, isNew: false };
    }

    // Create new run
    const run = await db.hydrationRun.create({
      data: {
        accountId: val.accountId,
        shipmentId: val.shipmentId || null,
        documentId: val.documentId,
        activeParseVersionId: val.activeParseVersionId,
        fieldSchemaVersion: val.fieldSchemaVersion || "1.0.0",
        extractionSchemaVersion: val.extractionSchemaVersion || "1.0.0",
        mapperModelVersion: val.mapperModelVersion,
        mapperPromptVersion: val.mapperPromptVersion,
        normalizationPolicyVersion: val.normalizationPolicyVersion || "1.0.0",
        idempotencyKey,
        status: "RUNNING",
      },
      include: { candidates: true },
    });

    return { run, isNew: true };
  }

  /**
   * Persists hydration proposals into candidates, enforcing fail-closed key validation
   * and evidence lineage.
   */
  public static async persistProposals(
    hydrationRunId: string,
    accountId: string,
    proposals: HydrationProposal[]
  ) {
    const run = await db.hydrationRun.findFirst({
      where: { id: hydrationRunId, accountId },
    });

    if (!run) {
      throw new Error(`FAIL_CLOSED: Hydration run '${hydrationRunId}' not found for tenant '${accountId}'.`);
    }

    const createdCandidates = [];

    for (const rawProposal of proposals) {
      const proposal = HydrationProposalSchema.parse(rawProposal);

      // Invariant 2: Unknown target field keys fail closed
      if (!RegistrySlicer.isRegisteredKey(proposal.targetFieldKey)) {
        throw new Error(`FAIL_CLOSED: Unregistered target field key '${proposal.targetFieldKey}'.`);
      }

      // Invariant 1: Evidence ID must belong to document
      for (const ev of proposal.evidenceReferences) {
        if (ev.documentId !== run.documentId) {
          throw new Error(
            `FAIL_CLOSED: Grounded evidence documentId '${ev.documentId}' does not match run documentId '${run.documentId}'.`
          );
        }
      }

      const candidate = await db.hydrationCandidate.create({
        data: {
          hydrationRunId: run.id,
          accountId,
          shipmentId: run.shipmentId,
          documentId: run.documentId,
          fieldDefinitionKey: proposal.targetFieldKey,
          targetEntityRef: proposal.targetEntityRef,
          rawValue: (proposal.proposedValue ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          extractionConfidence: proposal.mappingConfidence,
          mappingConfidence: proposal.mappingConfidence,
          status: proposal.status === "PROPOSED" ? "PROPOSED" : "ABSTAINED",
          reasonCodes: proposal.reasoning ? [proposal.reasoning] : [],
          sourceExtractionFieldIds: proposal.sourceExtractionFieldIds,
        },
      });

      createdCandidates.push(candidate);
    }

    // Update run status
    await db.hydrationRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        completedAt: new Date(),
      },
    });

    return createdCandidates;
  }
}
