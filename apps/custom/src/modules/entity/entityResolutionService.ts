import { db } from "@/lib/db";
import { logger } from "@/lib/logging/logger";
import { resolvePartyForCompany } from "@/modules/party/partyResolutionService";

export interface EntityMatchCandidate {
  legalEntityId: string;
  legalName: string;
  matchScore: number; // 0 - 100
  matchReason: string;
  customsProfileId?: string;
  cbpImporterNumber?: string;
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
   * Normalize company names for fuzzy comparison.
   * e.g. "Target USA, Inc." -> "target usa"
   */
  static normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\b(inc|corp|corporation|llc|ltd|limited|co|company|pvt|gmbh|sa|plc)\b\.?/gi, "")
      // Unicode-property classes, not [a-z0-9] -- the ASCII-only version
      // stripped every accented/CJK/Arabic/Cyrillic character (e.g.
      // "Société Générale" -> "socit gnrale"), breaking entity resolution
      // for any non-English company name.
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .trim();
  }

  /**
   * Resolve raw parsed document text or input to existing LegalEntity records.
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

    const normInputName = this.normalizeName(input.rawName);

    // 1. Fetch all candidate LegalEntities for the account
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
      },
    });

    const candidates: EntityMatchCandidate[] = [];

    for (const entity of entities) {
      let score = 0;
      const reasons: string[] = [];

      // A. CBP Importer Number exact match (High confidence: +100)
      const matchingCustomsProfile = entity.customsProfiles.find(
        (cp: any) =>
          input.cbpImporterNumber &&
          cp.cbpImporterNumber &&
          cp.cbpImporterNumber.replace(/[^a-zA-Z0-9]/g, "") ===
            input.cbpImporterNumber.replace(/[^a-zA-Z0-9]/g, "")
      );

      if (matchingCustomsProfile) {
        score += 100;
        reasons.push(`Exact CBP Importer Number match (${matchingCustomsProfile.cbpImporterNumber})`);
      }

      // B. Tax Identifier / EIN match (+90)
      if (
        input.taxIdentifier &&
        entity.taxIdentifier &&
        input.taxIdentifier.replace(/[^0-9]/g, "") === entity.taxIdentifier.replace(/[^0-9]/g, "")
      ) {
        score += 90;
        reasons.push(`Tax ID / EIN match (${entity.taxIdentifier})`);
      }

      // C. Exact Legal Name match (+95)
      if (entity.legalName.toLowerCase().trim() === input.rawName.toLowerCase().trim()) {
        score += 95;
        reasons.push("Exact legal name match");
      } else {
        // D. Normalized Name match (+80)
        const normEntityName = this.normalizeName(entity.legalName);
        if (normEntityName && normInputName && (normEntityName === normInputName || normEntityName.includes(normInputName) || normInputName.includes(normEntityName))) {
          score += 80;
          reasons.push("Normalized company name match");
        }
      }

      const normLegalName = this.normalizeName(entity.legalName);
      let matchScore = 0;
      const matchReasons: string[] = [];

      // Exact normalized name match
      if (normInputName === normLegalName) {
        matchScore = 100;
        matchReasons.push("Exact normalized name match");
      }
      // Substring match
      else if (normInputName.includes(normLegalName) || normLegalName.includes(normInputName)) {
        matchScore = 80;
        matchReasons.push("Partial name match");
      }

      // Tax identifier match bonus
      if (input.taxIdentifier && entity.taxIdentifier === input.taxIdentifier) {
        matchScore = Math.min(100, matchScore + 30);
        matchReasons.push("Tax identifier match");
      }

      // CBP importer number match bonus
      const cbpProfile = entity.customsProfiles.find((cp: any) => cp.cbpImporterNumber === input.cbpImporterNumber);
      if (input.cbpImporterNumber && cbpProfile) {
        matchScore = Math.min(100, matchScore + 40);
        matchReasons.push("CBP Importer number match");
      }

      if (matchScore >= 50) {
        candidates.push({
          legalEntityId: entity.id,
          legalName: entity.legalName,
          matchScore,
          matchReason: matchReasons.join("; "),
          customsProfileId: cbpProfile?.id,
          cbpImporterNumber: cbpProfile?.cbpImporterNumber,
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
    if (!tx) {
      try {
        const resolved = await resolvePartyForCompany(
          { accountId, userId: null, requestId: null },
          { legalName: rawName.trim(), country, taxId: options?.taxIdentifier || null }
        );
        if (resolved.outcome === "CANDIDATES") {
          partyId = null;
          await recordPendingMatchProposal({
            accountId,
            domain: "PARTY",
            matchStatus: resolved.status,
            targetEntityType: "LEGAL_ENTITY",
            inputPayload: { legalName: rawName.trim(), country, taxId: options?.taxIdentifier || null },
            candidatesJson: resolved.candidates as any,
          });
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

    return newEntity;
  }
}
