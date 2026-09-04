import { db } from "@/lib/db";
import { SaxesParser, SaxesTagPlain } from "saxes";
import { computeEntityHash } from "@/modules/screening/entityHash";
import { recordReferenceDataChanges } from "@/modules/screening/referenceDataChangeTracking";
import { syncSearchTokensForEntities } from "@/modules/screening/searchTokenSync";
import type { ReferenceDataChangeType } from "@prisma/client";

const UNSC_DATASET_ID = "un-security-council-sanctions";
const UNSC_SOURCE_LIST = "UNSC";
const UNSC_AGENCY = "United Nations Security Council";

// scsanctions.un.org is fronted by CloudFront and, at last check, is prone
// to transient 302/404 responses on the very first request from a given
// client -- a retry with a normal browser User-Agent and redirect-following
// resolves it. main.un.org's own listing page links this exact URL as the
// current English-language consolidated export.
const UNSC_XML_URL = "https://scsanctions.un.org/resources/xml/en/consolidated.xml";

const FETCH_RETRIES = 3;

// The live consolidated list has run to 700+ individuals and 250+ entities
// for years. No explicit reported-total element exists in this feed, so
// (like UKSL/EUC) a floor-based circuit breaker stands in for an exact count.
const MIN_EXPECTED_RECORDS = 500;

const UPSERT_BATCH_SIZE = 8;

interface ParsedAlias {
  aliasName?: string;
}

interface ParsedAddress {
  parts: string[];
  country?: string;
}

interface ParsedUnRecord {
  dataId?: string;
  referenceNumber?: string;
  unListType?: string;
  firstName?: string;
  secondName?: string;
  thirdName?: string;
  fourthName?: string;
  comments?: string;
  isEntity: boolean;
  aliases: ParsedAlias[];
  addresses: ParsedAddress[];
  birthYears: string[];
}

export interface UnscIngestResult {
  parsedCount: number;
  supersededCount: number;
}

export interface ParsedUnscFeed {
  records: ParsedUnRecord[];
  dateGenerated: Date | null;
}

/**
 * Streams the UN Security Council Consolidated List XML
 * (<CONSOLIDATED_LIST><INDIVIDUALS>/<ENTITIES>) into parsed entries.
 * Decoupled from `fetch` for unit testing against a trimmed fixture,
 * mirroring parseOfacXmlStream / parseUkslXmlStream / parseEucXmlStream.
 */
export async function parseUnscXmlStream(body: ReadableStream<Uint8Array>): Promise<ParsedUnscFeed> {
  const records: ParsedUnRecord[] = [];
  let dateGenerated: Date | null = null;

  const parser = new SaxesParser();
  const stack: string[] = [];
  let textBuf = "";
  let current: ParsedUnRecord | null = null;
  let currentAlias: ParsedAlias | null = null;
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
    if (node.name === "CONSOLIDATED_LIST") {
      const raw = node.attributes.dateGenerated;
      const d = raw ? new Date(raw) : null;
      dateGenerated = d && !Number.isNaN(d.getTime()) ? d : null;
    } else if (node.name === "INDIVIDUAL") {
      current = { isEntity: false, aliases: [], addresses: [], birthYears: [] };
    } else if (node.name === "ENTITY") {
      current = { isEntity: true, aliases: [], addresses: [], birthYears: [] };
    } else if ((node.name === "INDIVIDUAL_ALIAS" || node.name === "ENTITY_ALIAS") && current) {
      currentAlias = {};
    } else if ((node.name === "INDIVIDUAL_ADDRESS" || node.name === "ENTITY_ADDRESS") && current) {
      currentAddress = { parts: [] };
    }
  });

  parser.on("closetag", (node: SaxesTagPlain) => {
    const tag = node.name;
    const parentTag = stack[stack.length - 2];
    const value = textBuf.trim();

    if (currentAlias && (parentTag === "INDIVIDUAL_ALIAS" || parentTag === "ENTITY_ALIAS")) {
      if (tag === "ALIAS_NAME" && value) currentAlias.aliasName = value;
    } else if ((tag === "INDIVIDUAL_ALIAS" || tag === "ENTITY_ALIAS") && current) {
      if (currentAlias) current.aliases.push(currentAlias);
      currentAlias = null;
    } else if (currentAddress && (parentTag === "INDIVIDUAL_ADDRESS" || parentTag === "ENTITY_ADDRESS")) {
      if (tag === "COUNTRY" && value) currentAddress.country = value;
      else if ((tag === "STREET" || tag === "CITY" || tag === "STATE_PROVINCE") && value) currentAddress.parts.push(value);
    } else if ((tag === "INDIVIDUAL_ADDRESS" || tag === "ENTITY_ADDRESS") && current) {
      if (currentAddress) current.addresses.push(currentAddress);
      currentAddress = null;
    } else if (tag === "YEAR" && parentTag === "INDIVIDUAL_DATE_OF_BIRTH" && current) {
      if (value) current.birthYears.push(value);
    } else if (current && (parentTag === "INDIVIDUAL" || parentTag === "ENTITY")) {
      if (tag === "DATAID") current.dataId = value;
      else if (tag === "REFERENCE_NUMBER") current.referenceNumber = value;
      else if (tag === "UN_LIST_TYPE") current.unListType = value;
      else if (tag === "FIRST_NAME") current.firstName = value;
      else if (tag === "SECOND_NAME") current.secondName = value;
      else if (tag === "THIRD_NAME") current.thirdName = value;
      else if (tag === "FOURTH_NAME") current.fourthName = value;
      else if (tag === "COMMENTS1") current.comments = value;
    } else if ((tag === "INDIVIDUAL" || tag === "ENTITY") && current) {
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

  return { records, dateGenerated };
}

export function mapUnscRecord(entry: ParsedUnRecord) {
  const entityType = entry.isEntity ? "ENTITY" : "INDIVIDUAL";
  const name = [entry.firstName, entry.secondName, entry.thirdName, entry.fourthName].filter(Boolean).join(" ") || "Unknown Entity";
  const alternateNames = entry.aliases.map((a) => a.aliasName).filter((n): n is string => Boolean(n && n.length > 0));

  const primaryAddress = entry.addresses[0];
  const address = primaryAddress && primaryAddress.parts.length > 0 ? primaryAddress.parts.join(", ") : null;
  const country = primaryAddress?.country || null;

  const remarksParts: string[] = [];
  if (entry.comments) remarksParts.push(entry.comments);
  if (entry.birthYears.length > 0) remarksParts.push(`Birth year(s): ${entry.birthYears.join(" | ")}`);
  for (const extra of entry.addresses.slice(1)) {
    const line = [...extra.parts, extra.country].filter(Boolean).join(", ");
    if (line) remarksParts.push(`Additional address: ${line}`);
  }

  return {
    entityHash: computeEntityHash(UNSC_SOURCE_LIST, name, country || undefined),
    entityType,
    name,
    alternateNames,
    address,
    city: null as string | null,
    country,
    citation: entry.referenceNumber || null,
    remarks: remarksParts.length ? remarksParts.join(" | ") : null,
    programCodes: entry.unListType ? [entry.unListType] : [],
  };
}

export class UnSecurityCouncilSanctionsIngestionService {
  private static async parseUnscXml(): Promise<ParsedUnscFeed> {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
      try {
        const res = await fetch(UNSC_XML_URL, { headers: { "User-Agent": "Mozilla/5.0" }, redirect: "follow" });
        if (!res.ok || !res.body) {
          throw new Error(`UN Security Council Consolidated List source returned HTTP ${res.status}.`);
        }
        return await parseUnscXmlStream(res.body);
      } catch (err) {
        lastError = err;
      }
    }
    throw new Error(
      `UN Security Council Consolidated List fetch failed after ${FETCH_RETRIES} attempts: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }. Ingestion aborted.`
    );
  }

  static async fetchAndIngest(): Promise<UnscIngestResult> {
    const { records } = await this.parseUnscXml();

    if (records.length < MIN_EXPECTED_RECORDS) {
      throw new Error(
        `UN Security Council Consolidated List parse returned only ${records.length} records (expected at least ${MIN_EXPECTED_RECORDS}). ` +
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
          const data = mapUnscRecord(entry);
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
              agency: UNSC_AGENCY,
              publicationStatus: "PUBLISHED",
              publishedAt: now,
              supersededAt: null,
            },
            create: {
              entityHash: data.entityHash,
              sourceList: UNSC_SOURCE_LIST,
              entityType: data.entityType,
              name: data.name,
              alternateNames: data.alternateNames,
              address: data.address,
              city: data.city,
              country: data.country,
              citation: data.citation,
              remarks: data.remarks,
              programCodes: data.programCodes,
              agency: UNSC_AGENCY,
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
      where: { sourceList: UNSC_SOURCE_LIST, publicationStatus: "PUBLISHED", publishedAt: { lt: now } },
      select: { id: true },
    });
    const supersedeResult = await db.screeningEntity.updateMany({
      where: { sourceList: UNSC_SOURCE_LIST, publicationStatus: "PUBLISHED", publishedAt: { lt: now } },
      data: { publicationStatus: "SUPERSEDED", supersededAt: new Date() },
    });

    await recordReferenceDataChanges(ingestionRunId, [
      ...changeInputs.map((c) => ({
        screeningEntityId: c.screeningEntityId,
        sourceList: UNSC_SOURCE_LIST,
        changeType: c.changeType,
        datasetId: UNSC_DATASET_ID,
      })),
      ...aboutToSupersede.map((e) => ({
        screeningEntityId: e.id,
        sourceList: UNSC_SOURCE_LIST,
        changeType: "SUPERSEDED" as ReferenceDataChangeType,
        datasetId: UNSC_DATASET_ID,
      })),
    ]);

    await syncSearchTokensForEntities(changeInputs.map((c) => c.screeningEntityId));

    return { parsedCount: records.length, supersededCount: supersedeResult.count };
  }
}
