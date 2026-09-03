import { db } from "@/lib/db";
import * as cheerio from "cheerio";
import { computeEntityHash } from "@/modules/screening/entityHash";
import { recordReferenceDataChanges } from "@/modules/screening/referenceDataChangeTracking";
import { syncSearchTokensForEntities } from "@/modules/screening/searchTokenSync";
import type { ReferenceDataChangeType } from "@prisma/client";

const PSC_DATASET_ID = "public-safety-canada-terrorist-entities";
const PSC_SOURCE_LIST = "PSC_TERRORISM";
const PSC_AGENCY = "Public Safety Canada";
const PSC_PROGRAM = "Criminal Code of Canada, s.83.05 (Listed Terrorist Entities)";

// The Atom feed behind the "Currently listed entities" HTML page --
// structured, no scraping needed. Note: the sibling "-eng.aspx" HTML
// filename 301-redirects to this "-en.aspx" naming (over a plain-http URL,
// a protocol downgrade) -- the XML feed itself has no such redirect.
const PSC_XML_URL = "https://www.publicsafety.gc.ca/cnt/_xml/lstd-ntts-eng.xml";

// Live count at last check was 90 <entry> elements -- a floor comfortably
// below that catches a truncated/blocked response without being brittle to
// normal listing/delisting churn.
const MIN_EXPECTED_RECORDS = 70;
const UPSERT_BATCH_SIZE = 8;

export interface PscEntry {
  title: string;
  refId: string;
  summary: string;
  content: string;
  published: string;
  updated: string;
}

export interface PscMappedEntity {
  entityHash: string;
  entityType: string;
  name: string;
  alternateNames: string[];
  citation: string | null;
  remarks: string | null;
  programCodes: string[];
  effectiveDate: Date | null;
}

export interface PscIngestResult {
  parsedCount: number;
  supersededCount: number;
}

/**
 * Parses the "Currently listed entities" Atom feed. Decoupled from `fetch`
 * so this can be unit-tested against a saved fixture without a network call.
 */
export function parsePscXml(xml: string): PscEntry[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const entries: PscEntry[] = [];

  $("entry").each((_, el) => {
    const $el = $(el);
    const title = $el.find("title").first().text().trim();
    const refId = $el.find("id").first().text().trim();
    if (!title || !refId) return;

    entries.push({
      title,
      refId,
      summary: $el.find("summary").first().text().trim(),
      content: $el.find("content").first().text().trim(),
      published: $el.find("published").first().text().trim(),
      updated: $el.find("updated").first().text().trim(),
    });
  });

  return entries;
}

function parsePscDate(value: string): Date | null {
  const text = value.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return null;
  const utcMs = Date.parse(`${text}T00:00:00Z`);
  return Number.isNaN(utcMs) ? null : new Date(utcMs);
}

export function mapPscEntry(entry: PscEntry): PscMappedEntity {
  // Names are published as "Full Name (ACRONYM)" -- keep the acronym in the
  // name itself (it's how the entity is commonly referenced) but also surface
  // it standalone as an alternate name for search matching.
  const acronymMatch = /^(.*)\(([^()]+)\)\s*$/.exec(entry.title);
  const acronym = acronymMatch ? acronymMatch[2].trim() : null;

  const aliasSource = entry.summary && entry.summary.toUpperCase() !== "N/A" ? entry.summary : "";
  const alternateNames = [
    ...(acronym ? [acronym] : []),
    ...aliasSource
      .split(/[;,]/)
      .map((a) => a.trim())
      .filter((a) => a.length > 0),
  ];

  return {
    // This source has no country/nationality field at all -- entityHash
    // is name-only, same convention as Canada's SEMA/JVCFOR list.
    entityHash: computeEntityHash(PSC_SOURCE_LIST, entry.title),
    entityType: "ENTITY",
    name: entry.title,
    alternateNames,
    citation: `Public Safety Canada Ref. ${entry.refId}`,
    remarks: entry.content || null,
    programCodes: [PSC_PROGRAM],
    effectiveDate: parsePscDate(entry.published),
  };
}

export class PublicSafetyCanadaTerroristEntitiesIngestionService {
  private static async fetchXml(): Promise<string> {
    const res = await fetch(PSC_XML_URL);
    if (!res.ok) {
      throw new Error(`Public Safety Canada terrorist entities feed returned HTTP ${res.status}. Ingestion aborted.`);
    }
    return res.text();
  }

  static async fetchAndIngest(): Promise<PscIngestResult> {
    const xml = await this.fetchXml();
    const entries = parsePscXml(xml);

    // Circuit breaker: run before any DB write.
    if (entries.length < MIN_EXPECTED_RECORDS) {
      throw new Error(
        `Public Safety Canada terrorist entities parse returned only ${entries.length} entries (expected at least ` +
          `${MIN_EXPECTED_RECORDS}). Refusing to treat this as a complete run -- the feed's structure most likely ` +
          "changed, or the fetch was blocked. No data was written."
      );
    }

    const mapped = entries.map(mapPscEntry);
    const now = new Date();
    const ingestionRunId = crypto.randomUUID();
    const changeInputs: { screeningEntityId: string; changeType: ReferenceDataChangeType }[] = [];

    for (let i = 0; i < mapped.length; i += UPSERT_BATCH_SIZE) {
      const batch = mapped.slice(i, i + UPSERT_BATCH_SIZE);
      const results = await Promise.all(
        batch.map((entry) => {
          const data = {
            entityType: entry.entityType,
            name: entry.name,
            alternateNames: entry.alternateNames,
            citation: entry.citation,
            remarks: entry.remarks,
            programCodes: entry.programCodes,
            agency: PSC_AGENCY,
            effectiveDate: entry.effectiveDate,
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
              sourceList: PSC_SOURCE_LIST,
              ...data,
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

    // Same point-in-time supersession convention as the other feeds: any
    // previously-PUBLISHED row for this sourceList not touched by this run
    // has been delisted.
    const aboutToSupersede = await db.screeningEntity.findMany({
      where: { sourceList: PSC_SOURCE_LIST, publicationStatus: "PUBLISHED", publishedAt: { lt: now } },
      select: { id: true },
    });
    const supersedeResult = await db.screeningEntity.updateMany({
      where: { sourceList: PSC_SOURCE_LIST, publicationStatus: "PUBLISHED", publishedAt: { lt: now } },
      data: { publicationStatus: "SUPERSEDED", supersededAt: new Date() },
    });

    await recordReferenceDataChanges(ingestionRunId, [
      ...changeInputs.map((c) => ({
        screeningEntityId: c.screeningEntityId,
        sourceList: PSC_SOURCE_LIST,
        changeType: c.changeType,
        datasetId: PSC_DATASET_ID,
      })),
      ...aboutToSupersede.map((e) => ({
        screeningEntityId: e.id,
        sourceList: PSC_SOURCE_LIST,
        changeType: "SUPERSEDED" as ReferenceDataChangeType,
        datasetId: PSC_DATASET_ID,
      })),
    ]);

    await syncSearchTokensForEntities(changeInputs.map((c) => c.screeningEntityId));

    return { parsedCount: mapped.length, supersededCount: supersedeResult.count };
  }
}
