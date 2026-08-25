import fs from "fs";
import { SaxesParser, SaxesTagPlain } from "saxes";
import { db } from "@qubere/db";
import { parseSanctionsReferencesDictionary, type SanctionsReferenceDictionary } from "./dictionaryParser";
import { transformEntity, type RawEntity, type RawNameDetail, type RawCompanyDetail, type RawCountryDetail, type RawIdNumberType, type RawSanctionsReference, type RawSource } from "./entityTransformer";

// Same batch size as ofacSdnIngestionService.ts -- tuned against the
// Supabase pgbouncer pooler's connection_limit=10; a larger batch blows
// past the pool and hangs.
const UPSERT_BATCH_SIZE = 8;
const PROVIDER = "DOW_JONES" as const;

// Transient network/pool errors seen against the Supabase pgbouncer pooler
// over a long-running (multi-hour, ~62k-entity) batch -- e.g. a momentary
// P1001 "can't reach database server" blip. Retrying the whole entity's
// write chain from scratch is safe: the entity upsert is keyed on
// (provider, providerRecordId) and child rows are delete-then-recreate, both
// idempotent, so a partial attempt followed by a clean retry never
// duplicates or corrupts data.
const TRANSIENT_PRISMA_ERROR_CODES = new Set(["P1001", "P1017", "P2024"]);
const MAX_TRANSIENT_RETRIES = 5;

async function withTransientRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const code = (err as { code?: string } | undefined)?.code;
      if (!code || !TRANSIENT_PRISMA_ERROR_CODES.has(code) || attempt >= MAX_TRANSIENT_RETRIES) {
        throw err;
      }
      const delayMs = Math.min(1000 * 2 ** (attempt - 1), 15000);
      console.warn(
        `[dow-jones] transient DB error (${code}) on ${label} -- retry ${attempt}/${MAX_TRANSIENT_RETRIES} in ${delayMs}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

// Resume support: a crash/kill mid-run (network loss outlasting the retry
// budget above, process kill, machine restart) currently means the next run
// has to re-walk every already-completed entity as a wasted findUnique+update
// round trip before reaching new ground -- costly at this file's scale
// (tens of thousands of entities, each several DB round trips). This
// progress file records providerRecordIds that have already been fully
// written (entity row + all four child tables) so a resumed run can skip
// their DB work entirely. It is purely a local resume cursor: it never
// substitutes for the (provider, providerRecordId) unique constraint, which
// remains the actual source of truth for what has been persisted.
export function progressFilePath(sourceFilePath: string): string {
  return `${sourceFilePath}.dow-jones-progress.ndjson`;
}

export function loadProgress(sourceFilePath: string): Set<string> {
  const p = progressFilePath(sourceFilePath);
  if (!fs.existsSync(p)) return new Set();
  return new Set(
    fs
      .readFileSync(p, "utf-8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
  );
}

// Synchronous and append-only: safe under this module's concurrency because
// Node is single-threaded -- concurrent entity-processing tasks interleave on
// microtask boundaries, so no two appendFileSync calls are ever in flight at
// once. Append-only also means a crash mid-write leaves prior lines intact.
export function markProgress(sourceFilePath: string, providerRecordId: string): void {
  fs.appendFileSync(progressFilePath(sourceFilePath), `${providerRecordId}\n`);
}

export function clearProgress(sourceFilePath: string): void {
  const p = progressFilePath(sourceFilePath);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

export interface DowJonesFullLoadOptions {
  /**
   * Independently-known total Entity count for this file (e.g. from a
   * pre-count pass over the raw file) used as a hard circuit breaker, the
   * same role OFAC's own Record_Count element plays. Ingestion aborts with
   * nothing written if the parsed count doesn't match. Omit only when no
   * independent count is available -- the run still proceeds, but logs a
   * warning that completeness could not be verified.
   */
  expectedEntityCount?: number;
}

export interface DowJonesFullLoadResult {
  feedDate: Date;
  feedType: string;
  entitiesParsed: number;
  entitiesCreated: number;
  entitiesUpdated: number;
  /** Entities whose DB write was skipped because a resume progress file showed them already fully written by a prior (interrupted) run of this same file. */
  entitiesSkippedResume: number;
  associationsCount: number;
  personRecordsEncountered: number;
  unknownReferenceNames: string[];
  entitiesWithMissingCountry: number;
  completenessVerified: boolean;
}

function parsePfaDate(raw: string | undefined): Date {
  // PFA/@date is "YYYYMMDDHHMM", e.g. "202608232359".
  const m = raw ? /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(raw) : null;
  if (!m) return new Date();
  const [, yyyy, mm, dd, hh, min] = m;
  return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min)));
}

interface ParsedFeed {
  feedDate: Date;
  feedType: string;
  entities: RawEntity[];
  associationsCount: number;
  personRecordsEncountered: number;
}

/**
 * Streams the full Dow Jones file once (never buffers the raw 838MB text)
 * and collects every `<Entity>` into a small in-memory RawEntity, mirroring
 * ofacSdnIngestionService.ts's parse-fully-then-write pattern: the parsed
 * objects are what stay in memory, not the source XML.
 */
async function parseDowJonesEntities(filePath: string): Promise<ParsedFeed> {
  const entities: RawEntity[] = [];
  let feedDate = new Date();
  let feedType = "full";
  let associationsCount = 0;
  let personRecordsEncountered = 0;

  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
    const parser = new SaxesParser();
    const stack: string[] = [];
    let textBuf = "";

    let currentEntity: RawEntity | null = null;
    let currentNameDetail: RawNameDetail | null = null;
    let currentCompanyDetail: RawCompanyDetail | null = null;
    let currentCountryDetail: RawCountryDetail | null = null;
    let currentIdNumberType: RawIdNumberType | null = null;
    let currentSanctionsReference: RawSanctionsReference | null = null;
    let currentSourceDescription: RawSource | null = null;
    let finished = false;

    function finish(err?: Error) {
      if (finished) return;
      finished = true;
      stream.destroy();
      if (err) reject(err);
      else resolve();
    }

    parser.on("error", (e) => finish(e));
    parser.on("text", (t) => {
      textBuf += t;
    });

    parser.on("opentag", (node: SaxesTagPlain) => {
      stack.push(node.name);
      textBuf = "";
      const parentTag = stack[stack.length - 2];

      if (node.name === "PFA") {
        feedDate = parsePfaDate(node.attributes.date as string | undefined);
        feedType = (node.attributes.type as string | undefined) || "full";
      } else if (node.name === "Entity") {
        currentEntity = { id: "", names: [], companies: [], countries: [], idNumbers: [], references: [], sources: [] };
      } else if (node.name === "Person") {
        personRecordsEncountered++;
      } else if (node.name === "NameDetails") {
        currentNameDetail = {};
      } else if (node.name === "CompanyDetails") {
        currentCompanyDetail = {};
      } else if (node.name === "CountryDetails") {
        currentCountryDetail = {};
      } else if (node.name === "IDNumberTypes") {
        currentIdNumberType = {};
      } else if (node.name === "SanctionsReferences" && currentEntity) {
        currentSanctionsReference = {};
      } else if (node.name === "SourceDescription") {
        currentSourceDescription = {};
      } else if (parentTag === "Associations") {
        associationsCount++;
      }
    });

    parser.on("closetag", (node: SaxesTagPlain) => {
      const tag = node.name;
      const parentTag = stack[stack.length - 2];
      const value = textBuf.trim();

      if (currentNameDetail && parentTag === "NameDetails") {
        if (tag === "SubId") currentNameDetail.subId = value;
        else if (tag === "NameType") currentNameDetail.nameType = value;
        else if (tag === "EntityName") currentNameDetail.entityName = value;
        else if (tag === "FullName") currentNameDetail.fullName = value;
        else if (tag === "SingleStringName") currentNameDetail.singleStringName = value;
      } else if (tag === "NameDetails" && currentEntity && currentNameDetail) {
        currentEntity.names.push(currentNameDetail);
        currentNameDetail = null;
      } else if (currentCompanyDetail && parentTag === "CompanyDetails") {
        if (tag === "SubId") currentCompanyDetail.subId = value;
        else if (tag === "AddressLine") currentCompanyDetail.addressLine = value;
        else if (tag === "AddressCity") currentCompanyDetail.addressCity = value;
        else if (tag === "AddressCountry") currentCompanyDetail.addressCountry = value;
      } else if (tag === "CompanyDetails" && currentEntity && currentCompanyDetail) {
        currentEntity.companies.push(currentCompanyDetail);
        currentCompanyDetail = null;
      } else if (currentCountryDetail && parentTag === "CountryDetails") {
        if (tag === "SubId") currentCountryDetail.subId = value;
        else if (tag === "CountryType") currentCountryDetail.countryType = value;
        else if (tag === "CountryValue") currentCountryDetail.countryValue = value;
      } else if (tag === "CountryDetails" && currentEntity && currentCountryDetail) {
        currentEntity.countries.push(currentCountryDetail);
        currentCountryDetail = null;
      } else if (currentIdNumberType && parentTag === "IDNumberTypes") {
        if (tag === "SubId") currentIdNumberType.subId = value;
        else if (tag === "IDType") currentIdNumberType.idType = value;
        else if (tag === "IDValue") currentIdNumberType.idValue = value;
        else if (tag === "IDnotes") currentIdNumberType.idNotes = value;
      } else if (tag === "IDNumberTypes" && currentEntity && currentIdNumberType) {
        currentEntity.idNumbers.push(currentIdNumberType);
        currentIdNumberType = null;
      } else if (currentSanctionsReference && parentTag === "SanctionsReferences") {
        if (tag === "SubId") currentSanctionsReference.subId = value;
        else if (tag === "SinceMonth") currentSanctionsReference.sinceMonth = value;
        else if (tag === "ToMonth") currentSanctionsReference.toMonth = value;
        else if (tag === "Reference") currentSanctionsReference.reference = value;
      } else if (tag === "SanctionsReferences" && currentEntity && currentSanctionsReference) {
        currentEntity.references.push(currentSanctionsReference);
        currentSanctionsReference = null;
      } else if (currentSourceDescription && parentTag === "SourceDescription") {
        if (tag === "SubId") currentSourceDescription.subId = value;
        else if (tag === "Source") currentSourceDescription.source = value;
      } else if (tag === "SourceDescription" && currentEntity && currentSourceDescription) {
        currentEntity.sources.push(currentSourceDescription);
        currentSourceDescription = null;
      } else if (currentEntity && parentTag === "Entity") {
        if (tag === "Id") currentEntity.id = value;
        else if (tag === "Date") currentEntity.date = value;
        else if (tag === "ActiveStatus") currentEntity.activeStatus = value;
        else if (tag === "ProfileNotes") currentEntity.profileNotes = value;
      } else if (tag === "Entity" && currentEntity) {
        entities.push(currentEntity);
        currentEntity = null;
        if (entities.length % 5000 === 0) {
          console.log(`[dow-jones] parsed ${entities.length} entities so far...`);
        }
      }

      stack.pop();
      textBuf = "";
    });

    stream.on("data", (chunk) => {
      if (finished) return;
      try {
        parser.write(chunk as string);
      } catch (e) {
        finish(e instanceof Error ? e : new Error(String(e)));
      }
    });
    stream.on("error", (e) => finish(e));
    stream.on("end", () => {
      try {
        parser.close();
        finish();
      } catch (e) {
        finish(e instanceof Error ? e : new Error(String(e)));
      }
    });
  });

  return { feedDate, feedType, entities, associationsCount, personRecordsEncountered };
}

/**
 * Full-load ingestion of one Dow Jones DJRC_SOR_XML file. Purely additive:
 * upserts only rows keyed by (provider="DOW_JONES", providerRecordId) and
 * never touches pre-existing OFAC/BIS/UFLPA ScreeningEntity rows -- there is
 * intentionally no supersede/sweep step here (unlike ofacSdnIngestionService),
 * since this is a first-time load with no prior DOW_JONES rows to supersede.
 */
export async function ingestDowJonesFullFeed(
  filePath: string,
  options: DowJonesFullLoadOptions = {}
): Promise<DowJonesFullLoadResult> {
  const dictionary: SanctionsReferenceDictionary = await parseSanctionsReferencesDictionary(filePath);
  const { feedDate, feedType, entities, associationsCount, personRecordsEncountered } =
    await parseDowJonesEntities(filePath);

  if (entities.length === 0) {
    throw new Error("Dow Jones feed parse produced 0 Entity records. Refusing to run an empty ingest.");
  }

  const completenessVerified = options.expectedEntityCount !== undefined;
  if (completenessVerified && entities.length !== options.expectedEntityCount) {
    throw new Error(
      `Dow Jones completeness check failed: parsed ${entities.length} entities but expected ${options.expectedEntityCount}. Ingestion aborted -- no data was written.`
    );
  }
  if (!completenessVerified) {
    console.warn(
      "[dow-jones] No expectedEntityCount supplied -- proceeding without an independent completeness check."
    );
  }

  let created = 0;
  let updated = 0;
  let skippedResume = 0;
  const unknownReferenceNames = new Set<string>();
  let entitiesWithMissingCountry = 0;

  const alreadyDone = loadProgress(filePath);
  if (alreadyDone.size > 0) {
    console.log(
      `[dow-jones] resume progress file found: ${alreadyDone.size} entities already fully written in a prior run of this file -- their DB writes will be skipped.`
    );
  }

  for (let i = 0; i < entities.length; i += UPSERT_BATCH_SIZE) {
    const batch = entities.slice(i, i + UPSERT_BATCH_SIZE);
    await Promise.all(
      batch.map(async (raw) => {
        const mapped = transformEntity(raw, dictionary, feedDate, feedType);
        for (const n of mapped.unknownReferenceNames) unknownReferenceNames.add(n);
        if (!mapped.country) entitiesWithMissingCountry++;

        if (alreadyDone.has(mapped.providerRecordId)) {
          skippedResume++;
          return;
        }

        const wasCreated = await withTransientRetry(async () => {
          const existing = await db.screeningEntity.findUnique({
            where: { provider_providerRecordId: { provider: PROVIDER, providerRecordId: mapped.providerRecordId } },
            select: { id: true },
          });

          const entityData = {
            entityHash: mapped.entityHash,
            sourceList: mapped.sourceList ?? "DOW_JONES_UNCLASSIFIED",
            entityType: mapped.entityType,
            name: mapped.name,
            alternateNames: mapped.alternateNames,
            address: mapped.address,
            city: mapped.city,
            country: mapped.country,
            programCodes: mapped.programCodes,
            agency: mapped.sourceAuthority,
            publicationStatus: mapped.publicationStatus,
            publishedAt: mapped.publicationStatus === "PUBLISHED" ? new Date() : undefined,
            sourcePublishedAt: mapped.sourceFileDate,
            provider: mapped.provider,
            providerRecordId: mapped.providerRecordId,
            providerUpdatedAt: mapped.providerUpdatedAt,
            sourceAuthority: mapped.sourceAuthority,
            sourceFileDate: mapped.sourceFileDate,
            sourceFileType: mapped.sourceFileType,
            providerMetadata: mapped.providerMetadata as any,
          };

          const screeningEntity = existing
            ? await db.screeningEntity.update({ where: { id: existing.id }, data: entityData })
            : await db.screeningEntity.create({ data: entityData });

          // Child rows are entirely owned by this ingestion (scoped to this
          // one Dow Jones ScreeningEntity's id) -- replacing them on re-run is
          // not a violation of "don't touch existing data", since nothing
          // outside rows this service itself created is deleted.
          await db.$transaction([
            db.screeningEntityAlias.deleteMany({ where: { screeningEntityId: screeningEntity.id } }),
            db.screeningEntityAddress.deleteMany({ where: { screeningEntityId: screeningEntity.id } }),
            db.screeningEntityIdentifier.deleteMany({ where: { screeningEntityId: screeningEntity.id } }),
            db.screeningEntityReference.deleteMany({ where: { screeningEntityId: screeningEntity.id } }),
          ]);

          if (mapped.aliases.length) {
            await db.screeningEntityAlias.createMany({
              data: mapped.aliases.map((a) => ({ ...a, screeningEntityId: screeningEntity.id })),
            });
          }
          if (mapped.addresses.length) {
            await db.screeningEntityAddress.createMany({
              data: mapped.addresses.map((a) => ({ ...a, screeningEntityId: screeningEntity.id })),
            });
          }
          if (mapped.identifiers.length) {
            await db.screeningEntityIdentifier.createMany({
              data: mapped.identifiers.map((idf) => ({ ...idf, screeningEntityId: screeningEntity.id })),
            });
          }
          if (mapped.references.length) {
            await db.screeningEntityReference.createMany({
              data: mapped.references.map((r) => ({ ...r, screeningEntityId: screeningEntity.id })),
            });
          }

          return !existing;
        }, `entity providerRecordId=${mapped.providerRecordId}`);

        if (wasCreated) created++;
        else updated++;
        markProgress(filePath, mapped.providerRecordId);
      })
    );

    if ((i / UPSERT_BATCH_SIZE) % 125 === 0) {
      console.log(`[dow-jones] write phase: ${Math.min(i + UPSERT_BATCH_SIZE, entities.length)}/${entities.length} entities processed (${created} created, ${updated} updated, ${skippedResume} skipped-resume so far)...`);
    }
  }

  if (personRecordsEncountered > 0) {
    console.warn(
      `[dow-jones] Encountered ${personRecordsEncountered} <Person> record(s) -- this file was expected to contain none. They were skipped (Person transformation is untested).`
    );
  }
  if (associationsCount > 0) {
    console.log(`[dow-jones] Associations section contained ${associationsCount} record(s) -- not modeled/stored (documented MVP gap).`);
  }

  // A full run that reaches this point covers every entity in the file
  // (created, updated, or skipped-as-already-done) -- the resume cursor has
  // served its purpose and is cleared so a future load of this same file
  // starts clean rather than skipping stale entries forever.
  clearProgress(filePath);

  return {
    feedDate,
    feedType,
    entitiesParsed: entities.length,
    entitiesCreated: created,
    entitiesUpdated: updated,
    entitiesSkippedResume: skippedResume,
    associationsCount,
    personRecordsEncountered,
    unknownReferenceNames: Array.from(unknownReferenceNames),
    entitiesWithMissingCountry,
    completenessVerified,
  };
}
