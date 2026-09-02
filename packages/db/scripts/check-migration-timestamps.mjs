#!/usr/bin/env node
// Fails if two migration folders share the same 14-digit timestamp prefix.
// Prisma applies migrations in lexicographic folder-name order, so a
// collision means the actual apply order silently depends on the migration
// *name* rather than when it was written — a real risk when one of the two
// depends on schema the other creates. This cannot safely rename existing
// migration folders (already-applied names are recorded in
// _prisma_migrations, and renaming would make `prisma migrate deploy` try to
// re-run them against a database that already has that schema) — it only
// stops the count from growing further.

import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Existing collisions as of the 2026-09-02 audit amendment. These predate
// this check and are already applied in shared environments, so their
// folders can't be renamed retroactively — they're grandfathered here.
// This set must never grow; any *new* collision, or a third migration
// landing on an already-grandfathered timestamp, fails the build.
const GRANDFATHERED_TIMESTAMPS = new Set([
  "20260807161054",
  "20260812090000",
  "20260812200000",
  "20260812210000",
  "20260814000000",
  "20260814030000",
  "20260824160000",
  "20260827040000",
  "20260828150000",
]);

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "prisma", "migrations");

const byTimestamp = new Map();
for (const entry of readdirSync(migrationsDir)) {
  const full = join(migrationsDir, entry);
  if (!statSync(full).isDirectory()) continue;
  const match = entry.match(/^(\d{14})/);
  if (!match) continue;
  const ts = match[1];
  if (!byTimestamp.has(ts)) byTimestamp.set(ts, []);
  byTimestamp.get(ts).push(entry);
}

const collisions = [...byTimestamp.entries()].filter(([, names]) => names.length > 1);
const newCollisions = collisions.filter(
  ([ts, names]) => !GRANDFATHERED_TIMESTAMPS.has(ts) || names.length > 2,
);

if (newCollisions.length > 0) {
  console.error(`Found ${newCollisions.length} new migration timestamp collision(s):\n`);
  for (const [ts, names] of newCollisions) {
    console.error(`  ${ts}:`);
    for (const name of names) console.error(`    - ${name}`);
  }
  console.error(
    "\nTwo migrations sharing the exact same 14-digit timestamp apply in an order determined " +
      "by folder name, not creation time. Give the new migration a distinct timestamp " +
      "(bump it by at least one second) before merging.",
  );
  process.exit(1);
}

console.log(
  `OK: ${byTimestamp.size} migrations, no new timestamp collisions ` +
    `(${GRANDFATHERED_TIMESTAMPS.size} pre-existing pairs grandfathered).`,
);
