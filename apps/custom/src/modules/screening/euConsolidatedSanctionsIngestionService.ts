import { db } from "@/lib/db";
import { parse as parseCsv } from "csv-parse/sync";
import { computeEntityHash } from "@/modules/screening/entityHash";
import { recordReferenceDataChanges } from "@/modules/screening/referenceDataChangeTracking";
import type { ReferenceDataChangeType } from "@prisma/client";

const EUC_DATASET_ID = "eu-consolidated-sanctions";
const EUC_SOURCE_LIST = "EUC";
const EUC_AGENCY = "European Union (Financial Sanctions Database)";

// Same webgate.ec.europa.eu host and token as the XML export, just the
// CSV variant of the full sanctions list -- confirmed live (HTTP 200,
// text/csv, ~25MB, semicolon-delimited, UTF-8 with BOM).
const EUC_CSV_URL = "https://webgate.ec.europa.eu/fsd/fsf/public/files/csvFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw";

// The live full export has run to 6,000+ distinct Entity_LogicalId records
// for years. This source carries no explicit reported-total field, so (like
// UKSL) a floor-based circuit breaker stands in for an exact-count check.
const MIN_EXPECTED_ENTITIES = 1000;

const UPSERT_BATCH_SIZE = 8;

interface ParsedNameAlias {
  wholeName?: string;
  strong: boolean;
}

interface ParsedAddress {
  parts: string[];
  country?: string;
}

interface ParsedBirthdate {
  year?: string;
}

interface ParsedSanctionEntity {
  euReferenceNumber?: string;
  subjectTypeCode?: string;
  programme?: string;
  remark?: string;
  names: ParsedNameAlias[];
  addresses: ParsedAddress[];
  birthdates: ParsedBirthdate[];
}

export interface EucIngestResult {
  parsedCount: number;
  supersededCount: number;
  dateGenerated: Date | null;
}

function mapEntityType(subjectTypeCode?: string): string {
  const t = (subjectTypeCode || "").toLowerCase();
  if (t === "person" || t === "p") return "INDIVIDUAL";
  return "ENTITY";
}

export interface ParsedEucFeed {
  entities: ParsedSanctionEntity[];
  dateGenerated: Date | null;
}

interface EucCsvRow {
  fileGenerationDate?: string;
  Entity_LogicalId?: string;
  Entity_EU_ReferenceNumber?: string;
  Entity_SubjectType?: string;
  Entity_Regulation_Programme?: string;
  Entity_Remark?: string;
  NameAlias_LogicalId?: string;
  NameAlias_WholeName?: string;
  NameAlias_FirstName?: string;
  NameAlias_MiddleName?: string;
  NameAlias_LastName?: string;
  Address_LogicalId?: string;
  Address_Street?: string;
  Address_City?: string;
  Address_Region?: string;
  Address_ZipCode?: string;
  Address_CountryDescription?: string;
  BirthDate_LogicalId?: string;
  BirthDate_Year?: string;
  [key: string]: string | undefined;
}

// The feed's fileGenerationDate column is DD/MM/YYYY (EU convention), not ISO.
function parseEuDate(raw?: string): Date | null {
  const m = raw && /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  return Number.isNaN(d.getTime()) ? null : d;
}

function firstNonEmpty(rows: EucCsvRow[], key: keyof EucCsvRow): string | undefined {
  for (const row of rows) {
    const v = row[key];
    if (v && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

/**
 * Parses the EU Consolidated Financial Sanctions List CSV export. The feed
 * is flattened one row per NameAlias record -- NOT a full cross-join of
 * NameAlias x Address x BirthDate x Identification x Citizenship (an entity
 * with 6 names and 2 addresses has far fewer than 12 rows). So rows are
 * grouped by Entity_LogicalId, and each sub-record type is deduplicated by
 * its own `*_LogicalId` column to reconstruct the distinct name/address/
 * birthdate lists, without trying to preserve exact row-level pairing --
 * `ParsedSanctionEntity` doesn't model that pairing either.
 */
export function parseEucCsv(csvText: string): ParsedEucFeed {
  const rows = parseCsv(csvText, {
    columns: true,
    delimiter: ";",
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as EucCsvRow[];

  const dateGenerated = rows.length > 0 ? parseEuDate(rows[0].fileGenerationDate) : null;

  const groupOrder: string[] = [];
  const groups = new Map<string, EucCsvRow[]>();
  for (const row of rows) {
    const logicalId = row.Entity_LogicalId?.trim();
    if (!logicalId) continue;
    if (!groups.has(logicalId)) {
      groups.set(logicalId, []);
      groupOrder.push(logicalId);
    }
    groups.get(logicalId)!.push(row);
  }

  const entities: ParsedSanctionEntity[] = groupOrder.map((logicalId) => {
    const groupRows = groups.get(logicalId)!;

    const names: ParsedNameAlias[] = [];
    const seenNames = new Set<string>();
    for (const row of groupRows) {
      const nameLogicalId = row.NameAlias_LogicalId?.trim();
      if (!nameLogicalId || seenNames.has(nameLogicalId)) continue;
      seenNames.add(nameLogicalId);
      const wholeName =
        row.NameAlias_WholeName?.trim() ||
        [row.NameAlias_FirstName, row.NameAlias_MiddleName, row.NameAlias_LastName]
          .filter((v) => v && v.trim().length > 0)
          .join(" ")
          .trim() ||
        undefined;
      names.push({ wholeName, strong: false });
    }

    const addresses: ParsedAddress[] = [];
    const seenAddresses = new Set<string>();
    for (const row of groupRows) {
      const addressLogicalId = row.Address_LogicalId?.trim();
      if (!addressLogicalId || seenAddresses.has(addressLogicalId)) continue;
      seenAddresses.add(addressLogicalId);
      const parts = [row.Address_Street, row.Address_City, row.Address_Region, row.Address_ZipCode].filter(
        (v): v is string => Boolean(v && v.trim().length > 0)
      );
      addresses.push({ parts, country: row.Address_CountryDescription?.trim() || undefined });
    }

    const birthdates: ParsedBirthdate[] = [];
    const seenBirthdates = new Set<string>();
    for (const row of groupRows) {
      const birthDateLogicalId = row.BirthDate_LogicalId?.trim();
      if (!birthDateLogicalId || seenBirthdates.has(birthDateLogicalId)) continue;
      seenBirthdates.add(birthDateLogicalId);
      birthdates.push({ year: row.BirthDate_Year?.trim() || undefined });
    }

    return {
      euReferenceNumber: firstNonEmpty(groupRows, "Entity_EU_ReferenceNumber"),
      subjectTypeCode: firstNonEmpty(groupRows, "Entity_SubjectType"),
      programme: firstNonEmpty(groupRows, "Entity_Regulation_Programme"),
      remark: firstNonEmpty(groupRows, "Entity_Remark"),
      names,
      addresses,
      birthdates,
    };
  });

  return { entities, dateGenerated };
}

export function mapEucSanctionEntity(entry: ParsedSanctionEntity) {
  const entityType = mapEntityType(entry.subjectTypeCode);
  const primaryName = entry.names.find((n) => n.strong && n.wholeName) || entry.names.find((n) => n.wholeName);
  const name = primaryName?.wholeName || "Unknown Entity";
  const alternateNames = entry.names
    .filter((n) => n !== primaryName)
    .map((n) => n.wholeName)
    .filter((n): n is string => Boolean(n && n.length > 0));

  const primaryAddress = entry.addresses[0];
  const address = primaryAddress && primaryAddress.parts.length > 0 ? primaryAddress.parts.join(", ") : null;
  const country = primaryAddress?.country || null;

  const remarksParts: string[] = [];
  if (entry.remark) remarksParts.push(entry.remark);
  const birthYears = entry.birthdates.map((b) => b.year).filter((y): y is string => Boolean(y));
  if (birthYears.length > 0) remarksParts.push(`Birth year(s): ${birthYears.join(" | ")}`);
  for (const extra of entry.addresses.slice(1)) {
    const line = [...extra.parts, extra.country].filter(Boolean).join(", ");
    if (line) remarksParts.push(`Additional address: ${line}`);
  }

  return {
    entityHash: computeEntityHash(EUC_SOURCE_LIST, name, country || undefined),
    entityType,
    name,
    alternateNames,
    address,
    city: null as string | null,
    country,
    citation: entry.euReferenceNumber || null,
    remarks: remarksParts.length ? remarksParts.join(" | ") : null,
    programCodes: entry.programme ? [entry.programme] : [],
  };
}

export class EuConsolidatedSanctionsIngestionService {
  private static async fetchEucCsv(): Promise<ParsedEucFeed> {
    const res = await fetch(EUC_CSV_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) {
      throw new Error(`EU Consolidated Sanctions List source returned HTTP ${res.status}. Ingestion aborted.`);
    }
    return parseEucCsv(await res.text());
  }

  static async fetchAndIngest(): Promise<EucIngestResult> {
    const { entities, dateGenerated } = await this.fetchEucCsv();

    if (entities.length < MIN_EXPECTED_ENTITIES) {
      throw new Error(
        `EU Consolidated Sanctions List parse returned only ${entities.length} entities (expected at least ${MIN_EXPECTED_ENTITIES}). ` +
          "Refusing to treat this as a complete, successful ingest -- the feed's structure most likely changed, or the fetch was blocked/truncated. No data was written."
      );
    }

    const now = new Date();
    const ingestionRunId = crypto.randomUUID();
    const changeInputs: { screeningEntityId: string; changeType: ReferenceDataChangeType }[] = [];

    for (let i = 0; i < entities.length; i += UPSERT_BATCH_SIZE) {
      const batch = entities.slice(i, i + UPSERT_BATCH_SIZE);
      const results = await Promise.all(
        batch.map((entry) => {
          const data = mapEucSanctionEntity(entry);
          return db.screeningEntity.upsert({
            where: { entityHash: data.entityHash },
            update: {
              entityType: data.entityType,
              name: data.name,
              alternateNames: data.alternateNames,
              address: data.address,
              city: data.city,
              country: data.country,
              citation: data.citation,
              remarks: data.remarks,
              programCodes: data.programCodes,
              agency: EUC_AGENCY,
              publicationStatus: "PUBLISHED",
              publishedAt: now,
              supersededAt: null,
              sourcePublishedAt: dateGenerated ?? undefined,
            },
            create: {
              entityHash: data.entityHash,
              sourceList: EUC_SOURCE_LIST,
              entityType: data.entityType,
              name: data.name,
              alternateNames: data.alternateNames,
              address: data.address,
              city: data.city,
              country: data.country,
              citation: data.citation,
              remarks: data.remarks,
              programCodes: data.programCodes,
              agency: EUC_AGENCY,
              publicationStatus: "PUBLISHED",
              publishedAt: now,
              sourcePublishedAt: dateGenerated ?? now,
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

    const aboutToSupersede = await db.screeningEntity.findMany({
      where: { sourceList: EUC_SOURCE_LIST, publicationStatus: "PUBLISHED", publishedAt: { lt: now } },
      select: { id: true },
    });
    const supersedeResult = await db.screeningEntity.updateMany({
      where: { sourceList: EUC_SOURCE_LIST, publicationStatus: "PUBLISHED", publishedAt: { lt: now } },
      data: { publicationStatus: "SUPERSEDED", supersededAt: new Date() },
    });

    await recordReferenceDataChanges(ingestionRunId, [
      ...changeInputs.map((c) => ({
        screeningEntityId: c.screeningEntityId,
        sourceList: EUC_SOURCE_LIST,
        changeType: c.changeType,
        datasetId: EUC_DATASET_ID,
      })),
      ...aboutToSupersede.map((e) => ({
        screeningEntityId: e.id,
        sourceList: EUC_SOURCE_LIST,
        changeType: "SUPERSEDED" as ReferenceDataChangeType,
        datasetId: EUC_DATASET_ID,
      })),
    ]);

    return { parsedCount: entities.length, supersededCount: supersedeResult.count, dateGenerated };
  }
}
