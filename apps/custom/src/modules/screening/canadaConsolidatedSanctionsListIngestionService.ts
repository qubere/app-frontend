import { db } from "@/lib/db";
import { SaxesParser, SaxesTagPlain } from "saxes";
import { computeEntityHash } from "@/modules/screening/entityHash";
import { recordReferenceDataChanges } from "@/modules/screening/referenceDataChangeTracking";
import { syncSearchTokensForEntities } from "@/modules/screening/searchTokenSync";
import type { ReferenceDataChangeType } from "@prisma/client";

const CANADA_DATASET_ID = "canada-consolidated-sanctions-list";
const CANADA_SOURCE_LIST = "GAC";
const CANADA_AGENCY = "Global Affairs Canada";
const CANADA_XML_URL =
  "https://www.international.gc.ca/world-monde/assets/office_docs/international_relations-relations_internationales/sanctions/sema-lmes.xml";

// The live Consolidated Canadian Autonomous Sanctions List has run to
// 5,600+ <record> elements for years and only grows. This source's XML
// carries no reported-total element (or even a generation-date attribute)
// to check parsed count against exactly, so (like UKSL/EUC/SECO/DFAT) a
// floor-based circuit breaker stands in.
const MIN_EXPECTED_RECORDS = 3500;

const UPSERT_BATCH_SIZE = 8;

interface ParsedCanadaRecord {
  countryRaw?: string;
  lastName?: string;
  givenName?: string;
  entityOrShip?: string;
  alias?: string;
  dobOrBuildDate?: string;
  shipType?: string;
  shipImo?: string;
  schedule?: string;
  item?: string;
  dateOfListing?: string;
}

export interface ParsedCanadaFeed {
  records: ParsedCanadaRecord[];
}

/**
 * Streams the Consolidated Canadian Autonomous Sanctions List XML (a flat
 * <data-set>/<record> schema, bilingual EN/FR text embedded in every
 * element -- no nesting, no attributes, and no globally unique per-record
 * ID) into parsed entries without buffering the whole ~2.9MB file. Decoupled
 * from `fetch` for unit testing against a trimmed fixture, mirroring
 * parseUkslXmlStream / parseSecoXmlStream.
 */
export async function parseCanadaXmlStream(body: ReadableStream<Uint8Array>): Promise<ParsedCanadaFeed> {
  const records: ParsedCanadaRecord[] = [];

  const parser = new SaxesParser();
  const stack: string[] = [];
  let current: ParsedCanadaRecord | null = null;
  let textBuf = "";
  let parseError: Error | null = null;

  parser.on("error", (e) => {
    parseError = e;
  });
  parser.on("text", (t) => {
    textBuf += t;
  });

  parser.on("opentag", (node: SaxesTagPlain) => {
    stack.push(node.name);
    textBuf = "";
    if (node.name === "record") current = {};
  });

  parser.on("closetag", (node: SaxesTagPlain) => {
    const tag = node.name;
    const parentTag = stack[stack.length - 2];
    const value = textBuf.trim();

    if (current && parentTag === "record") {
      switch (tag) {
        case "Country-Pays":
          current.countryRaw = value || undefined;
          break;
        case "LastName-NomDeFamille":
          current.lastName = value || undefined;
          break;
        case "GivenName-Prenom":
          current.givenName = value || undefined;
          break;
        case "EntityOrShip-EntiteOuNavire":
          current.entityOrShip = value || undefined;
          break;
        case "Aliases-Alias":
          current.alias = value || undefined;
          break;
        case "DateOfBirthOrShipBuildDate-DateDeNaissanceOuDateDeConstructionDuNavire":
          current.dobOrBuildDate = value || undefined;
          break;
        case "TitleOrShipType-TitreOuTypeDeNavire":
          current.shipType = value || undefined;
          break;
        case "ShipIMONumber-NumeroOMIDuNavire":
          current.shipImo = value || undefined;
          break;
        case "Schedule-Annexe":
          current.schedule = value || undefined;
          break;
        case "Item-NumeroDarticle":
          current.item = value || undefined;
          break;
        case "DateOfListing-DateDinscription":
          current.dateOfListing = value || undefined;
          break;
      }
    } else if (tag === "record" && current) {
      records.push(current);
      current = null;
    }

    stack.pop();
    textBuf = "";
  });

  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.write(decoder.decode(value, { stream: true }));
      if (parseError) throw parseError;
    }
    parser.write(decoder.decode());
    parser.close();
    if (parseError) throw parseError;
  } finally {
    reader.releaseLock();
  }

  return { records };
}

// Every text field in this feed embeds "English / French" (or, for ship
// types, "English | French") in one string -- take the English half.
function englishPart(raw: string | undefined, separator = " / "): string | undefined {
  if (!raw) return undefined;
  const idx = raw.indexOf(separator);
  const english = idx >= 0 ? raw.slice(0, idx) : raw;
  const trimmed = english.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// Country-Pays doubles as this feed's only regulation/programme identifier.
// For most records it's a bare country name (the Special Economic Measures
// Regulations for that country); a few, like JVCFOR, are already a fully
// spelled-out regulation name -- detected by the presence of "Regulations"
// or "Act" and left as-is rather than re-wrapped.
function programmeName(countryEnglish: string): string {
  if (/regulations?|\bact\b/i.test(countryEnglish)) return countryEnglish;
  return `Special Economic Measures (${countryEnglish}) Regulations`;
}

function mapEntityType(entry: ParsedCanadaRecord): string {
  if (entry.lastName) return "INDIVIDUAL";
  if (entry.entityOrShip && (entry.shipType || entry.shipImo)) return "VESSEL";
  return "ENTITY";
}

function parseCanadaDate(value: string | undefined): Date | null {
  if (!value) return null;
  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (full) {
    const d = new Date(Date.UTC(Number(full[1]), Number(full[2]) - 1, Number(full[3])));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const yearOnly = /^(\d{4})$/.exec(value.trim());
  if (yearOnly) {
    const d = new Date(Date.UTC(Number(yearOnly[1]), 0, 1));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function mapCanadaRecord(entry: ParsedCanadaRecord) {
  const entityType = mapEntityType(entry);
  const name =
    entityType === "INDIVIDUAL"
      ? [entry.givenName, entry.lastName].filter(Boolean).join(" ").trim() || "Unknown Individual"
      : (entry.entityOrShip || "Unknown Entity").trim();

  const alternateNames = entry.alias ? [entry.alias.trim()].filter((n) => n.length > 0) : [];

  const countryEnglish = englishPart(entry.countryRaw);
  const programCodes = countryEnglish ? [programmeName(countryEnglish)] : [];

  const remarksParts: string[] = [];
  if (entry.schedule) remarksParts.push(`Schedule: ${entry.schedule.trim()}`);
  if (entry.item) remarksParts.push(`Item: ${entry.item.trim()}`);
  if (entityType === "VESSEL") {
    const shipTypeEnglish = englishPart(entry.shipType, " | ");
    if (shipTypeEnglish) remarksParts.push(`Ship type: ${shipTypeEnglish}`);
    if (entry.shipImo) remarksParts.push(`IMO Number: ${entry.shipImo.trim()}`);
    if (entry.dobOrBuildDate) remarksParts.push(`Ship build date: ${entry.dobOrBuildDate.trim()}`);
  } else if (entry.dobOrBuildDate) {
    remarksParts.push(`DOB: ${entry.dobOrBuildDate.trim()}`);
  }

  // No address/nationality field exists anywhere in this source, so
  // `country` is left null rather than populated from the targeted-regime
  // name in Country-Pays -- that's the sanctions programme, not the
  // entity's own country, and conflating the two would misrepresent e.g.
  // a Venezuelan official listed under Canada's (country-agnostic) JVCFOR.
  const citationParts = [countryEnglish, entry.schedule ? `Schedule ${entry.schedule.trim()}` : null, entry.item ? `Item ${entry.item.trim()}` : null].filter(
    (v): v is string => Boolean(v)
  );

  return {
    entityHash: computeEntityHash(CANADA_SOURCE_LIST, name),
    entityType,
    name,
    alternateNames,
    country: null as string | null,
    citation: citationParts.length ? citationParts.join(" — ") : null,
    remarks: remarksParts.length ? remarksParts.join(" | ") : null,
    programCodes,
    sourcePublishedAt: parseCanadaDate(entry.dateOfListing),
  };
}

export interface CanadaIngestResult {
  parsedCount: number;
  supersededCount: number;
}

export class CanadaConsolidatedSanctionsListIngestionService {
  private static async parseCanadaXml(): Promise<ParsedCanadaFeed> {
    const res = await fetch(CANADA_XML_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok || !res.body) {
      throw new Error(`Canada Consolidated Sanctions List source returned HTTP ${res.status}. Ingestion aborted.`);
    }
    return parseCanadaXmlStream(res.body);
  }

  static async fetchAndIngest(): Promise<CanadaIngestResult> {
    const { records } = await this.parseCanadaXml();

    if (records.length < MIN_EXPECTED_RECORDS) {
      throw new Error(
        `Canada Consolidated Sanctions List parse returned only ${records.length} records (expected at least ${MIN_EXPECTED_RECORDS}). ` +
          "Refusing to treat this as a complete, successful ingest -- the feed's structure most likely changed, or the fetch was blocked/truncated. No data was written."
      );
    }

    const now = new Date();
    const ingestionRunId = crypto.randomUUID();
    const changeInputs: { screeningEntityId: string; changeType: ReferenceDataChangeType }[] = [];

    for (let i = 0; i < records.length; i += UPSERT_BATCH_SIZE) {
      const batch = records.slice(i, i + UPSERT_BATCH_SIZE);
      const results = await Promise.all(
        batch.map((entry) => {
          const data = mapCanadaRecord(entry);
          return db.screeningEntity.upsert({
            where: { entityHash: data.entityHash },
            update: {
              entityType: data.entityType,
              name: data.name,
              alternateNames: data.alternateNames,
              country: data.country,
              citation: data.citation,
              remarks: data.remarks,
              programCodes: data.programCodes,
              agency: CANADA_AGENCY,
              publicationStatus: "PUBLISHED",
              publishedAt: now,
              supersededAt: null,
              sourcePublishedAt: data.sourcePublishedAt ?? undefined,
            },
            create: {
              entityHash: data.entityHash,
              sourceList: CANADA_SOURCE_LIST,
              entityType: data.entityType,
              name: data.name,
              alternateNames: data.alternateNames,
              country: data.country,
              citation: data.citation,
              remarks: data.remarks,
              programCodes: data.programCodes,
              agency: CANADA_AGENCY,
              publicationStatus: "PUBLISHED",
              publishedAt: now,
              sourcePublishedAt: data.sourcePublishedAt ?? now,
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
      where: { sourceList: CANADA_SOURCE_LIST, publicationStatus: "PUBLISHED", publishedAt: { lt: now } },
      select: { id: true },
    });
    const supersedeResult = await db.screeningEntity.updateMany({
      where: { sourceList: CANADA_SOURCE_LIST, publicationStatus: "PUBLISHED", publishedAt: { lt: now } },
      data: { publicationStatus: "SUPERSEDED", supersededAt: new Date() },
    });

    await recordReferenceDataChanges(ingestionRunId, [
      ...changeInputs.map((c) => ({
        screeningEntityId: c.screeningEntityId,
        sourceList: CANADA_SOURCE_LIST,
        changeType: c.changeType,
        datasetId: CANADA_DATASET_ID,
      })),
      ...aboutToSupersede.map((e) => ({
        screeningEntityId: e.id,
        sourceList: CANADA_SOURCE_LIST,
        changeType: "SUPERSEDED" as ReferenceDataChangeType,
        datasetId: CANADA_DATASET_ID,
      })),
    ]);

    await syncSearchTokensForEntities(changeInputs.map((c) => c.screeningEntityId));

    return { parsedCount: records.length, supersededCount: supersedeResult.count };
  }
}
