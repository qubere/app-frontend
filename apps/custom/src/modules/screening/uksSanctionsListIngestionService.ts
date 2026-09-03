import { db } from "@/lib/db";
import { SaxesParser, SaxesTagPlain } from "saxes";
import { computeEntityHash } from "@/modules/screening/entityHash";
import { recordReferenceDataChanges } from "@/modules/screening/referenceDataChangeTracking";
import { syncSearchTokensForEntities } from "@/modules/screening/searchTokenSync";
import type { ReferenceDataChangeType } from "@prisma/client";

const UKSL_DATASET_ID = "uk-sanctions-list";
const UKSL_SOURCE_LIST = "UKSL";
const UKSL_AGENCY = "OFSI (UK Office of Financial Sanctions Implementation)";
const UKSL_XML_URL = "https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.xml";

// A real, live UK Sanctions List has run to 6,000+ <Designation> entries for
// years and only grows -- a near-empty parse means the feed's structure
// changed or the fetch was blocked/truncated, not that the UK delisted
// almost everyone. Mirrors the same floor-based circuit breaker used for
// FDA Debarment and UFLPA (this source, unlike OFAC's XML, carries no
// explicit reported-total element to check parsed count against exactly).
const MIN_EXPECTED_DESIGNATIONS = 1000;

const UPSERT_BATCH_SIZE = 8;

interface ParsedName {
  parts: string[];
  nameType?: string;
}

interface ParsedAddress {
  lines: string[];
  country?: string;
}

interface ParsedDesignation {
  uniqueId?: string;
  individualEntityShip?: string;
  names: ParsedName[];
  addresses: ParsedAddress[];
  regimeName?: string;
  otherInformation?: string;
  dobs: string[];
}

export interface UkslIngestResult {
  parsedCount: number;
  supersededCount: number;
  dateGenerated: Date | null;
}

function mapEntityType(individualEntityShip?: string): string {
  const t = (individualEntityShip || "").toUpperCase();
  if (t === "INDIVIDUAL") return "INDIVIDUAL";
  if (t === "SHIP") return "VESSEL";
  return "ENTITY";
}

function parseUkDate(value: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface ParsedUkslFeed {
  designations: ParsedDesignation[];
  dateGenerated: Date | null;
}

/**
 * Streams the UK Sanctions List XML (~21MB, one <Designation> per
 * designated party) into parsed entries without buffering the raw file.
 * Decoupled from `fetch` so it can be unit-tested against a trimmed XML
 * fixture with no network call, mirroring parseOfacXmlStream.
 */
export async function parseUkslXmlStream(body: ReadableStream<Uint8Array>): Promise<ParsedUkslFeed> {
  const designations: ParsedDesignation[] = [];
  let dateGenerated: Date | null = null;

  const parser = new SaxesParser();
  const stack: string[] = [];
  let textBuf = "";
  let current: ParsedDesignation | null = null;
  let currentName: ParsedName | null = null;
  let currentAddress: ParsedAddress | null = null;
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
    if (node.name === "Designation") current = { names: [], addresses: [], dobs: [] };
    else if (node.name === "Name" && stack[stack.length - 2] === "Names") currentName = { parts: [] };
    else if (node.name === "Address" && stack[stack.length - 2] === "Addresses") currentAddress = { lines: [] };
  });

  parser.on("closetag", (node: SaxesTagPlain) => {
    const tag = node.name;
    const parentTag = stack[stack.length - 2];
    const value = textBuf.trim();

    if (tag === "DateGenerated" && parentTag === "Designations") {
      dateGenerated = parseUkDate(value);
    } else if (currentName && parentTag === "Name") {
      if (/^Name\d$/.test(tag) && value) currentName.parts.push(value);
      else if (tag === "NameType") currentName.nameType = value;
    } else if (tag === "Name" && current) {
      current.names.push(currentName!);
      currentName = null;
    } else if (currentAddress && parentTag === "Address") {
      if (/^AddressLine\d$/.test(tag) && value) currentAddress.lines.push(value);
      else if (tag === "AddressCountry") currentAddress.country = value;
    } else if (tag === "Address" && current) {
      current.addresses.push(currentAddress!);
      currentAddress = null;
    } else if (tag === "DOB" && parentTag === "DOBs" && current) {
      if (value) current.dobs.push(value);
    } else if (current && parentTag === "Designation") {
      if (tag === "UniqueID") current.uniqueId = value;
      else if (tag === "IndividualEntityShip") current.individualEntityShip = value;
      else if (tag === "RegimeName") current.regimeName = value;
      else if (tag === "OtherInformation") current.otherInformation = value;
    } else if (tag === "Designation" && current) {
      designations.push(current);
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

  return { designations, dateGenerated };
}

export function mapUkslDesignation(entry: ParsedDesignation) {
  const entityType = mapEntityType(entry.individualEntityShip);
  const primaryName = entry.names.find((n) => n.nameType === "Primary Name") || entry.names[0];
  const name = primaryName ? primaryName.parts.join(" ") : "Unknown Entity";
  const alternateNames = entry.names
    .filter((n) => n !== primaryName)
    .map((n) => n.parts.join(" "))
    .filter((n) => n.length > 0);

  const primaryAddress = entry.addresses[0];
  const address = primaryAddress && primaryAddress.lines.length > 0 ? primaryAddress.lines.join(", ") : null;
  const country = primaryAddress?.country || null;

  const remarksParts: string[] = [];
  if (entry.otherInformation) remarksParts.push(entry.otherInformation);
  if (entry.dobs.length > 0) remarksParts.push(`DOB: ${entry.dobs.join(" | ")}`);
  for (const extra of entry.addresses.slice(1)) {
    const line = [...extra.lines, extra.country].filter(Boolean).join(", ");
    if (line) remarksParts.push(`Additional address: ${line}`);
  }

  return {
    entityHash: computeEntityHash(UKSL_SOURCE_LIST, name, country || undefined),
    entityType,
    name,
    alternateNames,
    address,
    city: null as string | null,
    country,
    citation: entry.uniqueId || null,
    remarks: remarksParts.length ? remarksParts.join(" | ") : null,
    programCodes: entry.regimeName ? [entry.regimeName] : [],
  };
}

export class UksSanctionsListIngestionService {
  private static async parseUkslXml(): Promise<ParsedUkslFeed> {
    const res = await fetch(UKSL_XML_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok || !res.body) {
      throw new Error(`UK Sanctions List source returned HTTP ${res.status}. Ingestion aborted.`);
    }
    return parseUkslXmlStream(res.body);
  }

  static async fetchAndIngest(): Promise<UkslIngestResult> {
    const { designations, dateGenerated } = await this.parseUkslXml();

    if (designations.length < MIN_EXPECTED_DESIGNATIONS) {
      throw new Error(
        `UK Sanctions List parse returned only ${designations.length} designations (expected at least ${MIN_EXPECTED_DESIGNATIONS}). ` +
          "Refusing to treat this as a complete, successful ingest -- the feed's structure most likely changed, or the fetch was blocked/truncated. No data was written."
      );
    }

    const now = new Date();
    const ingestionRunId = crypto.randomUUID();
    const changeInputs: { screeningEntityId: string; changeType: ReferenceDataChangeType }[] = [];

    for (let i = 0; i < designations.length; i += UPSERT_BATCH_SIZE) {
      const batch = designations.slice(i, i + UPSERT_BATCH_SIZE);
      const results = await Promise.all(
        batch.map((entry) => {
          const data = mapUkslDesignation(entry);
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
              agency: UKSL_AGENCY,
              publicationStatus: "PUBLISHED",
              publishedAt: now,
              supersededAt: null,
              sourcePublishedAt: dateGenerated ?? undefined,
            },
            create: {
              entityHash: data.entityHash,
              sourceList: UKSL_SOURCE_LIST,
              entityType: data.entityType,
              name: data.name,
              alternateNames: data.alternateNames,
              address: data.address,
              city: data.city,
              country: data.country,
              citation: data.citation,
              remarks: data.remarks,
              programCodes: data.programCodes,
              agency: UKSL_AGENCY,
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
      where: { sourceList: UKSL_SOURCE_LIST, publicationStatus: "PUBLISHED", publishedAt: { lt: now } },
      select: { id: true },
    });
    const supersedeResult = await db.screeningEntity.updateMany({
      where: { sourceList: UKSL_SOURCE_LIST, publicationStatus: "PUBLISHED", publishedAt: { lt: now } },
      data: { publicationStatus: "SUPERSEDED", supersededAt: new Date() },
    });

    await recordReferenceDataChanges(ingestionRunId, [
      ...changeInputs.map((c) => ({
        screeningEntityId: c.screeningEntityId,
        sourceList: UKSL_SOURCE_LIST,
        changeType: c.changeType,
        datasetId: UKSL_DATASET_ID,
      })),
      ...aboutToSupersede.map((e) => ({
        screeningEntityId: e.id,
        sourceList: UKSL_SOURCE_LIST,
        changeType: "SUPERSEDED" as ReferenceDataChangeType,
        datasetId: UKSL_DATASET_ID,
      })),
    ]);

    await syncSearchTokensForEntities(changeInputs.map((c) => c.screeningEntityId));

    return { parsedCount: designations.length, supersededCount: supersedeResult.count, dateGenerated };
  }
}
