// Restricted / Denied-Party Screening -- repository layer.
//
// Reference data (ScreeningEntity, ComplianceKeywordRule) is global, no
// accountId column -- consistent with every sibling compliance module.
// sourceList deliberately excludes ENTITY_LIST/UNVERIFIED (endUser),
// UFLPA_ENTITY_LIST (forcedLabor), and MEU_LIST (militaryEndUse) -- those
// are already screened by other modules and must not be double-counted here.
import { db } from "@/lib/db";
import type { AccountScreeningConfig, ComplianceKeywordRule, ScreeningEntity, ScreeningEntityAddress, ScreeningEntityAlias } from "@prisma/client";
import type { ApprovedDispositionMap } from "./suppression";

export const RESTRICTED_PARTY_SOURCE_LISTS = ["SDN", "CONSOLIDATED_NON_SDN", "DPL", "ISN", "SSI", "FSE", "PLC", "NS_MBS"];

export const RESTRICTED_PARTY_RED_FLAG_CATEGORY = "RESTRICTED_PARTY_RED_FLAG";

// Columns actually read from a reference entity downstream (candidateGeneration.ts,
// scoring.ts) -- everything else (remarks, providerMetadata, and other Text/Json/
// tracking columns) is dead weight on this ~67k-row fetch and was slow enough to get
// the connection closed by Postgres mid-query (Prisma P1017) even before either
// child-table join ran.
const REFERENCE_ENTITY_SELECT = {
  id: true,
  name: true,
  alternateNames: true,
  address: true,
  country: true,
  sourceList: true,
  entityType: true,
  programCodes: true,
  citation: true,
  agency: true,
  effectiveDate: true,
  expirationDate: true,
} as const;

/**
 * A reference entity plus every address and alias on file (Dow Jones entities can
 * carry several of each; OFAC/BIS rows have neither beyond the flat address/
 * country columns and alternateNames array). Narrowed to the columns
 * getRestrictedPartyReferenceList's select actually fetches -- other callers
 * (e.g. deltaImpactDispatcher.ts) fetch the full ScreeningEntity, which is a
 * superset and stays assignable here.
 */
export type ScreeningEntityWithAddresses = Pick<ScreeningEntity, keyof typeof REFERENCE_ENTITY_SELECT> & {
  addresses: ScreeningEntityAddress[];
  aliases: ScreeningEntityAlias[];
};

// Postgres rejects a prepared statement with more than 32767 bind
// parameters. The reference list runs ~67k rows (OFAC/BIS + the Dow Jones
// feed), so a plain `include: { addresses: true, aliases: true }` off that
// parent set either blows past that limit or forces the query engine into a
// join that Cartesian-multiplies each entity's addresses by its aliases --
// both measured at minutes, not milliseconds. Fetching each child table as
// its own chunked query and stitching the result in memory keeps every
// query's parameter count (and row count) bounded and fast.
const REFERENCE_LIST_CHUNK_SIZE = 25_000;

async function chunkedFindManyByEntityId<T extends { screeningEntityId: string }>(
  entityIds: string[],
  fetchChunk: (idChunk: string[]) => Promise<T[]>
): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < entityIds.length; i += REFERENCE_LIST_CHUNK_SIZE) {
    const chunk = entityIds.slice(i, i + REFERENCE_LIST_CHUNK_SIZE);
    rows.push(...(await fetchChunk(chunk)));
  }
  return rows;
}

async function fetchReferenceList(): Promise<ScreeningEntityWithAddresses[]> {
  const entities = await db.screeningEntity.findMany({
    where: {
      publicationStatus: "PUBLISHED",
      OR: [{ sourceList: { in: RESTRICTED_PARTY_SOURCE_LISTS } }, { provider: "DOW_JONES" }],
    },
    select: REFERENCE_ENTITY_SELECT,
  });
  const entityIds = entities.map((e) => e.id);

  const [addresses, aliases] = await Promise.all([
    chunkedFindManyByEntityId(entityIds, (idChunk) =>
      db.screeningEntityAddress.findMany({ where: { screeningEntityId: { in: idChunk } } })
    ),
    chunkedFindManyByEntityId(entityIds, (idChunk) =>
      db.screeningEntityAlias.findMany({ where: { screeningEntityId: { in: idChunk } } })
    ),
  ]);

  const addressesByEntity = new Map<string, ScreeningEntityAddress[]>();
  for (const address of addresses) {
    const list = addressesByEntity.get(address.screeningEntityId);
    if (list) list.push(address);
    else addressesByEntity.set(address.screeningEntityId, [address]);
  }
  const aliasesByEntity = new Map<string, ScreeningEntityAlias[]>();
  for (const alias of aliases) {
    const list = aliasesByEntity.get(alias.screeningEntityId);
    if (list) list.push(alias);
    else aliasesByEntity.set(alias.screeningEntityId, [alias]);
  }

  return entities.map((entity) => ({
    ...entity,
    addresses: addressesByEntity.get(entity.id) ?? [],
    aliases: aliasesByEntity.get(entity.id) ?? [],
  }));
}

/** Most recent publishedAt among the relevant reference lists -- the "reference-data as of" watermark used by pre-approval freshness checks. Null when nothing is published yet. */
export async function getLatestReferenceDataPublishedAt(): Promise<Date | null> {
  const row = await db.screeningEntity.findFirst({
    where: {
      publicationStatus: "PUBLISHED",
      OR: [{ sourceList: { in: RESTRICTED_PARTY_SOURCE_LISTS } }, { provider: "DOW_JONES" }],
    },
    orderBy: { publishedAt: "desc" },
    select: { publishedAt: true },
  });
  return row?.publishedAt ?? null;
}

// getRestrictedPartyReferenceList's full fetch (base entities + two chunked
// child-table queries) takes 60-150s over the network for ~67k rows even
// after the P2035/P1017 fixes above -- unusable inline on a synchronous
// screening request. The reference list only actually changes when a
// watchlist republish runs (rare -- daily/weekly), so it's cached in-process
// and revalidated against getLatestReferenceDataPublishedAt's watermark,
// which is a single indexed row and reliably fast. A watermark check that
// throws falls back to serving the stale cache rather than forcing every
// caller through the full 60-150s fetch -- one stale refresh cycle beats an
// unusable screening request. `inFlight` collapses concurrent cache-miss
// callers onto one fetch instead of each kicking off their own 60-150s query.
let cache: { list: ScreeningEntityWithAddresses[]; asOf: Date | null } | null = null;
let inFlight: Promise<ScreeningEntityWithAddresses[]> | null = null;

/**
 * Published denial-order reference rows this module owns. Empty result must
 * be treated as SKIPPED, never CLEAR.
 *
 * Deliberately NOT `async` -- `inFlight` must be assigned synchronously,
 * before this function returns, so two callers invoked back-to-back (no
 * `await` between them) both see it set and join the same fetch rather than
 * each starting their own 60-150s query. Wrapping the whole body in
 * `async () => {...}` still lets it suspend internally on the watermark/
 * fetch awaits -- only the *assignment* to `inFlight` needs to be sync.
 */
export function getRestrictedPartyReferenceList(): Promise<ScreeningEntityWithAddresses[]> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    let currentAsOf: Date | null;
    try {
      currentAsOf = await getLatestReferenceDataPublishedAt();
    } catch {
      if (cache) return cache.list;
      throw new Error("Reference data watermark lookup failed and no cached reference list is available.");
    }

    if (cache && cache.asOf?.getTime() === currentAsOf?.getTime()) {
      return cache.list;
    }

    const list = await fetchReferenceList();
    cache = { list, asOf: currentAsOf };
    return list;
  })();

  return inFlight.finally(() => {
    inFlight = null;
  });
}

/** Drops the in-process reference-list cache -- for tests only; production invalidation is automatic via the publishedAt watermark check on every call. */
export function __resetReferenceListCacheForTests(): void {
  cache = null;
  inFlight = null;
}

/** True when a relevant reference list has published a row after `since` -- used to invalidate pre-approval reuse when the watchlist itself has moved on, independent of whether the Party's own identity changed. */
export async function hasNewerPublishedReferenceData(since: Date): Promise<boolean> {
  const row = await db.screeningEntity.findFirst({
    where: {
      publicationStatus: "PUBLISHED",
      publishedAt: { gt: since },
      OR: [{ sourceList: { in: RESTRICTED_PARTY_SOURCE_LISTS } }, { provider: "DOW_JONES" }],
    },
    select: { id: true },
  });
  return row !== null;
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

/**
 * Most-recent APPROVED/FALSE_POSITIVE disposition per screeningEntityId for
 * this party -- the suppression map. Only meaningful when partyId is known
 * (Party Master screening); ad-hoc/API/Copilot screenings with no partyId
 * get an empty map.
 *
 * A disposition only speaks to the ScreeningEntity data the reviewer actually
 * saw. If that entity has been republished since the reviewer's decision
 * (e.g. a watchlist refresh added new identifiers/addresses to the same
 * record), the decision is stale and must not go on suppressing future
 * matches against it forever -- normal matching resumes for that entity
 * until it is reviewed again. Same freshness principle as
 * checkPreApprovalGate's referenceDataAsOf check, applied per-entity instead
 * of per-party.
 */
export async function getApprovedDispositions(accountId: string, partyId: string): Promise<ApprovedDispositionMap> {
  const dispositions = await db.restrictedPartyDisposition.findMany({
    where: {
      accountId,
      status: { in: ["APPROVED", "FALSE_POSITIVE"] },
      result: { partyId },
    },
    include: {
      result: {
        include: { matches: { include: { screeningEntity: { select: { publishedAt: true } } } } },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const map: ApprovedDispositionMap = new Map();
  for (const disposition of dispositions) {
    for (const match of disposition.result.matches) {
      if (map.has(match.screeningEntityId)) continue;
      if (match.screeningEntity.publishedAt && match.screeningEntity.publishedAt > disposition.updatedAt) {
        continue;
      }
      map.set(match.screeningEntityId, disposition.id);
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
