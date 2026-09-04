import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { computeEntityHash } from "@/modules/screening/entityHash";
import { recordReferenceDataChanges } from "@/modules/screening/referenceDataChangeTracking";
import { syncSearchTokensForEntities } from "@/modules/screening/searchTokenSync";
import type { ReferenceDataChangeType } from "@prisma/client";

const EASL_DATASET_ID = "eu-air-safety-list";
const EASL_SOURCE_LIST = "EU_AIR_SAFETY_LIST";
const EASL_AGENCY = "European Commission (Air Safety Committee)";
const EASL_XLSX_URL =
  "https://transport.ec.europa.eu/document/download/67b75752-d144-4366-9f4a-c04157840211_en?filename=air-safety-list.xlsx";

// Live workbook (fetched 2026-09-03) has ~171 populated Annex A rows plus 3
// Annex B rows before dedup -- some Annex A rows repeat verbatim near the end
// of the sheet (a duplication in the EC's own published file, not a parsing
// bug; see dedupeByEntityHash below). A floor below the smallest annex alone
// still catches a truncated/blocked fetch or a changed column layout.
const MIN_EXPECTED_RECORDS = 100;

const REGULATION_CITATION = "Regulation (EC) No 474/2006";

export interface EuAirSafetyRow {
  annex: "A" | "B";
  name: string;
  aocNumber: string;
  icaoDesignator: string;
  stateOfOperator: string;
  aircraftTypeRestricted?: string;
  registrationMarks?: string;
  stateOfRegistry?: string;
}

export interface ParsedEuAirSafetyFeed {
  rows: EuAirSafetyRow[];
}

export interface EuAirSafetyMappedEntity {
  entityHash: string;
  entityType: string;
  name: string;
  country: string | null;
  citation: string | null;
  remarks: string | null;
  programCodes: string[];
}

function cellToString(cell: ExcelJS.CellValue): string {
  if (cell == null) return "";
  if (typeof cell === "object" && "richText" in cell) {
    return (cell as { richText: Array<{ text: string }> }).richText.map((r) => r.text).join("");
  }
  if (typeof cell === "object" && "text" in cell) return String((cell as { text: unknown }).text ?? "");
  return String(cell);
}

/**
 * Parses the EU Air Safety List workbook's two sheets ("Annex A" -- carriers
 * fully banned within the EU, "Annex B" -- carriers subject to operational
 * restrictions). Both sheets share a title/disclaimer preamble before the
 * real header row; data rows are distinguished by a populated name cell that
 * isn't the header text itself. Some Annex A rows are descriptive
 * "All air carriers certified by the authorities with responsibility for
 * regulatory oversight of <State>[, including/.]" blanket-ban rows (no
 * AOC/ICAO value) rather than individually named carriers -- these are kept
 * as their own screenable record (the ban applies to the whole state's
 * carrier population, not to a specific legal entity name).
 */
const HEADER_ROW_PATTERN = /^Name of the legal entity/i;

/**
 * Both sheets carry a title/disclaimer preamble (merged banner text, legend
 * notes) above the real header row, in the same first column that later
 * holds carrier names -- so rows can't be filtered on "has a name" alone.
 * This walks rows in order and only starts collecting once the header row
 * itself has been seen, guaranteeing preamble text is never mistaken for a
 * carrier/blanket-ban entry.
 */
function parseSheetRows(sheet: ExcelJS.Worksheet, annex: "A" | "B"): EuAirSafetyRow[] {
  const rows: EuAirSafetyRow[] = [];
  let headerSeen = false;

  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells = (row.values as ExcelJS.CellValue[]).slice(1);
    const name = cellToString(cells[0]).trim();
    if (!headerSeen) {
      if (HEADER_ROW_PATTERN.test(name)) headerSeen = true;
      return;
    }
    if (!name) return;
    rows.push({
      annex,
      name,
      aocNumber: cellToString(cells[1]).trim(),
      icaoDesignator: cellToString(cells[2]).trim(),
      stateOfOperator: cellToString(cells[3]).trim(),
      ...(annex === "B"
        ? {
            aircraftTypeRestricted: cellToString(cells[4]).trim() || undefined,
            registrationMarks: cellToString(cells[5]).trim() || undefined,
            stateOfRegistry: cellToString(cells[6]).trim() || undefined,
          }
        : {}),
    });
  });

  return rows;
}

export function parseEuAirSafetyWorkbook(workbook: ExcelJS.Workbook): ParsedEuAirSafetyFeed {
  const rows: EuAirSafetyRow[] = [];

  const annexASheet = workbook.getWorksheet("Annex A");
  if (annexASheet) rows.push(...parseSheetRows(annexASheet, "A"));

  const annexBSheet = workbook.getWorksheet("Annex B");
  if (annexBSheet) rows.push(...parseSheetRows(annexBSheet, "B"));

  return { rows };
}

export function mapEuAirSafetyRow(row: EuAirSafetyRow): EuAirSafetyMappedEntity {
  const country = row.stateOfOperator || null;
  const remarksParts: string[] = [];
  if (row.icaoDesignator && !/^unknown$/i.test(row.icaoDesignator)) {
    remarksParts.push(`ICAO designator: ${row.icaoDesignator}`);
  }
  if (row.annex === "B") {
    if (row.aircraftTypeRestricted) remarksParts.push(`Aircraft type restricted: ${row.aircraftTypeRestricted}`);
    if (row.registrationMarks) remarksParts.push(`Restricted aircraft: ${row.registrationMarks}`);
    if (row.stateOfRegistry) remarksParts.push(`State of registry: ${row.stateOfRegistry}`);
  }

  return {
    entityHash: computeEntityHash(EASL_SOURCE_LIST, row.name, country ?? undefined),
    entityType: "ENTITY",
    name: row.name,
    country,
    citation:
      row.aocNumber && !/^unknown$/i.test(row.aocNumber)
        ? `${REGULATION_CITATION} Annex ${row.annex} -- AOC/Licence ${row.aocNumber}`
        : `${REGULATION_CITATION} Annex ${row.annex}`,
    remarks: remarksParts.length ? remarksParts.join(" | ") : null,
    programCodes: [`${REGULATION_CITATION} Annex ${row.annex}`],
  };
}

/**
 * The EC's own published workbook repeats a block of Annex A rows verbatim
 * near the end of the sheet -- collapse by entityHash (same
 * name+country -> same hash) so a duplicated source row never races itself
 * inside a single upsert batch.
 */
function dedupeByEntityHash(entities: EuAirSafetyMappedEntity[]): EuAirSafetyMappedEntity[] {
  const seen = new Set<string>();
  const result: EuAirSafetyMappedEntity[] = [];
  for (const entity of entities) {
    if (seen.has(entity.entityHash)) continue;
    seen.add(entity.entityHash);
    result.push(entity);
  }
  return result;
}

export interface EuAirSafetyIngestResult {
  parsedCount: number;
  supersededCount: number;
}

export class EuAirSafetyListIngestionService {
  private static async downloadXlsx(): Promise<Buffer> {
    const res = await fetch(EASL_XLSX_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) {
      throw new Error(`EU Air Safety List source returned HTTP ${res.status}. Ingestion aborted.`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  static async fetchAndIngest(): Promise<EuAirSafetyIngestResult> {
    const buffer = await this.downloadXlsx();
    const workbook = new ExcelJS.Workbook();
    // @ts-expect-error @types/node v20 adds a generic to Buffer that predates exceljs types
    await workbook.xlsx.load(buffer);

    const { rows } = parseEuAirSafetyWorkbook(workbook);
    const entities = dedupeByEntityHash(rows.map(mapEuAirSafetyRow));

    if (entities.length < MIN_EXPECTED_RECORDS) {
      throw new Error(
        `EU Air Safety List parse returned only ${entities.length} usable records (expected at least ` +
          `${MIN_EXPECTED_RECORDS}). Refusing to treat this as a complete run -- the workbook's sheet/column layout ` +
          "most likely changed, or the fetch was blocked/truncated. No data was written."
      );
    }

    const now = new Date();
    const ingestionRunId = crypto.randomUUID();
    const changeInputs: { screeningEntityId: string; changeType: ReferenceDataChangeType }[] = [];

    const UPSERT_BATCH_SIZE = 8;
    for (let i = 0; i < entities.length; i += UPSERT_BATCH_SIZE) {
      const batch = entities.slice(i, i + UPSERT_BATCH_SIZE);
      const results = await Promise.all(
        batch.map((entity) => {
          const data = {
            entityType: entity.entityType,
            name: entity.name,
            country: entity.country,
            citation: entity.citation,
            remarks: entity.remarks,
            programCodes: entity.programCodes,
            agency: EASL_AGENCY,
          };
          return db.screeningEntity.upsert({
            where: { entityHash: entity.entityHash },
            update: {
              ...data,
              publicationStatus: "PUBLISHED",
              publishedAt: now,
              supersededAt: null,
            },
            create: {
              entityHash: entity.entityHash,
              sourceList: EASL_SOURCE_LIST,
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

    const aboutToSupersede = await db.screeningEntity.findMany({
      where: { sourceList: EASL_SOURCE_LIST, publicationStatus: "PUBLISHED", publishedAt: { lt: now } },
      select: { id: true },
    });
    const supersedeResult = await db.screeningEntity.updateMany({
      where: { sourceList: EASL_SOURCE_LIST, publicationStatus: "PUBLISHED", publishedAt: { lt: now } },
      data: { publicationStatus: "SUPERSEDED", supersededAt: new Date() },
    });

    await recordReferenceDataChanges(ingestionRunId, [
      ...changeInputs.map((c) => ({
        screeningEntityId: c.screeningEntityId,
        sourceList: EASL_SOURCE_LIST,
        changeType: c.changeType,
        datasetId: EASL_DATASET_ID,
      })),
      ...aboutToSupersede.map((e) => ({
        screeningEntityId: e.id,
        sourceList: EASL_SOURCE_LIST,
        changeType: "SUPERSEDED" as ReferenceDataChangeType,
        datasetId: EASL_DATASET_ID,
      })),
    ]);

    await syncSearchTokensForEntities(changeInputs.map((c) => c.screeningEntityId));

    return { parsedCount: entities.length, supersededCount: supersedeResult.count };
  }
}
