import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { parseAndValidateBody } from "@/lib/api/validation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";
import { ensurePartyRole, resolvePartyForCompany } from "@/modules/party/partyResolutionService";
import { recordPendingMatchProposal } from "@/modules/matching/ambiguousMatchService";

const entitySchema = z.object({
  importerNumberType: z.enum(["EIN", "SSN", "CBP_ASSIGNED"]),
  importerNumber: z.string().nullable().optional(),
  legalName: z.string().min(1),
  tradeName: z.string().nullable().optional(),
  entityType: z.string(),
  addressLine1: z.string(),
  city: z.string(),
  stateProvince: z.string().optional(),
  postalCode: z.string(),
  country: z.string().default("US"),
  residentAgent: z.object({ name: z.string(), address: z.string().optional() }).nullable().optional(),
});

/**
 * Resolves (or creates) the `Party` this new entity's legal identity bridges
 * to (#320 Phase 1), the same way importerCreate.service.ts does for
 * `POST /api/importers`. Never blocks entity creation -- `LegalEntity.partyId`
 * stays nullable, and a resolution failure or an uncertain (POSSIBLE_MATCH /
 * AMBIGUOUS) match just leaves this entity unbridged, exactly today's
 * behavior, until a person confirms the match (Phase 2) or the backfill
 * script picks it up.
 */
interface ResolvedEntityParty {
  partyId: string | null;
  pendingCandidates: { matchStatus: string; candidatesJson: unknown[]; inputPayload: Record<string, unknown> } | null;
}

async function resolveNewEntityParty(
  accountId: string,
  userId: string,
  requestId: string | undefined,
  data: z.infer<typeof entitySchema>
): Promise<ResolvedEntityParty> {
  try {
    const taxId = data.importerNumberType === "CBP_ASSIGNED" ? null : (data.importerNumber?.trim() || null);
    const resolved = await resolvePartyForCompany(
      { accountId, userId, requestId: requestId ?? null },
      {
        legalName: data.legalName,
        country: data.country,
        taxId,
        address: {
          addressLine1: data.addressLine1,
          city: data.city,
          stateProvince: data.stateProvince ?? null,
          postalCode: data.postalCode,
          country: data.country,
        },
      }
    );
    if (resolved.outcome === "CANDIDATES") {
      return {
        partyId: null,
        pendingCandidates: {
          matchStatus: resolved.status,
          candidatesJson: resolved.candidates as any,
          inputPayload: { legalName: data.legalName, country: data.country, taxId },
        },
      };
    }
    return { partyId: resolved.partyId, pendingCandidates: null };
  } catch (error) {
    logger.warn("onboarding entities: resolvePartyForCompany failed, creating the entity without a party link", {
      accountId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { partyId: null, pendingCandidates: null };
  }
}

export const POST = withAuthenticatedRoute(
  async ({ req, params, ctx, requestId }) => {
    const caseId = params.caseId as string;
    const existingCase = await db.onboardingCase.findUnique({ where: { id: caseId }, select: { accountId: true, status: true, clientId: true } });
    if (!existingCase || existingCase.accountId !== ctx.accountId) {
      return buildErrorResponse(404, "NOT_FOUND", "Case not found", undefined, requestId);
    }
    if (existingCase.status === "active" || existingCase.status === "withdrawn") {
      return buildErrorResponse(409, "CONFLICT", "Cannot add entities to an activated or withdrawn case", undefined, requestId);
    }

    const bodyVal = await parseAndValidateBody(req, entitySchema, requestId);
    if ("response" in bodyVal) return bodyVal.response;
    const data = bodyVal.data;

    // Duplicate check by EIN within the account
    if (data.importerNumber && data.importerNumberType === "EIN") {
      const dup = await db.importerOfRecord.findFirst({
        where: { accountId: ctx.accountId, irsEin: data.importerNumber },
      });
      if (dup) {
        return buildErrorResponse(409, "CONFLICT", `An importer with EIN ${data.importerNumber} already exists in this account`, undefined, requestId);
      }
    }

    // Outside the transaction: party resolution can trigger Restricted Party
    // Screening, and nothing here should hold the transaction's locks open.
    const { partyId, pendingCandidates } = await resolveNewEntityParty(ctx.accountId, ctx.userId, requestId, data);
    // Adding this entity to a case is a deliberate importer registration, so
    // ensure the IMPORTER role on whatever party it resolved to -- fail-open,
    // same as ensurePartyRole always is.
    if (partyId) {
      await ensurePartyRole({ accountId: ctx.accountId, userId: ctx.userId, requestId: requestId ?? null }, partyId, "IMPORTER");
    }

    try {
      const result = await db.$transaction(async (tx) => {
        // Create the LegalEntity
        const legalEntity = await tx.legalEntity.create({
          data: {
            accountId: ctx.accountId,
            legalName: data.legalName,
            tradeName: data.tradeName ?? undefined,
            entityType: data.entityType,
            addressLine1: data.addressLine1,
            city: data.city,
            stateProvince: data.stateProvince ?? undefined,
            postalCode: data.postalCode,
            country: data.country,
            taxIdentifier: data.importerNumber ?? undefined,
            taxIdentifierType: data.importerNumberType,
            partyId,
            updatedAt: new Date(),
          },
        });

        // Create ImporterOfRecord
        const ior = await tx.importerOfRecord.create({
          data: {
            accountId: ctx.accountId,
            clientId: existingCase.clientId,
            legalEntityId: legalEntity.id,
            name: data.legalName,
            irsEin: data.importerNumber ?? "",
            cbpImporterNumber: data.importerNumberType === "CBP_ASSIGNED" ? null : (data.importerNumber ?? null),
            registrationStatus: "pending_5106",
            address: {
              line1: data.addressLine1,
              city: data.city,
              state: data.stateProvince ?? "",
              postalCode: data.postalCode,
              country: data.country,
            },
            updatedAt: new Date(),
          },
        });

        // Create OnboardingEntity
        const entity = await tx.onboardingEntity.create({
          data: {
            accountId: ctx.accountId,
            caseId,
            legalEntityId: legalEntity.id,
            importerOfRecordId: ior.id,
            importerNumberType: data.importerNumberType,
            importerNumber: data.importerNumber ?? null,
            residentAgent: data.residentAgent ?? undefined,
            officers: [],
            updatedAt: new Date(),
          },
        });

        // Update case to link primary importer if first entity
        const entityCount = await tx.onboardingEntity.count({ where: { caseId } });
        if (entityCount <= 1) {
          await tx.onboardingCase.update({
            where: { id: caseId },
            data: {
              primaryImporterId: ior.id,
              status: "in_progress",
              currentStep: 2,
              updatedAt: new Date(),
            },
          });
        }

        await tx.onboardingEvent.create({
          data: {
            accountId: ctx.accountId,
            caseId,
            type: "STEP_COMPLETED",
            step: 1,
            actorUserId: ctx.userId,
            actorType: "USER",
            detail: { entityId: entity.id, legalName: data.legalName },
            createdAt: new Date(),
          },
        });

        return { entity, legalEntity, ior };
      });

      if (pendingCandidates) {
        try {
          await recordPendingMatchProposal({
            accountId: ctx.accountId,
            domain: "PARTY",
            matchStatus: pendingCandidates.matchStatus,
            targetEntityType: "LEGAL_ENTITY",
            targetEntityId: result.legalEntity.id,
            inputPayload: pendingCandidates.inputPayload,
            candidatesJson: pendingCandidates.candidatesJson,
          });
        } catch (error) {
          logger.warn("onboarding entities: recordPendingMatchProposal failed, entity stays unbridged", {
            accountId: ctx.accountId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      await createAuditLog({
        accountId: ctx.accountId,
        userId: ctx.userId,
        action: "ONBOARDING_ENTITY_ADDED",
        entity: "OnboardingEntity",
        entityId: result.entity.id,
        source: "UI",
        metadata: { caseId, legalName: data.legalName },
      });

      return NextResponse.json({ entity: result.entity, requestId }, { status: 201 });
    } catch (error) {
      return buildErrorResponse(400, "BUSINESS_RULE_FAILURE", errorMessage(error) || "Failed to save entity", undefined, requestId);
    }
  },
  { permission: "onboarding.manage", write: true }
);
