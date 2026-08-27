// Continuous Party Monitoring (RDPS) -- shared write path for
// ReferenceDataChangeSet rows, called by each ingestion service immediately
// after its existing publish/supersede step succeeds. Deliberately
// best-effort: a failure here must never roll back or abort the underlying
// reference-data ingestion, which has already succeeded. A missed write is
// exactly what the recall validator's daily sampling exists to catch.
import { db } from "@qubere/db";
import type { ReferenceDataChangeType } from "@prisma/client";

export interface ChangeSetInput {
  screeningEntityId: string;
  sourceList: string;
  provider?: string | null;
  changeType: ReferenceDataChangeType;
  datasetId: string;
}

export async function recordReferenceDataChanges(
  ingestionRunId: string,
  changes: ChangeSetInput[]
): Promise<void> {
  if (changes.length === 0) return;

  try {
    await db.referenceDataChangeSet.createMany({
      data: changes.map((c) => ({
        screeningEntityId: c.screeningEntityId,
        sourceList: c.sourceList,
        provider: c.provider ?? null,
        changeType: c.changeType,
        datasetId: c.datasetId,
        ingestionRunId,
      })),
    });
  } catch (err) {
    console.error(
      `[rdps] Failed to write ${changes.length} ReferenceDataChangeSet row(s) for ingestionRunId ${ingestionRunId}:`,
      err
    );
  }
}
