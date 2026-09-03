import { db } from "@/lib/db";
import { SaxesParser, SaxesTagPlain } from "saxes";
import { computeEntityHash } from "@/modules/screening/entityHash";
import { recordReferenceDataChanges } from "@/modules/screening/referenceDataChangeTracking";
import { syncSearchTokensForEntities } from "@/modules/screening/searchTokenSync";
import type { ReferenceDataChangeType } from "@prisma/client";

const SECO_DATASET_ID = "seco-sanctions-list";
const SECO_SOURCE_LIST = "SECO";
const SECO_AGENCY = "SECO (Swiss State Secretariat for Economic Affairs)";
const SECO_XML_URL =
  "https://www.sesam.search.admin.ch/sesam-search-web/pages/downloadXmlGesamtliste.xhtml?lang=de&action=downloadXmlGesamtlisteAction";

const FETCH_RETRIES = 3;

// The live consolidated list has run to 13,000+ currently-listed targets
// (14,700+ total <target> elements, ~1,500 of which are de-listed history
// kept for audit trail) for years and only grows. A near-empty parse means
// the feed's structure changed or the fetch was blocked/truncated, not that
// Switzerland de-listed almost everyone. Same floor-based circuit breaker as
// UKSL/EUC/UNSC (this feed carries no explicit reported-total element to
// check exactly).
const MIN_EXPECTED_TARGETS = 8000;

const UPSERT_BATCH_SIZE = 8;

type TargetKind = "individual" | "entity" | "object";

interface ParsedNamePart {
  order: number;
  value: string;
}

interface ParsedName {
  nameType: string;
  lang: string;
  parts: ParsedNamePart[];
}

interface ParsedIdentity {
  main: boolean;
  names: ParsedName[];
  countries: string[];
}

interface ParsedTarget {
  ssid: string;
  kind: TargetKind | null;
  objectType?: string;
  sanctionsSetIds: string[];
  foreignIdentifiers: string[];
  identities: ParsedIdentity[];
  justifications: string[];
  otherInformation: string[];
  // The feed lists modifications for a target most-recent-first as direct
  // children -- the first one encountered is the target's current status.
  latestModificationType: string | null;
}

export interface ParsedSecoFeed {
  targets: ParsedTarget[];
  programKeyBySanctionsSetId: Map<string, string>;
  listDate: string | null;
}

function nameToString(name: ParsedName): string {
  return [...name.parts]
    .sort((a, b) => a.order - b.order)
    .map((p) => p.value)
    .filter(Boolean)
    .join(" ");
}

/**
 * Streams SECO's ~35MB consolidated sanctions XML into parsed targets
 * without buffering the whole file. Handles two structural hazards specific
 * to this feed:
 *  - `<sanctions-program>` blocks (program name/key per sanctions-set-id) all
 *    precede the `<target>` blocks, so the ssid->program-key lookup is built
 *    incrementally and is complete by the time any target needs it.
 *  - Every `<target>`'s `<modification>` history re-embeds a full historical
 *    snapshot (including a nested `<target>`, `<individual>`, etc. with the
 *    same tag names) inside `<added>`/`<removed>`. A generic depth counter
 *    ("skipDepth") starts on the first `<modification>` open tag and skips
 *    all descendant tags -- regardless of name -- until that subtree closes,
 *    so historical duplicates never overwrite the target's current state.
 *
 * Decoupled from `fetch` so this can be unit-tested against a trimmed XML
 * fixture with no network call, mirroring parseUkslXmlStream/parseEucXmlStream.
 */
export async function parseSecoXmlStream(body: ReadableStream<Uint8Array>): Promise<ParsedSecoFeed> {
  const targets: ParsedTarget[] = [];
  const programKeyBySanctionsSetId = new Map<string, string>();
  let listDate: string | null = null;

  const parser = new SaxesParser();
  const stack: string[] = [];
  let textBuf = "";
  let parseError: Error | null = null;

  let skipDepth = 0;

  let currentTarget: ParsedTarget | null = null;
  let currentIdentity: ParsedIdentity | null = null;
  let currentName: ParsedName | null = null;
  let currentNamePart: ParsedNamePart | null = null;

  let currentProgramKeyEng: string | null = null;
  let programKeyLangIsEng = false;

  parser.on("error", (e) => {
    parseError = e;
  });
  parser.on("text", (t) => {
    textBuf += t;
  });

  parser.on("opentag", (node: SaxesTagPlain) => {
    if (skipDepth > 0) {
      skipDepth++;
      stack.push(node.name);
      textBuf = "";
      return;
    }

    if (node.name === "modification") {
      if (currentTarget && currentTarget.latestModificationType === null) {
        currentTarget.latestModificationType = node.attributes["modification-type"] ?? null;
      }
      skipDepth = 1;
      stack.push(node.name);
      textBuf = "";
      return;
    }

    const parentTag = stack[stack.length - 1];
    stack.push(node.name);
    textBuf = "";

    if (node.name === "swiss-sanctions-list") {
      listDate = node.attributes.date ?? null;
    } else if (node.name === "sanctions-program") {
      currentProgramKeyEng = null;
    } else if (node.name === "program-key") {
      programKeyLangIsEng = node.attributes.lang === "eng";
    } else if (node.name === "sanctions-set" && currentProgramKeyEng) {
      const ssid = node.attributes.ssid;
      if (ssid) programKeyBySanctionsSetId.set(ssid, currentProgramKeyEng);
    } else if (node.name === "target") {
      currentTarget = {
        ssid: node.attributes.ssid ?? "",
        kind: null,
        sanctionsSetIds: [],
        foreignIdentifiers: [],
        identities: [],
        justifications: [],
        otherInformation: [],
        latestModificationType: null,
      };
    } else if ((node.name === "individual" || node.name === "entity" || node.name === "object") && currentTarget) {
      currentTarget.kind = node.name;
      if (node.name === "object") currentTarget.objectType = node.attributes["object-type"];
    } else if (node.name === "identity" && currentTarget) {
      currentIdentity = { main: node.attributes.main === "true", names: [], countries: [] };
    } else if (node.name === "name" && currentIdentity) {
      currentName = { nameType: node.attributes["name-type"] ?? "", lang: node.attributes.lang ?? "", parts: [] };
    } else if (node.name === "name-part" && currentName) {
      currentNamePart = { order: Number(node.attributes.order ?? 0), value: "" };
    }

    // parentTag is intentionally unused beyond documenting where each branch
    // above assumes its parent context (identity/target) via the local vars
    // above rather than re-walking the stack.
    void parentTag;
  });

  parser.on("closetag", (node: SaxesTagPlain) => {
    if (skipDepth > 0) {
      skipDepth--;
      stack.pop();
      textBuf = "";
      return;
    }

    const tag = node.name;
    const value = textBuf.trim();

    if (tag === "value" && currentNamePart) {
      currentNamePart.value = value;
    } else if (tag === "name-part" && currentName && currentNamePart) {
      currentName.parts.push(currentNamePart);
      currentNamePart = null;
    } else if (tag === "country" && currentIdentity) {
      if (value) currentIdentity.countries.push(value);
    } else if (tag === "name" && currentIdentity && currentName) {
      currentIdentity.names.push(currentName);
      currentName = null;
    } else if (tag === "identity" && currentTarget && currentIdentity) {
      currentTarget.identities.push(currentIdentity);
      currentIdentity = null;
    } else if (tag === "sanctions-set-id" && currentTarget) {
      if (value) currentTarget.sanctionsSetIds.push(value);
    } else if (tag === "foreign-identifier" && currentTarget) {
      if (value) currentTarget.foreignIdentifiers.push(value);
    } else if (tag === "justification" && currentTarget) {
      if (value) currentTarget.justifications.push(value);
    } else if (tag === "other-information" && currentTarget) {
      if (value) currentTarget.otherInformation.push(value);
    } else if (tag === "program-key" && programKeyLangIsEng) {
      currentProgramKeyEng = value;
      programKeyLangIsEng = false;
    } else if (tag === "target" && currentTarget) {
      targets.push(currentTarget);
      currentTarget = null;
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

  return { targets, programKeyBySanctionsSetId, listDate };
}

export function mapSecoTarget(target: ParsedTarget, programKeyBySanctionsSetId: Map<string, string>) {
  const mainIdentity = target.identities.find((i) => i.main) ?? target.identities[0];
  if (!mainIdentity) return null;

  const primaryName = mainIdentity.names.find((n) => n.nameType === "primary-name") ?? mainIdentity.names[0];
  if (!primaryName) return null;
  const name = nameToString(primaryName);
  if (!name) return null;

  const alternateNames: string[] = [];
  for (const n of mainIdentity.names) {
    if (n === primaryName) continue;
    const s = nameToString(n);
    if (s) alternateNames.push(s);
  }
  for (const identity of target.identities) {
    if (identity === mainIdentity) continue;
    const identityPrimary = identity.names.find((n) => n.nameType === "primary-name") ?? identity.names[0];
    if (!identityPrimary) continue;
    const s = nameToString(identityPrimary);
    if (s) alternateNames.push(s);
  }

  const country = mainIdentity.countries[0] ?? target.identities.flatMap((i) => i.countries)[0] ?? null;

  const entityType =
    target.kind === "individual" ? "INDIVIDUAL" : target.kind === "object" && target.objectType === "vessel" ? "VESSEL" : "ENTITY";

  const programCodes = Array.from(
    new Set(target.sanctionsSetIds.map((id) => programKeyBySanctionsSetId.get(id)).filter((v): v is string => Boolean(v)))
  );

  const remarksParts = [...target.justifications, ...target.otherInformation];

  return {
    entityHash: computeEntityHash(SECO_SOURCE_LIST, name, country || undefined),
    entityType,
    name,
    alternateNames,
    country,
    citation: target.foreignIdentifiers.length ? target.foreignIdentifiers.join(", ") : null,
    remarks: remarksParts.length ? remarksParts.join(" | ") : null,
    programCodes,
  };
}

export interface SecoIngestResult {
  parsedCount: number;
  supersededCount: number;
  listDate: string | null;
}

function parseSecoListDate(value: string | null): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [, yyyy, mm, dd] = m;
  const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  return Number.isNaN(d.getTime()) ? null : d;
}

export class SecoSanctionsListIngestionService {
  private static async parseSecoXml(): Promise<ParsedSecoFeed> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
      try {
        const res = await fetch(SECO_XML_URL, { headers: { "User-Agent": "Mozilla/5.0" }, redirect: "follow" });
        if (!res.ok || !res.body) {
          throw new Error(`SECO sanctions list source returned HTTP ${res.status}.`);
        }
        return await parseSecoXmlStream(res.body);
      } catch (err) {
        lastError = err;
      }
    }
    throw new Error(
      `SECO sanctions list fetch failed after ${FETCH_RETRIES} attempts: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }. Ingestion aborted.`
    );
  }

  static async fetchAndIngest(): Promise<SecoIngestResult> {
    const { targets, programKeyBySanctionsSetId, listDate } = await this.parseSecoXml();

    if (targets.length < MIN_EXPECTED_TARGETS) {
      throw new Error(
        `SECO sanctions list parse returned only ${targets.length} targets (expected at least ${MIN_EXPECTED_TARGETS}). ` +
          "Refusing to treat this as a complete, successful ingest -- the feed's structure most likely changed, or the fetch was blocked/truncated. No data was written."
      );
    }

    // De-listed targets are kept in the feed as history (their current
    // status is the *first* modification's type). Only currently-active
    // targets get upserted here; a previously-published row for a target
    // that has since been de-listed is left untouched by this loop and
    // picked up by the general "not touched this run" supersede pass below.
    const activeTargets = targets.filter((t) => t.kind !== null && t.latestModificationType !== "de-listed");
    const sourcePublishedAt = parseSecoListDate(listDate);

    const now = new Date();
    const ingestionRunId = crypto.randomUUID();
    const changeInputs: { screeningEntityId: string; changeType: ReferenceDataChangeType }[] = [];

    for (let i = 0; i < activeTargets.length; i += UPSERT_BATCH_SIZE) {
      const batch = activeTargets.slice(i, i + UPSERT_BATCH_SIZE);
      const mapped = batch.map((t) => mapSecoTarget(t, programKeyBySanctionsSetId)).filter((m): m is NonNullable<typeof m> => m !== null);
      const results = await Promise.all(
        mapped.map((data) =>
          db.screeningEntity.upsert({
            where: { entityHash: data.entityHash },
            update: {
              entityType: data.entityType,
              name: data.name,
              alternateNames: data.alternateNames,
              country: data.country,
              citation: data.citation,
              remarks: data.remarks,
              programCodes: data.programCodes,
              agency: SECO_AGENCY,
              publicationStatus: "PUBLISHED",
              publishedAt: now,
              supersededAt: null,
              sourcePublishedAt: sourcePublishedAt ?? undefined,
            },
            create: {
              entityHash: data.entityHash,
              sourceList: SECO_SOURCE_LIST,
              entityType: data.entityType,
              name: data.name,
              alternateNames: data.alternateNames,
              country: data.country,
              citation: data.citation,
              remarks: data.remarks,
              programCodes: data.programCodes,
              agency: SECO_AGENCY,
              publicationStatus: "PUBLISHED",
              publishedAt: now,
              sourcePublishedAt: sourcePublishedAt ?? now,
            },
          })
        )
      );
      for (const row of results) {
        changeInputs.push({
          screeningEntityId: row.id,
          changeType: row.createdAt.getTime() === row.updatedAt.getTime() ? "ADDED" : "UPDATED",
        });
      }
    }

    const aboutToSupersede = await db.screeningEntity.findMany({
      where: { sourceList: SECO_SOURCE_LIST, publicationStatus: "PUBLISHED", publishedAt: { lt: now } },
      select: { id: true },
    });
    const supersedeResult = await db.screeningEntity.updateMany({
      where: { sourceList: SECO_SOURCE_LIST, publicationStatus: "PUBLISHED", publishedAt: { lt: now } },
      data: { publicationStatus: "SUPERSEDED", supersededAt: new Date() },
    });

    await recordReferenceDataChanges(ingestionRunId, [
      ...changeInputs.map((c) => ({
        screeningEntityId: c.screeningEntityId,
        sourceList: SECO_SOURCE_LIST,
        changeType: c.changeType,
        datasetId: SECO_DATASET_ID,
      })),
      ...aboutToSupersede.map((e) => ({
        screeningEntityId: e.id,
        sourceList: SECO_SOURCE_LIST,
        changeType: "SUPERSEDED" as ReferenceDataChangeType,
        datasetId: SECO_DATASET_ID,
      })),
    ]);

    await syncSearchTokensForEntities(changeInputs.map((c) => c.screeningEntityId));

    return { parsedCount: activeTargets.length, supersededCount: supersedeResult.count, listDate };
  }
}
