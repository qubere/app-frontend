import { db } from "@qubere/db";
import type { AccountContext } from "@qubere/auth";
import { findPartyMatches } from "@qubere/party";

export interface CreateCarrierProfileInput {
  partyId?: string;
  legalName?: string;
  /** Paired with legalName for the shared Party name+country matching rule. */
  country?: string | null;
  scac?: string | null;
  dot?: string | null;
  mc?: string | null;
  modes?: string[];
  equipmentCapabilities?: string[];
  insuranceStatus?: "ACTIVE" | "EXPIRED" | "PENDING";
  safetyStatus?: "SATISFACTORY" | "CONDITIONAL" | "UNSATISFACTORY";
  approvedStatus?: "APPROVED" | "PENDING" | "REJECTED";
  preferredStatus?: boolean;
  serviceAreas?: Record<string, unknown>;
  trackingCapabilities?: Record<string, unknown>;
}

export async function createCarrierProfile(
  ctx: AccountContext,
  input: CreateCarrierProfileInput
) {
  if (!input.partyId && !input.legalName?.trim()) {
    throw new Error("Carrier legal name is required when no existing party is supplied.");
  }
  let partyId = input.partyId;

  if (!partyId && input.legalName?.trim()) {
    // Same dedup rule apps/custom's party-resolution callers use: only an
    // EXACT_MATCH (an identifier or registration number, never name alone)
    // is safe to auto-reuse. A POSSIBLE_MATCH/AMBIGUOUS result falls through
    // to creating a new party below, same as before this check existed.
    try {
      const match = await findPartyMatches(
        { accountId: ctx.accountId },
        { legalName: input.legalName, country: input.country ?? null }
      );
      if (match.status === "EXACT_MATCH") {
        partyId = match.candidates[0]!.partyId;
      }
    } catch {
      // fail-open: a matching error should not block carrier onboarding
    }
  }

  if (!partyId && (db as any).party) {
    const party = await (db as any).party.create({
      data: {
        accountId: ctx.accountId,
        partyKind: "ORGANIZATION",
        status: "ACTIVE",
        reviewStatus: "APPROVED",
        names: {
          create: {
            accountId: ctx.accountId,
            rawName: input.legalName!,
            normalizedName: input.legalName!.toUpperCase(),
            nameType: "LEGAL",
            isPrimary: true,
          },
        },
        roles: {
          create: {
            accountId: ctx.accountId,
            roleType: "CARRIER",
          },
        },
      },
    });
    partyId = party.id;
  }

  const profile = await db.carrierProfile.create({
    data: {
      accountId: ctx.accountId,
      partyId: partyId!,
      scac: input.scac ?? null,
      dot: input.dot ?? null,
      mc: input.mc ?? null,
      modes: input.modes ? (input.modes as any) : undefined,
      equipmentCapabilities: input.equipmentCapabilities ? (input.equipmentCapabilities as any) : undefined,
      insuranceStatus: input.insuranceStatus ?? "PENDING",
      safetyStatus: input.safetyStatus ?? null,
      approvedStatus: input.approvedStatus ?? "PENDING",
      preferredStatus: input.preferredStatus ?? false,
      serviceAreas: input.serviceAreas ? (input.serviceAreas as any) : undefined,
      trackingCapabilities: input.trackingCapabilities ? (input.trackingCapabilities as any) : undefined,
    },
    include: {
      party: {
        include: {
          names: true,
          roles: true,
        },
      },
    },
  });

  // Tender has a real FK to Carrier, while domain qualification lives on the
  // Party/CarrierProfile aggregate. Keep an execution identity synchronized so
  // recommendations never pass a Party id into Tender.carrierId.
  const executionLegalName =
    input.legalName?.trim() ||
    profile.party?.names?.find((name) => name.isPrimary)?.rawName ||
    profile.party?.names?.[0]?.rawName;
  if (executionLegalName) {
    const existingCarrier = await db.carrier.findFirst({
      where: {
        accountId: ctx.accountId,
        OR: [
          ...(input.scac ? [{ scac: input.scac }] : []),
          ...(input.dot ? [{ dotNumber: input.dot }] : []),
          ...(input.mc ? [{ mcNumber: input.mc }] : []),
          { legalName: executionLegalName },
        ],
      },
    });
    if (!existingCarrier) {
      await db.carrier.create({
        data: {
          accountId: ctx.accountId,
          legalName: executionLegalName,
          scac: input.scac ?? null,
          dotNumber: input.dot ?? null,
          mcNumber: input.mc ?? null,
          insuranceOnFile: input.insuranceStatus === "ACTIVE",
          status: input.approvedStatus === "APPROVED" ? "ACTIVE" : "INACTIVE",
        },
      });
    }
  }

  return profile;
}

export async function getCarrierProfileByPartyId(ctx: AccountContext, partyId: string) {
  const model = (db as any).carrierProfile ?? (db as any).carrier;
  if (!model) return null;
  return model.findFirst({
    where: {
      accountId: ctx.accountId,
      partyId,
    },
    include: {
      party: {
        include: {
          names: true,
          roles: true,
        },
      },
    },
  });
}

export async function listCarrierProfiles(ctx: AccountContext) {
  const model = (db as any).carrierProfile ?? (db as any).carrier;
  if (!model) return [];
  return model.findMany({
    where: {
      accountId: ctx.accountId,
    },
    include: {
      party: {
        include: {
          names: true,
          roles: true,
        },
      },
    },
  });
}

export const createCarrier = createCarrierProfile;
export const getCarrierById = getCarrierProfileByPartyId;
export const listCarriers = listCarrierProfiles;
