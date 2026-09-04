import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { computeEntityHash } from "@/modules/screening/entityHash";
import { recordReferenceDataChanges } from "@/modules/screening/referenceDataChangeTracking";
import { syncSearchTokensForEntities } from "@/modules/screening/searchTokenSync";
import type { ReferenceDataChangeType } from "@prisma/client";

const DFAT_DATASET_ID = "dfat-consolidated-list";
const DFAT_SOURCE_LIST = "DFAT";
const DFAT_AGENCY = "DFAT (Australian Department of Foreign Affairs and Trade)";
const DFAT_XLSX_URL = "https://www.dfat.gov.au/sites/default/files/Australian_Sanctions_Consolidated_List.xlsx";

// The live Consolidated List has run to 3,900+ listed parties for years and
// only grows -- a near-empty parse means the workbook's column layout
// changed or the fetch was blocked/truncated, not that Australia delisted
// almost everyone. Same floor-based circuit breaker as UKSL/EUC/SECO (this
// source carries no explicit reported-total cell to check exactly).
const MIN_EXPECTED_ENTITIES = 2500;

const COLUMNS = {
  reference: 0,
  name: 1,
  type: 2,
  nameType: 3,
  aliasStrength: 4,
  dateOfBirth: 5,
  placeOfBirth: 6,
  citizenship: 7,
  address: 8,
  additionalInformation: 9,
  listingInformation: 10,
  imoNumber: 11,
  committees: 12,
  controlDate: 13,
  instrumentOfDesignation: 14,
  targetedFinancialSanction: 15,
  travelBan: 16,
  armsEmbargo: 17,
  maritimeRestriction: 18,
} as const;

interface ParsedDfatRow {
  reference: string;
  name: string;
  type: string;
  nameType: string;
  dateOfBirth: string;
  placeOfBirth: string;
  citizenship: string;
  address: string;
  additionalInformation: string;
  listingInformation: string;
  imoNumber: string;
  committees: string;
  controlDate: Date | null;
  instrumentOfDesignation: string;
  targetedFinancialSanction: boolean;
  travelBan: boolean;
  armsEmbargo: boolean;
  maritimeRestriction: boolean;
}

export interface ParsedDfatEntity {
  reference: string;
  entityType: "INDIVIDUAL" | "ENTITY" | "VESSEL";
  primaryName: string;
  alternateNames: string[];
  dateOfBirth: string | null;
  placeOfBirth: string | null;
  citizenship: string | null;
  address: string | null;
  additionalInformation: string | null;
  listingInformation: string | null;
  imoNumber: string | null;
  committees: string | null;
  controlDate: Date | null;
  instrumentOfDesignation: string | null;
  targetedFinancialSanction: boolean;
  travelBan: boolean;
  armsEmbargo: boolean;
  maritimeRestriction: boolean;
}

export interface ParsedDfatFeed {
  entities: ParsedDfatEntity[];
}

function cellToString(cell: ExcelJS.CellValue): string {
  if (cell == null) return "";
  if (cell instanceof Date) return cell.toISOString();
  if (typeof cell === "object" && "richText" in cell) {
    return (cell as { richText: Array<{ text: string }> }).richText.map((r) => r.text).join("");
  }
  if (typeof cell === "object" && "text" in cell) return String((cell as { text: unknown }).text ?? "");
  return String(cell);
}

function cellToDate(cell: ExcelJS.CellValue): Date | null {
  if (cell instanceof Date) return cell;
  return null;
}

function mapEntityType(type: string): "INDIVIDUAL" | "ENTITY" | "VESSEL" {
  const t = type.trim().toUpperCase();
  if (t === "INDIVIDUAL") return "INDIVIDUAL";
  if (t === "VESSEL") return "VESSEL";
  return "ENTITY";
}

// Each listed party spans one or more rows sharing a numeric Reference
// prefix ("3", "3a", "3b", ...): one "Primary Name" row plus zero or more
// "Alias"/"Original Script" rows repeating the same DOB/address/listing
// fields verbatim -- only Name/Name Type/Alias Strength differ per row.
function baseReference(reference: string): string {
  const m = /^(\d+)/.exec(reference);
  return m ? m[1] : reference;
}

/**
 * Parses the DFAT Consolidated List workbook (single "Consolidated List"
 * worksheet, ~11,000 rows for ~3,900 listed parties) into one entity per
 * distinct base Reference, folding its Alias/Original Script name rows into
 * alternateNames. Unlike SECO/UKSL/EUC's multi-MB XML feeds, this workbook
 * is small enough (~1.3MB) to buffer and load with ExcelJS directly rather
 * than stream, mirroring complianceBatch/xlsxParser.ts's approach.
 */
export async function parseDfatXlsxBuffer(buffer: Buffer): Promise<ParsedDfatFeed> {
  const workbook = new ExcelJS.Workbook();
  // @ts-expect-error @types/node v20 adds a generic to Buffer that predates exceljs types
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("The DFAT Consolidated List workbook contains no worksheets");

  const rows: ParsedDfatRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const cells = (row.values as ExcelJS.CellValue[]).slice(1);
    const reference = cellToString(cells[COLUMNS.reference]).trim();
    if (!reference) return;

    rows.push({
      reference,
      name: cellToString(cells[COLUMNS.name]).trim(),
      type: cellToString(cells[COLUMNS.type]).trim(),
      nameType: cellToString(cells[COLUMNS.nameType]).trim(),
      dateOfBirth: cellToString(cells[COLUMNS.dateOfBirth]).trim(),
      placeOfBirth: cellToString(cells[COLUMNS.placeOfBirth]).trim(),
      citizenship: cellToString(cells[COLUMNS.citizenship]).trim(),
      address: cellToString(cells[COLUMNS.address]).trim(),
      additionalInformation: cellToString(cells[COLUMNS.additionalInformation]).trim(),
      listingInformation: cellToString(cells[COLUMNS.listingInformation]).trim(),
      imoNumber: cellToString(cells[COLUMNS.imoNumber]).trim(),
      committees: cellToString(cells[COLUMNS.committees]).trim(),
      controlDate: cellToDate(cells[COLUMNS.controlDate]),
      instrumentOfDesignation: cellToString(cells[COLUMNS.instrumentOfDesignation]).trim(),
      targetedFinancialSanction: cellToString(cells[COLUMNS.targetedFinancialSanction]).trim().toLowerCase() === "true",
      travelBan: cellToString(cells[COLUMNS.travelBan]).trim().toLowerCase() === "true",
      armsEmbargo: cellToString(cells[COLUMNS.armsEmbargo]).trim().toLowerCase() === "true",
      maritimeRestriction: cellToString(cells[COLUMNS.maritimeRestriction]).trim().toLowerCase() === "true",
    });
  });

  const groups = new Map<string, ParsedDfatRow[]>();
  for (const row of rows) {
    const key = baseReference(row.reference);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }

  const entities: ParsedDfatEntity[] = [];
  for (const [reference, group] of groups) {
    const primaryRow = group.find((r) => r.nameType === "Primary Name") ?? group[0];
    if (!primaryRow.name) continue;

    const alternateNames = group
      .filter((r) => r !== primaryRow && r.name && r.name !== primaryRow.name)
      .map((r) => r.name);

    entities.push({
      reference,
      entityType: mapEntityType(primaryRow.type),
      primaryName: primaryRow.name,
      alternateNames,
      dateOfBirth: primaryRow.dateOfBirth || null,
      placeOfBirth: primaryRow.placeOfBirth || null,
      citizenship: primaryRow.citizenship || null,
      address: primaryRow.address || null,
      additionalInformation: primaryRow.additionalInformation || null,
      listingInformation: primaryRow.listingInformation || null,
      imoNumber: primaryRow.imoNumber || null,
      committees: primaryRow.committees || null,
      controlDate: primaryRow.controlDate,
      instrumentOfDesignation: primaryRow.instrumentOfDesignation || null,
      targetedFinancialSanction: primaryRow.targetedFinancialSanction,
      travelBan: primaryRow.travelBan,
      armsEmbargo: primaryRow.armsEmbargo,
      maritimeRestriction: primaryRow.maritimeRestriction,
    });
  }

  return { entities };
}

export function mapDfatEntity(entry: ParsedDfatEntity) {
  const remarksParts: string[] = [];
  if (entry.additionalInformation) remarksParts.push(entry.additionalInformation);
  if (entry.listingInformation) remarksParts.push(`Listing information: ${entry.listingInformation}`);
  if (entry.dateOfBirth) remarksParts.push(`DOB: ${entry.dateOfBirth}`);
  if (entry.placeOfBirth) remarksParts.push(`POB: ${entry.placeOfBirth}`);
  if (entry.imoNumber) remarksParts.push(`IMO Number: ${entry.imoNumber}`);
  if (entry.instrumentOfDesignation) remarksParts.push(`Instrument of designation: ${entry.instrumentOfDesignation}`);
  const sanctionMeasures = [
    entry.targetedFinancialSanction && "Targeted Financial Sanction",
    entry.travelBan && "Travel Ban",
    entry.armsEmbargo && "Arms Embargo",
    entry.maritimeRestriction && "Maritime Restriction",
  ].filter(Boolean);
  if (sanctionMeasures.length) remarksParts.push(`Sanction measures: ${sanctionMeasures.join(", ")}`);

  return {
    entityHash: computeEntityHash(DFAT_SOURCE_LIST, entry.primaryName, entry.citizenship || undefined),
    entityType: entry.entityType,
    name: entry.primaryName,
    alternateNames: entry.alternateNames,
    address: entry.address,
    country: entry.citizenship,
    citation: entry.reference,
    remarks: remarksParts.length ? remarksParts.join(" | ") : null,
    programCodes: entry.committees ? [entry.committees] : [],
  };
}

export interface DfatIngestResult {
  parsedCount: number;
  supersededCount: number;
}

export class DfatConsolidatedListIngestionService {
  private static async downloadXlsx(): Promise<Buffer> {
    const res = await fetch(DFAT_XLSX_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) {
      throw new Error(`DFAT Consolidated List source returned HTTP ${res.status}. Ingestion aborted.`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  static async fetchAndIngest(): Promise<DfatIngestResult> {
    const buffer = await this.downloadXlsx();
    const { entities } = await parseDfatXlsxBuffer(buffer);

    if (entities.length < MIN_EXPECTED_ENTITIES) {
      throw new Error(
        `DFAT Consolidated List parse returned only ${entities.length} entities (expected at least ${MIN_EXPECTED_ENTITIES}). ` +
          "Refusing to treat this as a complete, successful ingest -- the workbook's column layout most likely changed, or the fetch was blocked/truncated. No data was written."
      );
    }

    const now = new Date();
    const ingestionRunId = crypto.randomUUID();
    const changeInputs: { screeningEntityId: string; changeType: ReferenceDataChangeType }[] = [];

    for (const entry of entities) {
      const data = mapDfatEntity(entry);
      const row = await db.screeningEntity.upsert({
        where: { entityHash: data.entityHash },
        update: {
          entityType: data.entityType,
          name: data.name,
          alternateNames: data.alternateNames,
          address: data.address,
          country: data.country,
          citation: data.citation,
          remarks: data.remarks,
          programCodes: data.programCodes,
          agency: DFAT_AGENCY,
          publicationStatus: "PUBLISHED",
          publishedAt: now,
          supersededAt: null,
          sourcePublishedAt: entry.controlDate ?? undefined,
        },
        create: {
          entityHash: data.entityHash,
          sourceList: DFAT_SOURCE_LIST,
          entityType: data.entityType,
          name: data.name,
          alternateNames: data.alternateNames,
          address: data.address,
          country: data.country,
          citation: data.citation,
          remarks: data.remarks,
          programCodes: data.programCodes,
          agency: DFAT_AGENCY,
          publicationStatus: "PUBLISHED",
          publishedAt: now,
          sourcePublishedAt: entry.controlDate ?? now,
        },
      });
      changeInputs.push({
        screeningEntityId: row.id,
        changeType: row.createdAt.getTime() === row.updatedAt.getTime() ? "ADDED" : "UPDATED",
      });
    }

    const aboutToSupersede = await db.screeningEntity.findMany({
      where: { sourceList: DFAT_SOURCE_LIST, publicationStatus: "PUBLISHED", publishedAt: { lt: now } },
      select: { id: true },
    });
    const supersedeResult = await db.screeningEntity.updateMany({
      where: { sourceList: DFAT_SOURCE_LIST, publicationStatus: "PUBLISHED", publishedAt: { lt: now } },
      data: { publicationStatus: "SUPERSEDED", supersededAt: new Date() },
    });

    await recordReferenceDataChanges(ingestionRunId, [
      ...changeInputs.map((c) => ({
        screeningEntityId: c.screeningEntityId,
        sourceList: DFAT_SOURCE_LIST,
        changeType: c.changeType,
        datasetId: DFAT_DATASET_ID,
      })),
      ...aboutToSupersede.map((e) => ({
        screeningEntityId: e.id,
        sourceList: DFAT_SOURCE_LIST,
        changeType: "SUPERSEDED" as ReferenceDataChangeType,
        datasetId: DFAT_DATASET_ID,
      })),
    ]);

    await syncSearchTokensForEntities(changeInputs.map((c) => c.screeningEntityId));

    return { parsedCount: entities.length, supersededCount: supersedeResult.count };
  }
}
