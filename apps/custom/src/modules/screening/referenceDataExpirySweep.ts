// Reference Data Changes -- expiry sweep.
//
// None of the OFAC/BIS/UFLPA/Dow Jones ingestion services model "this
// specific entity's own expirationDate has passed" as a change -- each of
// them only ever supersedes on (a) sweep-by-omission (OFAC/BIS/UFLPA full
// loads: a PUBLISHED row missing from today's feed) or (b) an explicit
// delist/ActiveStatus flip delivered by the source (Dow Jones delta). A
// denial-order record with a real expirationDate that simply elapses while
// still present (and still "Active") in every subsequent feed would
// otherwise never transition and would keep matching forward RPS/RDPS
// indefinitely past its own effective window.
//
// This sweep is intentionally cross-cutting (not owned by any one
// ingestion service) and additive-only: it only ever moves a PUBLISHED row
// to SUPERSEDED when *that row's own* expirationDate has passed, never
// touches DRAFT rows, and writes a ReferenceDataChangeSet row with
// changeType EXPIRED (not SUPERSEDED-by-omission) so reference-data-health
// and the Reference Changes UI can distinguish the two. Like every other
// ingestion service, the ReferenceDataChangeSet write is best-effort and
// must never be allowed to undo the supersede that already succeeded.
import { db } from "@/lib/db";
import crypto from "crypto";
import { recordReferenceDataChanges } from "./referenceDataChangeTracking";

// Distinct from every provider-owned dataset id: which origin dataset an
// expired entity came from is often ambiguous (see rdpsQueryService.ts's
// getReferenceDataHealth -- OFAC's and BIS CSL's "SDN" sourceLists can
// resolve to the same entityHash), so expiry is tracked as its own
// dataset/health row rather than misattributed to one ingestion pipeline.
export const EXPIRY_SWEEP_DATASET_ID = "reference-data-expiry-sweep";

const SWEEP_BATCH_SIZE = 500;

export interface ExpirySweepResult {
  entitiesExpired: number;
  ingestionRunId: string | null;
}

/**
 * Supersedes every currently-PUBLISHED ScreeningEntity whose expirationDate
 * has passed as of `now`, and records one EXPIRED ReferenceDataChangeSet row
 * per entity so the RDPS delta-impact dispatcher re-screens any Party that
 * matched it. Processes in bounded batches so a large backlog (e.g. first
 * run after this sweep is introduced) can't run unbounded in one call.
 */
export async function sweepExpiredReferenceData(now: Date = new Date()): Promise<ExpirySweepResult> {
  let entitiesExpired = 0;
  let ingestionRunId: string | null = null;

  for (;;) {
    const candidates = await db.screeningEntity.findMany({
      where: { publicationStatus: "PUBLISHED", expirationDate: { lte: now } },
      select: { id: true, sourceList: true, provider: true },
      take: SWEEP_BATCH_SIZE,
    });
    if (candidates.length === 0) break;

    const ids = candidates.map((c) => c.id);
    await db.screeningEntity.updateMany({
      where: { id: { in: ids } },
      data: { publicationStatus: "SUPERSEDED", supersededAt: now },
    });

    ingestionRunId ??= crypto.randomUUID();
    await recordReferenceDataChanges(
      ingestionRunId,
      candidates.map((c) => ({
        screeningEntityId: c.id,
        sourceList: c.sourceList,
        provider: c.provider,
        changeType: "EXPIRED",
        datasetId: EXPIRY_SWEEP_DATASET_ID,
      }))
    );

    entitiesExpired += candidates.length;

    // A batch smaller than the page size means this was the last page.
    if (candidates.length < SWEEP_BATCH_SIZE) break;
  }

  return { entitiesExpired, ingestionRunId };
}
