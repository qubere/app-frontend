import { db } from "@/lib/db";
import { computeEntityHash } from "@/modules/screening/entityHash";
import { recordReferenceDataChanges } from "@/modules/screening/referenceDataChangeTracking";
import { syncSearchTokensForEntities } from "@/modules/screening/searchTokenSync";
import type { ReferenceDataChangeType } from "@prisma/client";

const WBD_DATASET_ID = "world-bank-debarred-firms";
const WBD_SOURCE_LIST = "WBD";
const WBD_AGENCY = "World Bank Group";

// The visible "Debarred Firms & Individuals" table on
// worldbank.org/en/projects-operations/procurement/debarred-firms is a
// Kendo UI grid populated client-side from this JSON endpoint, not
// server-rendered HTML -- confirmed by inspecting the page's inline
// <script>. The apikey below is the exact value hardcoded in that
// same client-side script (a public, client-exposed key, not a secret);
// it may be rotated or restricted without notice, in which case this
// falls back to the circuit breaker below rather than writing partial data.
const WBD_API_URL =
  "https://apigwext.worldbank.org/dvsvc/v1.0/json/APPLICATION/ADOBE_EXPRNCE_MGR/FIRM/SANCTIONED_FIRM";
const WBD_API_KEY = "z9duUaFUiEUYSHs97CU38fcZO7ipOPvm";

// Live count at last check was 1,515 records with no pagination (the whole
// dataset comes back in one call) -- a floor well under that catches a
// truncated/blocked response without being brittle to normal list churn.
const MIN_EXPECTED_RECORDS = 1000;

const PERMANENT_DEBAR_TO_DATE = "2999-12-31";

export interface WbdRecord {
  SUPP_NAME?: string;
  SUPP_TYPE_CODE?: string;
  SUPP_ID?: string;
  SUPP_ADDR?: string;
  SUPP_CITY?: string;
  SUPP_STATE_CODE?: string;
  SUPP_ZIP_CODE?: string;
  LAND1?: string;
  COUNTRY_NAME?: string;
  DEBAR_FROM_DATE?: string;
  DEBAR_TO_DATE?: string;
  DEBAR_REASON?: string;
  ADD_SUPP_INFO?: string;
  SUPP_ELIG_STAT?: string;
  INELIGIBLY_STATUS?: string;
  [key: string]: string | undefined;
}

export interface WbdMappedEntity {
  entityHash: string;
  entityType: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  citation: string | null;
  remarks: string | null;
  programCodes: string[];
  effectiveDate: Date | null;
  expirationDate: Date | null;
}

export interface WbdIngestResult {
  parsedCount: number;
  supersededCount: number;
}

function parseWbdDate(value: string | undefined): Date | null {
  if (!value) return null;
  const text = value.trim();
  if (!text) return null;
  const utcMs = Date.parse(`${text}T00:00:00Z`);
  return Number.isNaN(utcMs) ? null : new Date(utcMs);
}

function mapEntityType(code: string | undefined): string {
  if (code === "I") return "INDIVIDUAL";
  return "ENTITY";
}

export function mapWbdRecord(record: WbdRecord): WbdMappedEntity | null {
  const name = (record.SUPP_NAME || "").trim();
  if (!name) return null;

  const country = (record.COUNTRY_NAME || record.LAND1 || "").trim() || null;
  const entityType = mapEntityType(record.SUPP_TYPE_CODE);

  const remarksParts = [record.DEBAR_REASON, record.ADD_SUPP_INFO, record.SUPP_ELIG_STAT, record.INELIGIBLY_STATUS]
    .map((v) => (v || "").trim())
    .filter((v) => v.length > 0);

  const debarToRaw = (record.DEBAR_TO_DATE || "").trim();

  return {
    entityHash: computeEntityHash(WBD_SOURCE_LIST, name, country ?? undefined),
    entityType,
    name,
    address: (record.SUPP_ADDR || "").trim() || null,
    city: (record.SUPP_CITY || "").trim() || null,
    country,
    citation: (record.SUPP_ID || "").trim() || null,
    remarks: remarksParts.length ? remarksParts.join(" | ") : null,
    programCodes: record.SUPP_ELIG_STAT ? [record.SUPP_ELIG_STAT.trim()] : [],
    effectiveDate: parseWbdDate(record.DEBAR_FROM_DATE),
    // World Bank uses the sentinel 2999-12-31 for permanent/indefinite
    // debarment -- normalize that to "no end date" rather than storing a
    // meaningless far-future date, mirroring the FDA Debarment List's
    // "permanent" text handling.
    expirationDate: debarToRaw === PERMANENT_DEBAR_TO_DATE ? null : parseWbdDate(debarToRaw),
  };
}

export class WorldBankDebarredFirmsIngestionService {
  private static async fetchRecords(): Promise<WbdRecord[]> {
    const res = await fetch(WBD_API_URL, { headers: { apikey: WBD_API_KEY, Accept: "application/json" } });
    if (!res.ok) {
      throw new Error(`World Bank debarred firms API returned HTTP ${res.status}. Ingestion aborted.`);
    }
    const json = await res.json();
    const records = json?.response?.ZPROCSUPP;
    if (!Array.isArray(records)) {
      throw new Error("World Bank debarred firms API response did not contain the expected response.ZPROCSUPP array.");
    }
    return records as WbdRecord[];
  }

  static async fetchAndIngest(): Promise<WbdIngestResult> {
    const records = await this.fetchRecords();
    const entries = records.map(mapWbdRecord).filter((e): e is WbdMappedEntity => e !== null);

    // Circuit breaker: run before any DB write, against the confirmed live
    // count (1,515 with no pagination) -- a near-empty parse means the API
    // shape changed or the apikey was rotated/blocked, not that the World
    // Bank cleared almost every debarment.
    if (entries.length < MIN_EXPECTED_RECORDS) {
      throw new Error(
        `World Bank debarred firms parse returned only ${entries.length} usable records (expected at least ` +
          `${MIN_EXPECTED_RECORDS}). Refusing to treat this as a complete run -- the API response shape most likely ` +
          "changed, or the apikey was rotated/blocked. No data was written."
      );
    }

    const now = new Date();
    const ingestionRunId = crypto.randomUUID();
    const changeInputs: { screeningEntityId: string; changeType: ReferenceDataChangeType }[] = [];

    const UPSERT_BATCH_SIZE = 8;
    for (let i = 0; i < entries.length; i += UPSERT_BATCH_SIZE) {
      const batch = entries.slice(i, i + UPSERT_BATCH_SIZE);
      const results = await Promise.all(
        batch.map((entry) => {
          const data = {
            entityType: entry.entityType,
            name: entry.name,
            address: entry.address,
            city: entry.city,
            country: entry.country,
            citation: entry.citation,
            remarks: entry.remarks,
            programCodes: entry.programCodes,
            agency: WBD_AGENCY,
            effectiveDate: entry.effectiveDate,
            expirationDate: entry.expirationDate,
          };
          return db.screeningEntity.upsert({
            where: { entityHash: entry.entityHash },
            update: {
              ...data,
              publicationStatus: "PUBLISHED",
              publishedAt: now,
              supersededAt: null,
            },
            create: {
              entityHash: entry.entityHash,
              sourceList: WBD_SOURCE_LIST,
              ...data,
              alternateNames: [],
              publicationStatus: "PUBLISHED",
              publishedAt: now,
            },
          });
        })
      );
      for (const row of results) {
        changeInputs.push({
          screeningEntityId: row.id,
          changeType: row.createdAt.getTime() === row.updatedAt.getTime() ? "ADDED" : "UPDATED",
        });
      }
    }

    // Same point-in-time supersession convention as OFAC SDN / UFLPA / FDA:
    // any previously-PUBLISHED row for this sourceList not touched by this
    // run has come off the World Bank's currently-active list.
    const aboutToSupersede = await db.screeningEntity.findMany({
      where: { sourceList: WBD_SOURCE_LIST, publicationStatus: "PUBLISHED", publishedAt: { lt: now } },
      select: { id: true },
    });
    const supersedeResult = await db.screeningEntity.updateMany({
      where: { sourceList: WBD_SOURCE_LIST, publicationStatus: "PUBLISHED", publishedAt: { lt: now } },
      data: { publicationStatus: "SUPERSEDED", supersededAt: new Date() },
    });

    await recordReferenceDataChanges(ingestionRunId, [
      ...changeInputs.map((c) => ({
        screeningEntityId: c.screeningEntityId,
        sourceList: WBD_SOURCE_LIST,
        changeType: c.changeType,
        datasetId: WBD_DATASET_ID,
      })),
      ...aboutToSupersede.map((e) => ({
        screeningEntityId: e.id,
        sourceList: WBD_SOURCE_LIST,
        changeType: "SUPERSEDED" as ReferenceDataChangeType,
        datasetId: WBD_DATASET_ID,
      })),
    ]);

    await syncSearchTokensForEntities(changeInputs.map((c) => c.screeningEntityId));

    return { parsedCount: entries.length, supersededCount: supersedeResult.count };
  }
}
