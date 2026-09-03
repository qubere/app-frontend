import { db } from "@/lib/db";
import * as cheerio from "cheerio";
import { computeEntityHash } from "@/modules/screening/entityHash";
import { recordReferenceDataChanges } from "@/modules/screening/referenceDataChangeTracking";
import { syncSearchTokensForEntities } from "@/modules/screening/searchTokenSync";
import type { ReferenceDataChangeType } from "@prisma/client";

const FDA_DATASET_ID = "fda-debarment";
const FDA_SOURCE_LIST = "FDA_DEBARMENT";
const FDA_AGENCY = "FDA (Food and Drug Administration)";

const FDA_DEBARMENT_PAGE_URL =
  "https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/compliance-actions-and-activities/fda-debarment-list-drug-product-applications";

// The FDA site blocks non-browser User-Agents (and, at last check, this
// environment's outbound IP entirely -- see fetchHtml below) with a 302 to
// an Akamai "abuse-detection-apology" page; a browser-like UA is required
// but not sufficient on its own.
const FETCH_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export interface FdaDebarmentEntry {
  name: string;
  entityType: "INDIVIDUAL" | "ENTITY";
  effectiveDate: Date | null;
  expirationDate: Date | null;
  citation: string | null;
}

export interface FdaDebarmentIngestResult {
  parsedCount: number;
  supersededCount: number;
}

function parseFdaDate(value: string): Date | null {
  const text = value.trim();
  if (!text) return null;
  // Column format observed live: MM/DD/YYYY.
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (!m) return null;
  const [, month, day, year] = m;
  const utcMs = Date.parse(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00Z`);
  return Number.isNaN(utcMs) ? null : new Date(utcMs);
}

/**
 * Parses the FDA Debarment List (Drug Product Applications) page's two
 * tables -- "Firms" (entityType ENTITY) and "Persons" (entityType
 * INDIVIDUAL) -- both sharing the column layout: Last Name, First & Middle
 * Names, Effective Date, End/Term of Debarment, FR Date, Volume Page. The
 * firms table uses only its first column for the entity name (no last/first
 * split) and is frequently empty ("None as of this date").
 *
 * Decoupled from `fetch` so this can be unit-tested against a saved HTML
 * fixture without a network call.
 */
export function parseFdaDebarmentHtml(html: string): FdaDebarmentEntry[] {
  const $ = cheerio.load(html);
  const entries: FdaDebarmentEntry[] = [];
  const tables = $("table").toArray();

  tables.forEach((table, index) => {
    const entityType: "INDIVIDUAL" | "ENTITY" = index === 0 ? "ENTITY" : "INDIVIDUAL";
    $(table)
      .find("tbody tr")
      .each((_, row) => {
        const cells = $(row).find("td");
        if (cells.length < 3) return;

        const col0 = $(cells[0]).text().trim();
        const col1 = $(cells[1]).text().trim();
        if (!col0 || /^none\b/i.test(col0)) return;

        const name = entityType === "ENTITY" ? col0 : [col1, col0].filter(Boolean).join(" ").trim();
        if (!name) return;

        const effectiveDateText = $(cells[2]).text();
        const endTermText = cells.length > 3 ? $(cells[3]).text().trim() : "";
        const frDateText = cells.length > 4 ? $(cells[4]).text().trim() : "";
        const volumePageText = cells.length > 5 ? $(cells[5]).text().trim() : "";

        entries.push({
          name,
          entityType,
          effectiveDate: parseFdaDate(effectiveDateText),
          expirationDate: /permanent/i.test(endTermText) ? null : parseFdaDate(endTermText),
          citation: [frDateText, volumePageText].filter(Boolean).join(" -- ") || null,
        });
      });
  });

  return entries;
}

export class FdaDebarmentIngestionService {
  private static async fetchHtml(): Promise<string> {
    const res = await fetch(FDA_DEBARMENT_PAGE_URL, { headers: { "User-Agent": FETCH_USER_AGENT } });
    if (!res.ok) {
      throw new Error(`FDA Debarment List page returned HTTP ${res.status}. Ingestion aborted.`);
    }
    return res.text();
  }

  static async fetchAndIngest(): Promise<FdaDebarmentIngestResult> {
    const html = await this.fetchHtml();
    const entries = parseFdaDebarmentHtml(html);

    // Circuit breaker: the live Persons table has run to 100+ entries and
    // only grows -- a near-empty parse means the page structure changed
    // (or the fetch was silently redirected to a block/apology page), not
    // that FDA cleared almost everyone's debarment.
    if (entries.length < 20) {
      throw new Error(
        `FDA Debarment List parse returned only ${entries.length} entries. Refusing to treat this as a complete, ` +
          "successful ingest -- the page's HTML structure most likely changed, or the fetch was blocked. No data was written."
      );
    }

    const now = new Date();
    const ingestionRunId = crypto.randomUUID();
    const changeInputs: { screeningEntityId: string; changeType: ReferenceDataChangeType }[] = [];

    for (const entry of entries) {
      const entityHash = computeEntityHash(FDA_SOURCE_LIST, entry.name);
      const data = {
        entityType: entry.entityType,
        name: entry.name,
        citation: entry.citation,
        agency: FDA_AGENCY,
        effectiveDate: entry.effectiveDate,
        expirationDate: entry.expirationDate,
      };
      const row = await db.screeningEntity.upsert({
        where: { entityHash },
        update: {
          ...data,
          publicationStatus: "PUBLISHED",
          publishedAt: now,
          supersededAt: null,
        },
        create: {
          entityHash,
          sourceList: FDA_SOURCE_LIST,
          ...data,
          alternateNames: [],
          programCodes: [],
          publicationStatus: "PUBLISHED",
          publishedAt: now,
        },
      });
      changeInputs.push({
        screeningEntityId: row.id,
        changeType: row.createdAt.getTime() === row.updatedAt.getTime() ? "ADDED" : "UPDATED",
      });
    }

    // Same point-in-time supersession convention as OFAC SDN / UFLPA: any
    // previously-PUBLISHED row for this sourceList not touched by this run
    // has expired off, or been removed from, the FDA list.
    const aboutToSupersede = await db.screeningEntity.findMany({
      where: { sourceList: FDA_SOURCE_LIST, publicationStatus: "PUBLISHED", publishedAt: { lt: now } },
      select: { id: true },
    });
    const supersedeResult = await db.screeningEntity.updateMany({
      where: { sourceList: FDA_SOURCE_LIST, publicationStatus: "PUBLISHED", publishedAt: { lt: now } },
      data: { publicationStatus: "SUPERSEDED", supersededAt: new Date() },
    });

    await recordReferenceDataChanges(ingestionRunId, [
      ...changeInputs.map((c) => ({
        screeningEntityId: c.screeningEntityId,
        sourceList: FDA_SOURCE_LIST,
        changeType: c.changeType,
        datasetId: FDA_DATASET_ID,
      })),
      ...aboutToSupersede.map((e) => ({
        screeningEntityId: e.id,
        sourceList: FDA_SOURCE_LIST,
        changeType: "SUPERSEDED" as ReferenceDataChangeType,
        datasetId: FDA_DATASET_ID,
      })),
    ]);

    await syncSearchTokensForEntities(changeInputs.map((c) => c.screeningEntityId));

    return { parsedCount: entries.length, supersededCount: supersedeResult.count };
  }
}
