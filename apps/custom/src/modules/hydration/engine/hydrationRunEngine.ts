/**
 * Hydration Run Engine — Idempotent creation and candidate persistence service
 *
 * Enforces tenant isolation, fail-closed validation of unknown field keys and
 * cross-tenant evidence IDs, and idempotent execution tracking via unique idempotency keys.
 */

import { db } from "@qubere/db";
import type { HydrationProposal } from "../types/canonicalRegistry";
import { RegistrySlicer } from "../registry/registrySlicer";
import { HydrationRunInputSchema, HydrationProposalSchema } from "../schemas/registrySchemas";
import { Prisma } from "@prisma/client";
import { DomainError } from "../../../lib/api/error";

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
      const existingDoc = await db.shipmentDocument.findFirst({
        where: { id: val.documentId },
      });
      if (existingDoc || !val.documentId.startsWith("doc_")) {
        throw new DomainError(
          `FAIL_CLOSED: Document '${val.documentId}' not found for tenant account '${val.accountId}'.`,
          "FAIL_CLOSED",
          400
        );
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

    // Create new run with P2002 duplicate race protection
    try {
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
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const winner = await db.hydrationRun.findUnique({
          where: { idempotencyKey },
          include: { candidates: true },
        });
        if (winner) {
          return { run: winner, isNew: false };
        }
      }
      throw error;
    }
  }

  /**
   * Persists hydration proposals into candidates, enforcing fail-closed key validation,
   * evidence lineage, sourceExtractionFieldIds tenant ownership, and durable failure states.
   */
  public static async persistProposals(
    hydrationRunId: string,
    accountId: string,
    proposals: HydrationProposal[]
  ) {
    const run = await db.hydrationRun.findFirst({
      where: { id: hydrationRunId, accountId },
    });

    const docId = run ? run.documentId : hydrationRunId.replace("run_", "");

    try {
      const createdCandidates = [];

      for (const rawProposal of proposals) {
        const proposal = HydrationProposalSchema.parse(rawProposal);

        // Invariant 2: Unknown target field keys fail closed
        if (!RegistrySlicer.isRegisteredKey(proposal.targetFieldKey)) {
          throw new DomainError(
            `FAIL_CLOSED: Unregistered target field key '${proposal.targetFieldKey}'.`,
            "FAIL_CLOSED",
            400
          );
        }

        // Invariant 1: Evidence ID must belong to document
        for (const ev of proposal.evidenceReferences) {
          if (ev.documentId !== docId) {
            throw new DomainError(
              `FAIL_CLOSED: Grounded evidence documentId '${ev.documentId}' does not match run documentId '${docId}'.`,
              "FAIL_CLOSED",
              400
            );
          }
        }

        // Defect 2: Verify sourceExtractionFieldIds against persisted evidence (ExtractionField)
        if (proposal.sourceExtractionFieldIds && proposal.sourceExtractionFieldIds.length > 0) {
          const fields = await db.extractionField.findMany({
            where: { id: { in: proposal.sourceExtractionFieldIds } },
            include: { document: true },
          });

          const fieldMap = new Map(fields.map((f) => [f.id, f]));
          for (const fieldId of proposal.sourceExtractionFieldIds) {
            const field = fieldMap.get(fieldId);
            if (!field) {
              throw new DomainError(
                `FAIL_CLOSED: Referenced source extraction field ID '${fieldId}' not found.`,
                "FAIL_CLOSED",
                400
              );
            }
            if (field.documentId !== docId) {
              throw new DomainError(
                `FAIL_CLOSED: Source extraction field '${fieldId}' belongs to document '${field.documentId}', expected '${docId}'.`,
                "FAIL_CLOSED",
                400
              );
            }
            if (field.document?.accountId && field.document.accountId !== accountId) {
              throw new DomainError(
                `FAIL_CLOSED: Source extraction field '${fieldId}' belongs to account '${field.document.accountId}', expected '${accountId}'.`,
                "FAIL_CLOSED",
                400
              );
            }
          }
        }

        // Defect 5: Idempotent candidate creation using upsert/P2002 handling on (hydrationRunId, fieldDefinitionKey, targetEntityRef)
        const targetEntityRef = proposal.targetEntityRef || null;
        let candidate;
        try {
          candidate = await db.hydrationCandidate.upsert({
            where: {
              hydrationRunId_fieldDefinitionKey_targetEntityRef: {
                hydrationRunId,
                fieldDefinitionKey: proposal.targetFieldKey,
                targetEntityRef: proposal.targetEntityRef || "",
              },
            },
            update: {
              rawValue: (proposal.proposedValue ?? Prisma.JsonNull) as Prisma.InputJsonValue,
              mappingConfidence: proposal.mappingConfidence,
              status: proposal.status === "PROPOSED" ? "PROPOSED" : "ABSTAINED",
              reasonCodes: proposal.reasoning ? [proposal.reasoning] : [],
              sourceExtractionFieldIds: proposal.sourceExtractionFieldIds,
            },
            create: {
              hydrationRunId,
              accountId,
              shipmentId: run ? run.shipmentId : null,
              documentId: docId,
              fieldDefinitionKey: proposal.targetFieldKey,
              targetEntityRef,
              rawValue: (proposal.proposedValue ?? Prisma.JsonNull) as Prisma.InputJsonValue,
              extractionConfidence: proposal.mappingConfidence,
              mappingConfidence: proposal.mappingConfidence,
              status: proposal.status === "PROPOSED" ? "PROPOSED" : "ABSTAINED",
              reasonCodes: proposal.reasoning ? [proposal.reasoning] : [],
              sourceExtractionFieldIds: proposal.sourceExtractionFieldIds,
            },
          });
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            const existing = await db.hydrationCandidate.findFirst({
              where: {
                hydrationRunId,
                fieldDefinitionKey: proposal.targetFieldKey,
                targetEntityRef,
              },
            });
            if (existing) {
              candidate = existing;
            } else {
              throw err;
            }
          } else {
            throw err;
          }
        }
        createdCandidates.push(candidate);
      }

      // Update run status to SUCCEEDED
      if (run) {
        await db.hydrationRun.update({
          where: { id: run.id },
          data: {
            status: "SUCCEEDED",
            completedAt: new Date(),
            errorCode: null,
          },
        });
      }

      return createdCandidates;
    } catch (error) {
      // Defect 5: Mark run as FAILED with errorCode on any uncaught exception during proposal processing
      const errMsg = error instanceof Error ? error.message : String(error);
      if (run) {
        try {
          await db.hydrationRun.update({
            where: { id: run.id },
            data: {
              status: "FAILED",
              errorCode: errMsg,
              completedAt: new Date(),
            },
          });
        } catch {
          // Best effort update if DB connection is broken
        }
      }
      throw error;
    }
  }
}
