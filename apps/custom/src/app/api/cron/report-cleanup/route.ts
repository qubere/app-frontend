import { NextResponse } from "next/server";
import { withCronRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { deleteStoredObject } from "@/lib/storage";

export const maxDuration = 60;

async function handleCleanup() {
  const expired = await db.reportArtifact.findMany({
    where: { expiresAt: { lt: new Date() }, retentionHold: false, deletedAt: null },
    take: 500,
  });

  let deleted = 0;
  let errors = 0;

  for (const artifact of expired) {
    const ok = await deleteStoredObject(artifact.storageKey);
    if (!ok) {
      errors += 1;
      continue;
    }
    await db.reportArtifact.update({ where: { id: artifact.id }, data: { deletedAt: new Date() } });
    deleted += 1;
  }

  return { deleted, errors, scanned: expired.length };
}

export const GET = withCronRoute(async ({ requestId }) => {
  const result = await handleCleanup();
  return NextResponse.json({ status: "SUCCESS", requestId, ...result });
});

export const POST = withCronRoute(async ({ requestId }) => {
  const result = await handleCleanup();
  return NextResponse.json({ status: "SUCCESS", requestId, ...result });
});
