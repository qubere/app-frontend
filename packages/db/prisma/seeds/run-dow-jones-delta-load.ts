/**
 * Delta-load ingestion of one Dow Jones Risk & Compliance DJRC_SOR_XML delta
 * file into ScreeningEntity + its Dow Jones child tables. Points at the real,
 * licensed file on disk rather than transcribing/checking it into the repo.
 *
 * A delta file lists only entities that changed since the last full or delta
 * run (added, updated, or delisted -- delisted entities carry
 * ActiveStatus != "Active" and are marked SUPERSEDED, never deleted). Unlike
 * the full loader, this never sweeps/supersedes by omission: an entity absent
 * from a delta file means "unchanged", not "removed".
 *
 * Run with: npx tsx prisma/seeds/run-dow-jones-delta-load.ts [path-to-xml]
 */
import fs from "fs";
import crypto from "crypto";
import { db } from "../../src/index";
import { ingestDowJonesDeltaFeed } from "../../../../apps/custom/src/modules/screening/dowJones/deltaFeedIngestionService";

const DEFAULT_FILE_PATH = "C:\\C-Drive\\AI-Cust\\RPS\\DJRC_SOR_XML_202608232359_D.xml";

function fileChecksum(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

/**
 * Cheap pre-count of `<Entity ` occurrences, used as the completeness circuit
 * breaker (this feed has no Record_Count-style element of its own). Delta
 * files are far smaller than the full feed, but the same chunked/overlap-safe
 * approach is reused for consistency and to stay correct if a delta file is
 * ever unexpectedly large.
 */
function countEntityTags(filePath: string): number {
  const NEEDLE = "<Entity ";
  const fd = fs.openSync(filePath, "r");
  const CHUNK_SIZE = 64 * 1024 * 1024;
  const buffer = Buffer.alloc(CHUNK_SIZE);
  let count = 0;
  let carry = "";
  try {
    for (;;) {
      const bytesRead = fs.readSync(fd, buffer, 0, CHUNK_SIZE, null);
      if (bytesRead === 0) break;
      const text = carry + buffer.toString("utf-8", 0, bytesRead);
      const matches = text.match(new RegExp(NEEDLE, "g"));
      if (matches) count += matches.length;
      carry = text.slice(-NEEDLE.length + 1);
    }
  } finally {
    fs.closeSync(fd);
  }
  return count;
}

export async function runDowJonesDeltaLoad(filePath: string) {
  const stat = fs.statSync(filePath);
  console.log(`Loading ${filePath} (${(stat.size / 1024 / 1024).toFixed(1)} MB)...`);

  const expectedEntityCount = countEntityTags(filePath);
  console.log(`Pre-count: ${expectedEntityCount} <Entity> tags found.`);

  const checksum = await fileChecksum(filePath);

  const refreshLog = await db.datasetRefreshLog.create({
    data: {
      datasetId: "dow-jones-djrc-delta",
      datasetName: "Dow Jones Risk & Compliance -- Delta Feed",
      triggeredBy: "MANUAL",
      status: "RUNNING",
    },
  });

  try {
    const result = await ingestDowJonesDeltaFeed(filePath, { expectedEntityCount });

    await db.datasetRefreshLog.update({
      where: { id: refreshLog.id },
      data: {
        status: "SUCCESS",
        summary: JSON.stringify({
          fileName: filePath,
          checksum,
          sizeBytes: stat.size,
          feedTimestamp: result.feedDate.toISOString(),
          feedType: result.feedType,
          entitiesCreated: result.entitiesCreated,
          entitiesUpdated: result.entitiesUpdated,
          entitiesSuperseded: result.entitiesSuperseded,
          associationsCount: result.associationsCount,
          personRecordsEncountered: result.personRecordsEncountered,
          unknownReferenceNameCount: result.unknownReferenceNames.length,
        }),
        itemsIngested: result.entitiesParsed,
        sourceReportedTotal: expectedEntityCount,
        sourcePublishDate: result.feedDate,
        completedAt: new Date(),
      },
    });

    console.log("Dow Jones delta load complete:", result);
    if (result.unknownReferenceNames.length) {
      console.log(`Unknown reference-list names encountered (${result.unknownReferenceNames.length}):`, result.unknownReferenceNames);
    }
  } catch (err) {
    await db.datasetRefreshLog.update({
      where: { id: refreshLog.id },
      data: {
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      },
    });
    throw err;
  }
}

if (require.main === module) {
  const filePath = process.argv[2] || DEFAULT_FILE_PATH;
  runDowJonesDeltaLoad(filePath)
    .then(() => db.$disconnect())
    .catch(async (err) => {
      console.error("Dow Jones delta load failed:", err);
      await db.$disconnect();
      process.exit(1);
    });
}
