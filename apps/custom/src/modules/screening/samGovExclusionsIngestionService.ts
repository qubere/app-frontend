import { db } from "@/lib/db";
import { recordReferenceDataChanges } from "@/modules/screening/referenceDataChangeTracking";
import { syncSearchTokensForEntities } from "@/modules/screening/searchTokenSync";
import type { ReferenceDataChangeType } from "@prisma/client";
import AdmZip from "adm-zip";
import { parse as parseCsv } from "csv-parse/sync";
import crypto from "crypto";

const SAM_DATASET_ID = "sam-gov-exclusions";
const SAM_PROVIDER = "SAM_GOV_EXCLUSIONS";
const SAM_SOURCE_LIST = "SAM_EXCLUSIONS";
const SAM_AGENCY = "SAM.gov (System for Award Management) Exclusions";

const EXTRACTS_URL = "https://api.sam.gov/data-services/v1/extracts";

// Same rationale as OFAC/BIS/FBI Wanted: keep concurrent upserts under
// DATABASE_URL's pgbouncer connection_limit=10.
const UPSERT_BATCH_SIZE = 8;

export interface SamGovExclusionRecord {
  [column: string]: string;
}

export interface SamGovIngestResult {
  count: number;
  supersededCount: number;
}

/**
 * The exclusions extract's exact column names have not been verified against
 * a live response yet (the API key's daily quota was exhausted before this
 * could be confirmed -- see the dataset registry note for this source). This
 * reads rows as generic header->value maps rather than a fixed record shape
 * so the transform below can be adjusted without changing the fetch/parse
 * plumbing once a live sample is available.
 */
function parseDelimitedExtract(text: string): SamGovExclusionRecord[] {
  const delimiter = text.slice(0, text.indexOf("\n")).includes("|") ? "|" : ",";
  return parseCsv(text, {
    columns: true,
    delimiter,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as SamGovExclusionRecord[];
}

function pick(row: SamGovExclusionRecord, keys: string[]): string | null {
  const lowerMap = new Map(Object.keys(row).map((k) => [k.toLowerCase(), k]));
  for (const key of keys) {
    const actualKey = lowerMap.get(key.toLowerCase());
    if (actualKey && row[actualKey] && row[actualKey].trim().length > 0) {
      return row[actualKey].trim();
    }
  }
  return null;
}

function extractRecordId(row: SamGovExclusionRecord): string | null {
  return pick(row, ["ExclusionID", "Exclusion_ID", "SAM_Number", "UEI", "EntityID", "CAGE Code", "CAGECode", "DUNS"]);
}

function extractName(row: SamGovExclusionRecord): string | null {
  const entityName = pick(row, ["EntityName", "Entity_Name", "Name", "FirmName", "OrganizationName"]);
  if (entityName) return entityName;

  const first = pick(row, ["FirstName", "First_Name"]);
  const middle = pick(row, ["MiddleName", "Middle_Name"]);
  const last = pick(row, ["LastName", "Last_Name"]);
  if (first || last) {
    return [first, middle, last].filter(Boolean).join(" ");
  }
  return null;
}

function extractEntityType(row: SamGovExclusionRecord): string {
  const classification = pick(row, ["ClassificationType", "Classification", "Type", "ExclusionType"]);
  const c = (classification || "").toUpperCase();
  if (c.includes("INDIVIDUAL")) return "INDIVIDUAL";
  if (c.includes("VESSEL")) return "VESSEL";
  return "ENTITY";
}

export function transformExclusionRow(row: SamGovExclusionRecord): {
  providerRecordId: string;
  name: string;
  entityType: string;
  address: string | null;
  city: string | null;
  country: string | null;
  remarks: string | null;
  citation: string | null;
  effectiveDate: Date | null;
  expirationDate: Date | null;
} | null {
  const name = extractName(row);
  if (!name) return null;

  const providerRecordId = extractRecordId(row) || crypto.createHash("sha256").update(name).digest("hex").slice(0, 32);

  const activeDateRaw = pick(row, ["ActiveDate", "Active_Date", "CreatedDate", "ActionDate"]);
  const terminationDateRaw = pick(row, ["TerminationDate", "Termination_Date", "ExpirationDate"]);
  const parseDate = (v: string | null): Date | null => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  return {
    providerRecordId,
    name,
    entityType: extractEntityType(row),
    address: pick(row, ["Address1", "AddressLine1", "Address"]),
    city: pick(row, ["City"]),
    country: pick(row, ["Country", "CountryCode"]),
    remarks: pick(row, ["ExclusionDescription", "AdditionalComments", "Description"]),
    citation: pick(row, ["LegalAuthority", "CTCode", "ExclusionProgram"]),
    effectiveDate: parseDate(activeDateRaw),
    expirationDate: parseDate(terminationDateRaw),
  };
}

export class SamGovExclusionsIngestionService {
  /**
   * SAM.gov's per-key daily quota (as low as ~10 requests/day on a personal
   * key) makes the paginated /entity-information/v4/exclusions JSON API
   * impractical for a full sync of ~168k records. The bulk extract API needs
   * only two calls total: one to locate today's extract file, one to
   * download it.
   */
  static async locateExtractDownloadUrl(apiKey: string): Promise<string> {
    const url = new URL(EXTRACTS_URL);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("fileType", "EXCLUSION");

    const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!res.ok) {
      throw new Error(`SAM.gov extracts API returned HTTP ${res.status}: ${res.statusText}.`);
    }
    const json = await res.json();

    // The exact response schema hasn't been verified live yet -- scan
    // recursively for the first https:// string rather than assume a key
    // name, so this survives whatever the real field is called.
    const found = findFirstUrl(json);
    if (!found) {
      throw new Error("SAM.gov extracts API response did not contain a download URL. Cannot locate exclusions extract.");
    }
    return found;
  }

  static async downloadExtract(downloadUrl: string, apiKey: string): Promise<Buffer> {
    const url = new URL(downloadUrl);
    if (!url.searchParams.has("api_key")) url.searchParams.set("api_key", apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`SAM.gov extract download returned HTTP ${res.status}: ${res.statusText}.`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  static extractRowsFromZip(zipBuffer: Buffer): SamGovExclusionRecord[] {
    const zip = new AdmZip(zipBuffer);
    const entry = zip.getEntries().find((e) => /\.(csv|dat|txt)$/i.test(e.entryName) && !e.isDirectory);
    if (!entry) {
      throw new Error("SAM.gov exclusions extract ZIP did not contain a recognizable data file.");
    }
    const text = entry.getData().toString("utf-8");
    return parseDelimitedExtract(text);
  }

  static async fetchAndIngest(): Promise<SamGovIngestResult> {
    const apiKey = process.env.SAM_GOV_API_KEY || "";
    if (!apiKey) {
      throw new Error("SAM_GOV_API_KEY is not configured. Cannot fetch the SAM.gov exclusions extract.");
    }

    const downloadUrl = await this.locateExtractDownloadUrl(apiKey);
    const zipBuffer = await this.downloadExtract(downloadUrl, apiKey);
    const rows = this.extractRowsFromZip(zipBuffer);

    const now = new Date();
    const ingestionRunId = crypto.randomUUID();
    const changeInputs: { screeningEntityId: string; changeType: ReferenceDataChangeType }[] = [];
    const activeProviderRecordIds = new Set<string>();
    let fetchedCount = 0;
    let skippedCount = 0;

    const parsed = rows.map(transformExclusionRow).filter((r): r is NonNullable<typeof r> => {
      if (!r) skippedCount++;
      return r !== null;
    });

    for (let i = 0; i < parsed.length; i += UPSERT_BATCH_SIZE) {
      const batch = parsed.slice(i, i + UPSERT_BATCH_SIZE);
      const results = await Promise.all(
        batch.map((rec) => {
          const entityHash = crypto.createHash("sha256").update(`${SAM_PROVIDER}:${rec.providerRecordId}`).digest("hex");
          return db.screeningEntity.upsert({
            where: { provider_providerRecordId: { provider: SAM_PROVIDER, providerRecordId: rec.providerRecordId } },
            update: {
              name: rec.name,
              entityType: rec.entityType,
              address: rec.address,
              city: rec.city,
              country: rec.country,
              remarks: rec.remarks,
              citation: rec.citation,
              agency: SAM_AGENCY,
              effectiveDate: rec.effectiveDate,
              expirationDate: rec.expirationDate,
              publicationStatus: "PUBLISHED",
              publishedAt: now,
              supersededAt: null,
              sourcePublishedAt: rec.effectiveDate ?? undefined,
            },
            create: {
              entityHash,
              sourceList: SAM_SOURCE_LIST,
              sourceAuthority: "SAM.gov",
              provider: SAM_PROVIDER,
              providerRecordId: rec.providerRecordId,
              entityType: rec.entityType,
              name: rec.name,
              address: rec.address,
              city: rec.city,
              country: rec.country,
              remarks: rec.remarks,
              citation: rec.citation,
              agency: SAM_AGENCY,
              effectiveDate: rec.effectiveDate,
              expirationDate: rec.expirationDate,
              publicationStatus: "PUBLISHED",
              publishedAt: now,
              sourcePublishedAt: rec.effectiveDate ?? now,
            },
          });
        })
      );
      for (const row of results) {
        activeProviderRecordIds.add(row.providerRecordId!);
        changeInputs.push({
          screeningEntityId: row.id,
          changeType: row.createdAt.getTime() === row.updatedAt.getTime() ? "ADDED" : "UPDATED",
        });
      }
    }
    fetchedCount = parsed.length;

    if (fetchedCount === 0) {
      throw new Error("SAM.gov exclusions extract parsed to 0 usable records. Refusing to treat this as a complete run.");
    }

    const previouslyPublished = await db.screeningEntity.findMany({
      where: { provider: SAM_PROVIDER, publicationStatus: "PUBLISHED" },
      select: { id: true, providerRecordId: true },
    });
    const toSupersede = previouslyPublished.filter((e) => !activeProviderRecordIds.has(e.providerRecordId!));

    let supersededCount = 0;
    if (toSupersede.length > 0) {
      supersededCount = toSupersede.length;
      await db.screeningEntity.updateMany({
        where: { id: { in: toSupersede.map((e) => e.id) } },
        data: { publicationStatus: "SUPERSEDED", supersededAt: new Date() },
      });
      for (const e of toSupersede) {
        changeInputs.push({ screeningEntityId: e.id, changeType: "SUPERSEDED" });
      }
    }

    await recordReferenceDataChanges(
      ingestionRunId,
      changeInputs.map((c) => ({
        screeningEntityId: c.screeningEntityId,
        sourceList: SAM_SOURCE_LIST,
        provider: SAM_PROVIDER,
        changeType: c.changeType,
        datasetId: SAM_DATASET_ID,
      }))
    );

    await syncSearchTokensForEntities(
      changeInputs.filter((c) => c.changeType !== "SUPERSEDED").map((c) => c.screeningEntityId)
    );

    return { count: fetchedCount, supersededCount };
  }
}

function findFirstUrl(value: unknown): string | null {
  if (typeof value === "string") {
    return /^https?:\/\//i.test(value) ? value : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstUrl(item);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) {
      const found = findFirstUrl(v);
      if (found) return found;
    }
  }
  return null;
}
