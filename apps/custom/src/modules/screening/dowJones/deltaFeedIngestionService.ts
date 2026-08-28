import crypto from "crypto";
import { parseSanctionsReferencesDictionary, type SanctionsReferenceDictionary } from "./dictionaryParser";
import { transformEntity } from "./entityTransformer";
import { recordReferenceDataChanges } from "../referenceDataChangeTracking";
import { parseDowJonesEntities, upsertDowJonesEntity, UPSERT_BATCH_SIZE, PROVIDER } from "./fullFeedIngestionService";

// Distinct from fullFeedIngestionService's DOW_JONES_DATASET_ID so RDPS /
// the reference-data health view can tell a delta run's ReferenceDataChangeSet
// rows and DatasetRefreshLog entries apart from a full-feed run's. Matches
// the "dow-jones-djrc-delta" id the manual seed script
// (run-dow-jones-delta-load.ts) already uses for DatasetRefreshLog rows.
export const DOW_JONES_DELTA_DATASET_ID = "dow-jones-djrc-delta";

export interface DowJonesDeltaLoadOptions {
  /**
   * Independently-known Entity count for this delta file (e.g. a pre-count
   * pass), used the same way as the full-feed loader's circuit breaker.
   * Delta files are small, so this is optional -- proceeding without it only
   * loses the extra completeness signal, never blocks the run.
   */
  expectedEntityCount?: number;
}

export interface DowJonesDeltaLoadResult {
  feedDate: Date;
  feedType: string;
  entitiesParsed: number;
  entitiesCreated: number;
  entitiesUpdated: number;
  /** Subset of entitiesUpdated whose ActiveStatus flipped away from "Active" this run -- i.e. a delist/removal delivered via delta. */
  entitiesSuperseded: number;
  associationsCount: number;
  personRecordsEncountered: number;
  unknownReferenceNames: string[];
  completenessVerified: boolean;
}

/**
 * Guards against running the delta ingester over what is actually a full
 * feed (or vice versa): the DJRC file's own `<PFA type="...">` attribute
 * says which one it is, so trust that over the caller's assumption. A full
 * file mistakenly run through the delta path would look "successful" while
 * silently never sweeping delisted entities the way ingestDowJonesFullFeed's
 * (absent, by design) full-population semantics would require -- so this
 * fails loudly instead of ingesting.
 */
export function assertDeltaFeedType(feedType: string): void {
  const normalized = feedType.trim().toLowerCase();
  if (normalized === "full") {
    throw new Error(
      `Dow Jones file declares PFA type="${feedType}", not a delta feed. Refusing to run the delta ingester against a full-feed file -- use ingestDowJonesFullFeed instead.`
    );
  }
}

/**
 * Delta-load ingestion of one Dow Jones DJRC_SOR_XML delta file. Unlike
 * ingestDowJonesFullFeed, a delta file lists ONLY the entities that changed
 * (added, updated, or delisted -- delisted entities arrive with
 * ActiveStatus != "Active", which entityTransformer already maps to
 * publicationStatus = SUPERSEDED) since the last full or delta run. Because
 * the file is inherently a diff, there is no "entity absent from this file
 * implies delisted" sweep step here (unlike ofacSdnIngestionService's
 * full-load supersede-by-omission) -- omission from a delta file means
 * "unchanged", not "removed".
 */
export async function ingestDowJonesDeltaFeed(
  filePath: string,
  options: DowJonesDeltaLoadOptions = {}
): Promise<DowJonesDeltaLoadResult> {
  const dictionary: SanctionsReferenceDictionary = await parseSanctionsReferencesDictionary(filePath);
  const { feedDate, feedType, entities, associationsCount, personRecordsEncountered } =
    await parseDowJonesEntities(filePath);

  assertDeltaFeedType(feedType);

  if (entities.length === 0) {
    throw new Error("Dow Jones delta feed parse produced 0 Entity records. Refusing to run an empty delta ingest.");
  }

  const completenessVerified = options.expectedEntityCount !== undefined;
  if (completenessVerified && entities.length !== options.expectedEntityCount) {
    throw new Error(
      `Dow Jones delta completeness check failed: parsed ${entities.length} entities but expected ${options.expectedEntityCount}. Ingestion aborted -- no data was written.`
    );
  }
  if (!completenessVerified) {
    console.warn(
      "[dow-jones-delta] No expectedEntityCount supplied -- proceeding without an independent completeness check."
    );
  }

  let created = 0;
  let updated = 0;
  let superseded = 0;
  const unknownReferenceNames = new Set<string>();
  const ingestionRunId = crypto.randomUUID();
  const changeInputs: { screeningEntityId: string; sourceList: string; changeType: "ADDED" | "UPDATED" | "SUPERSEDED" }[] = [];

  for (let i = 0; i < entities.length; i += UPSERT_BATCH_SIZE) {
    const batch = entities.slice(i, i + UPSERT_BATCH_SIZE);
    await Promise.all(
      batch.map(async (raw) => {
        const mapped = transformEntity(raw, dictionary, feedDate, feedType);
        for (const n of mapped.unknownReferenceNames) unknownReferenceNames.add(n);

        const writeResult = await upsertDowJonesEntity(mapped);
        const delisted = !writeResult.wasCreated && mapped.publicationStatus === "SUPERSEDED";

        if (writeResult.wasCreated) {
          created++;
        } else {
          updated++;
          if (delisted) superseded++;
        }

        // A delta-delivered delist (ActiveStatus flips away from "Active")
        // must record changeType SUPERSEDED, matching the full-load
        // ingestion services' sweep-by-omission convention, so
        // reference-data-health and RDPS's delta-impact dispatcher can tell
        // "this entity was just removed/delisted" apart from an ordinary
        // field update -- recording it as UPDATED would silently mask the
        // delist from anything downstream that filters/reports by changeType.
        changeInputs.push({
          screeningEntityId: writeResult.id,
          sourceList: writeResult.sourceList,
          changeType: writeResult.wasCreated ? "ADDED" : delisted ? "SUPERSEDED" : "UPDATED",
        });
      })
    );
  }

  if (personRecordsEncountered > 0) {
    console.warn(
      `[dow-jones-delta] Encountered ${personRecordsEncountered} <Person> record(s) -- this file was expected to contain none. They were skipped (Person transformation is untested).`
    );
  }
  if (associationsCount > 0) {
    console.log(`[dow-jones-delta] Associations section contained ${associationsCount} record(s) -- not modeled/stored (documented MVP gap).`);
  }

  await recordReferenceDataChanges(
    ingestionRunId,
    changeInputs.map((c) => ({
      screeningEntityId: c.screeningEntityId,
      sourceList: c.sourceList,
      provider: PROVIDER,
      changeType: c.changeType,
      datasetId: DOW_JONES_DELTA_DATASET_ID,
    }))
  );

  return {
    feedDate,
    feedType,
    entitiesParsed: entities.length,
    entitiesCreated: created,
    entitiesUpdated: updated,
    entitiesSuperseded: superseded,
    associationsCount,
    personRecordsEncountered,
    unknownReferenceNames: Array.from(unknownReferenceNames),
    completenessVerified,
  };
}
