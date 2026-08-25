// Restricted / Denied-Party Screening -- repository layer.
//
// Reference data (ScreeningEntity, ComplianceKeywordRule) is global, no
// accountId column -- consistent with every sibling compliance module.
// sourceList deliberately excludes ENTITY_LIST/UNVERIFIED (endUser),
// UFLPA_ENTITY_LIST (forcedLabor), and MEU_LIST (militaryEndUse) -- those
// are already screened by other modules and must not be double-counted here.
import { db } from "@/lib/db";
import type { AccountScreeningConfig, ComplianceKeywordRule, ScreeningEntity, ScreeningEntityAddress } from "@prisma/client";
import type { ApprovedDispositionMap } from "./suppression";

export const RESTRICTED_PARTY_SOURCE_LISTS = ["SDN", "CONSOLIDATED_NON_SDN", "DPL", "ISN", "SSI", "FSE", "PLC", "NS_MBS"];

export const RESTRICTED_PARTY_RED_FLAG_CATEGORY = "RESTRICTED_PARTY_RED_FLAG";

/** A reference entity plus every address on file (Dow Jones entities can carry several; OFAC/BIS rows have none beyond the flat address/city/country columns). */
export type ScreeningEntityWithAddresses = ScreeningEntity & { addresses: ScreeningEntityAddress[] };

/** Published denial-order reference rows this module owns. Empty result must be treated as SKIPPED, never CLEAR. */
export async function getRestrictedPartyReferenceList(): Promise<ScreeningEntityWithAddresses[]> {
  return db.screeningEntity.findMany({
    where: {
      publicationStatus: "PUBLISHED",
      OR: [{ sourceList: { in: RESTRICTED_PARTY_SOURCE_LISTS } }, { provider: "DOW_JONES" }],
    },
    include: { addresses: true },
  });
}

/** Tenant-level RPS matcher config, or null when the account has never configured one -- callers fall back to module defaults per field. */
export async function getAccountScreeningConfig(accountId: string): Promise<AccountScreeningConfig | null> {
  return db.accountScreeningConfig.findUnique({ where: { accountId } });
}

/** Published red-flag keyword rules. Empty result disables the red-flag check (never fabricated as a false CLEAR on the denial-order pass). */
export async function getRedFlagRules(): Promise<ComplianceKeywordRule[]> {
  return db.complianceKeywordRule.findMany({
    where: { category: RESTRICTED_PARTY_RED_FLAG_CATEGORY, publicationStatus: "PUBLISHED" },
  });
}

/** Most-recent APPROVED/FALSE_POSITIVE disposition per screeningEntityId for this party -- the suppression map. Only meaningful when partyId is known (Party Master screening); ad-hoc/API/Copilot screenings with no partyId get an empty map. */
export async function getApprovedDispositions(accountId: string, partyId: string): Promise<ApprovedDispositionMap> {
  const dispositions = await db.restrictedPartyDisposition.findMany({
    where: {
      accountId,
      status: { in: ["APPROVED", "FALSE_POSITIVE"] },
      result: { partyId },
    },
    include: { result: { include: { matches: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const map: ApprovedDispositionMap = new Map();
  for (const disposition of dispositions) {
    for (const match of disposition.result.matches) {
      if (!map.has(match.screeningEntityId)) {
        map.set(match.screeningEntityId, disposition.id);
      }
    }
  }
  return map;
}

export interface ShipmentPartyForScreening {
  shipmentPartyId: string;
  role: string;
  legalEntityId: string;
  partyId: string | null;
  name: string;
  address: string | null;
  city: string | null;
  country: string;
  contactName: string | null;
}

/** Walks ShipmentParty -> LegalEntity (-> Party -> PartyContact when linked) for the full identity (address/contact) `EmbargoParty` doesn't carry. `agentContext.ts`/`EmbargoParty` are left unchanged -- other screenings depend on their current shape. */
export async function getShipmentPartiesForScreening(shipmentId: string): Promise<ShipmentPartyForScreening[]> {
  const shipmentParties = await db.shipmentParty.findMany({
    where: { shipmentId },
    include: {
      legalEntity: {
        include: {
          party: {
            include: {
              contacts: { where: { status: "ACTIVE" }, orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }] },
            },
          },
        },
      },
    },
  });

  return shipmentParties.map((sp) => {
    const contact = sp.legalEntity.party?.contacts.find((c) => c.name && c.name.trim()) ?? null;
    return {
      shipmentPartyId: sp.id,
      role: sp.role,
      legalEntityId: sp.legalEntityId,
      partyId: sp.legalEntity.partyId,
      name: sp.legalEntity.tradeName || sp.legalEntity.legalName,
      address: sp.legalEntity.addressLine1,
      city: sp.legalEntity.city,
      country: sp.legalEntity.country,
      contactName: contact?.name ?? null,
    };
  });
}
