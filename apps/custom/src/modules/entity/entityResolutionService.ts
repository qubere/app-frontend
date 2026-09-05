import { db } from "@/lib/db";
import { logger } from "@/lib/logging/logger";
import { resolvePartyForCompany } from "@/modules/party/partyResolutionService";
import { recordPendingMatchProposal } from "@/modules/matching/ambiguousMatchService";
import { normalizeLegalName, normalizeIdentifier } from "@/modules/party/partyNormalization";

export interface EntityMatchCandidate {
  legalEntityId: string;
  legalName: string;
  matchScore: number; // 0 - 100
  matchReason: string;
  customsProfileId?: string;
  cbpImporterNumber?: string;
  partyId?: string | null;
}

export interface EntityResolutionInput {
  accountId: string;
  clientId?: string | null;
  rawName: string;
  taxIdentifier?: string | null;
  cbpImporterNumber?: string | null;
  addressLine1?: string | null;
  country?: string | null;
}

export class EntityResolutionService {
  /**
   * Normalize company names for fuzzy comparison using shared party normalization rules.
   * e.g. "Target USA, Inc." -> "target usa"
   */
  static normalizeName(name: string): string {
    return normalizeLegalName(name);
  }

  /**
   * Resolve raw parsed document text or input to existing LegalEntity records
   * utilizing Party's PartyName.normalizedName and PartyIdentifier infrastructure.
   */
  static async resolveEntity(
    input: EntityResolutionInput,
    tx?: any
  ): Promise<{
    bestMatch: EntityMatchCandidate | null;
    candidates: EntityMatchCandidate[];
  }> {
    const client = tx || db;
    if (!input.rawName || input.rawName.trim().length === 0) {
      return { bestMatch: null, candidates: [] };
    }

    const normInputName = normalizeLegalName(input.rawName);
    const normInputTax = input.taxIdentifier ? normalizeIdentifier(input.taxIdentifier) : null;
    const normInputCbp = input.cbpImporterNumber ? normalizeIdentifier(input.cbpImporterNumber) : null;

    // 1. Fetch candidate LegalEntities with party names and identifiers
    const entities = await client.legalEntity.findMany({
      where: {
        accountId: input.accountId,
        ...(input.clientId ? { clientId: input.clientId } : {}),
        status: "ACTIVE",
      },
      include: {
        customsProfiles: {
          where: { active: true },
        },
        party: {
          include: {
            names: { where: { status: "ACTIVE" } },
            identifiers: { where: { status: "ACTIVE" } },
          },
        },
      },
    });

    const candidates: EntityMatchCandidate[] = [];

    for (const entity of entities) {
      const normLegalName = normalizeLegalName(entity.legalName);
      let matchScore = 0;
      const matchReasons: string[] = [];

      // Check Party names if linked
      const partyNormNames = entity.party?.names?.map((n: any) => n.normalizedName) ?? [];
      const allNormNames = [normLegalName, ...partyNormNames];

      // Exact normalized name match
      if (allNormNames.some((name) => name === normInputName)) {
        matchScore = 100;
        matchReasons.push("Exact Party normalized name match");
      }
      // Substring match
      else if (allNormNames.some((name) => name.includes(normInputName) || normInputName.includes(name))) {
        matchScore = 80;
        matchReasons.push("Partial Party name match");
      }

      // Check Party identifiers if linked
      const partyNormIdentifiers = entity.party?.identifiers?.map((i: any) => normalizeIdentifier(i.normalizedValue || i.value)) ?? [];

      // Tax identifier match bonus
      if (normInputTax) {
        const entityTaxNorm = entity.taxIdentifier ? normalizeIdentifier(entity.taxIdentifier) : null;
        if (entityTaxNorm === normInputTax || partyNormIdentifiers.includes(normInputTax)) {
          matchScore = Math.min(100, matchScore + 30);
          matchReasons.push("Tax identifier / Party identifier match");
        }
      }

      // CBP importer number match bonus
      const cbpProfile = entity.customsProfiles.find((cp: any) => cp.cbpImporterNumber === input.cbpImporterNumber);
      if (normInputCbp) {
        const cbpNorm = cbpProfile ? normalizeIdentifier(cbpProfile.cbpImporterNumber) : null;
        if (cbpNorm === normInputCbp || partyNormIdentifiers.includes(normInputCbp)) {
          matchScore = Math.min(100, matchScore + 40);
          matchReasons.push("CBP Importer number match");
        }
      }

      if (matchScore >= 50) {
        candidates.push({
          legalEntityId: entity.id,
          legalName: entity.legalName,
          matchScore,
          matchReason: matchReasons.join("; "),
          customsProfileId: cbpProfile?.id,
          cbpImporterNumber: cbpProfile?.cbpImporterNumber,
          partyId: entity.partyId,
        });
      }
    }

    candidates.sort((a, b) => b.matchScore - a.matchScore);
    const bestMatch = candidates.length > 0 ? candidates[0] : null;

    return { bestMatch, candidates };
  }

  /**
   * Find existing entity or auto-create a basic LegalEntity if none matches with high confidence.
   */
  static async findOrCreateEntity(
    accountId: string,
    rawName: string,
    options?: {
      clientId?: string | null;
      country?: string;
      taxIdentifier?: string;
      cbpImporterNumber?: string;
    },
    tx?: any
  ) {
    const client = tx || db;
    const resolution = await this.resolveEntity({
      accountId,
      rawName,
      clientId: options?.clientId ?? undefined,
      taxIdentifier: options?.taxIdentifier,
      cbpImporterNumber: options?.cbpImporterNumber,
    }, client);

    if (resolution.bestMatch && resolution.bestMatch.matchScore >= 90) {
      return client.legalEntity.findUnique({
        where: { id: resolution.bestMatch.legalEntityId },
        include: { customsProfiles: true },
      });
    }

    // Resolve/create this entity's Party twin (#320 Phase 1, spec §6.2) --
    // fail-open, and only when this call is not itself nested inside a
    // caller's transaction (`tx` supplied). materializers.ts's
    // PartyRoleMaterializer calls findOrCreateEntity from inside a
    // Serializable-adjacent hydration transaction with its own optimistic
    // concurrency check (Shipment.version) and idempotent Fact writes; party
    // resolution can trigger Restricted Party Screening, and running that
    // extra work on a separate connection inside someone else's transaction
    // would extend its wall-clock duration for no benefit worth that risk.
    // That LegalEntity simply stays unbridged until the backfill script (or
    // a dedicated look at that pipeline) picks it up -- same as it is today.
    const country = options?.country || "US";
    let partyId: string | null = null;
    let pendingCandidates: { matchStatus: string; candidatesJson: unknown[] } | null = null;
    if (!tx) {
      try {
        const resolved = await resolvePartyForCompany(
          { accountId, userId: null, requestId: null },
          { legalName: rawName.trim(), country, taxId: options?.taxIdentifier || null }
        );
        if (resolved.outcome === "CANDIDATES") {
          partyId = null;
          pendingCandidates = { matchStatus: resolved.status, candidatesJson: resolved.candidates as any };
        } else {
          partyId = resolved.partyId;
        }
      } catch (error) {
        logger.warn("entityResolutionService: resolvePartyForCompany failed, creating the entity without a party link", {
          accountId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Create new LegalEntity
    const newEntity = await client.legalEntity.create({
      data: {
        accountId,
        clientId: options?.clientId || null,
        legalName: rawName.trim(),
        country,
        taxIdentifier: options?.taxIdentifier || null,
        status: "ACTIVE",
        partyId,
        ...(options?.cbpImporterNumber
          ? {
              customsProfiles: {
                create: {
                  cbpImporterNumber: options.cbpImporterNumber,
                  active: true,
                },
              },
            }
          : {}),
      },
      include: { customsProfiles: true },
    });

    if (pendingCandidates) {
      try {
        await recordPendingMatchProposal({
          accountId,
          domain: "PARTY",
          matchStatus: pendingCandidates.matchStatus,
          targetEntityType: "LEGAL_ENTITY",
          targetEntityId: newEntity.id,
          inputPayload: { legalName: rawName.trim(), country, taxId: options?.taxIdentifier || null },
          candidatesJson: pendingCandidates.candidatesJson,
        });
      } catch (error) {
        logger.warn("entityResolutionService: recordPendingMatchProposal failed, entity stays unbridged", {
          accountId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return newEntity;
  }
}
