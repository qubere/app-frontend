/**
 * Actions read-path benchmark.
 *
 * Measures the exception-list query that backs `/app/actions` and
 * `/api/exceptions` against a production-like dataset: p50/p95 latency, SQL
 * query count, rows returned, and serialized payload size.
 *
 * It never touches the app database. It requires an explicit
 * `BENCH_DATABASE_URL` pointing at a disposable Postgres, and refuses to run
 * if that value equals `DATABASE_URL`.
 *
 *   # 1. point at a throwaway DB and apply migrations
 *   export BENCH_DATABASE_URL=postgresql://localhost:5432/qubere_bench
 *   DATABASE_URL=$BENCH_DATABASE_URL DIRECT_URL=$BENCH_DATABASE_URL \
 *     npx prisma migrate deploy --schema ../../packages/db/prisma/schema.prisma
 *
 *   # 2. seed ~10k actions for one tenant + a second tenant
 *   npx tsx scripts/bench-actions.ts --seed 10000
 *
 *   # 3. benchmark (repeat runs; --iterations controls sample size)
 *   npx tsx scripts/bench-actions.ts --iterations 200
 *
 *   # 4. inspect the plan
 *   npx tsx scripts/bench-actions.ts --explain
 */

import { performance } from "node:perf_hooks";
import { PrismaClient } from "@prisma/client";
import {
  EXCEPTION_LIST_SELECT,
} from "../src/modules/exceptions/exception.service";
import {
  KEYSET_ORDER_BY,
  keysetWhere,
} from "../src/lib/api/keysetCursor";

const BENCH_URL = process.env.BENCH_DATABASE_URL;
if (!BENCH_URL) {
  console.error("Refusing to run: set BENCH_DATABASE_URL to a disposable Postgres.");
  process.exit(1);
}
if (BENCH_URL === process.env.DATABASE_URL) {
  console.error("Refusing to run: BENCH_DATABASE_URL must not equal DATABASE_URL.");
  process.exit(1);
}

const TENANT_A = "bench_tenant_a";
const TENANT_B = "bench_tenant_b";
const SEVERITIES = ["Critical", "High", "Medium", "Low"];
const STATUSES = ["Open", "InProgress", "WaitingForImporter", "ReadyForReview"];

const prisma = new PrismaClient({
  datasources: { db: { url: BENCH_URL } },
  log: [],
});

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string, dflt: number) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : dflt;
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function seed(count: number) {
  console.log(`Seeding ${count} exceptions for ${TENANT_A} + a smaller set for ${TENANT_B}…`);
  for (const id of [TENANT_A, TENANT_B]) {
    await prisma.account.upsert({
      where: { id },
      update: {},
      create: { id, name: id, slug: id },
    });
  }
  await prisma.exceptionItem.deleteMany({ where: { accountId: { in: [TENANT_A, TENANT_B] } } });

  const base = Date.parse("2026-01-01T00:00:00.000Z");
  const mk = (accountId: string, n: number, i: number) => ({
    accountId,
    type: "data_mismatch",
    severity: SEVERITIES[i % SEVERITIES.length],
    status: STATUSES[i % STATUSES.length],
    description: `Bench exception ${i} for ${accountId}`,
    // Deliberately collide timestamps in blocks of 5 to exercise the tiebreak.
    createdAt: new Date(base + Math.floor(i / 5) * 60_000),
    assignedToUserId: i % 3 === 0 ? `${accountId}_user_${i % 7}` : null,
  });

  const batch = 1000;
  for (let i = 0; i < count; i += batch) {
    const rows = Array.from({ length: Math.min(batch, count - i) }, (_, k) => mk(TENANT_A, count, i + k));
    await prisma.exceptionItem.createMany({ data: rows });
  }
  const bCount = Math.max(1, Math.floor(count / 10));
  for (let i = 0; i < bCount; i += batch) {
    const rows = Array.from({ length: Math.min(batch, bCount - i) }, (_, k) => mk(TENANT_B, bCount, i + k));
    await prisma.exceptionItem.createMany({ data: rows });
  }
  console.log("Seed complete.");
}

function baseWhere(assignedTo?: string) {
  return {
    accountId: TENANT_A,
    ...(assignedTo ? { assignedToUserId: assignedTo } : {}),
  };
}

async function runQuery(cursor?: { createdAt: Date; id: string }, assignedTo?: string) {
  const limit = 25;
  const where = { ...baseWhere(assignedTo) } as Record<string, unknown>;
  const ks = keysetWhere(cursor);
  if (ks) where.AND = [ks];
  return prisma.exceptionItem.findMany({
    where,
    select: EXCEPTION_LIST_SELECT,
    orderBy: KEYSET_ORDER_BY,
    take: limit + 1,
  });
}

async function explain() {
  const q = `
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT * FROM "ExceptionItem"
    WHERE "accountId" = $1
    ORDER BY "createdAt" DESC, "id" DESC
    LIMIT 26`;
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, string>>>(q, TENANT_A);
  for (const r of rows) console.log(Object.values(r)[0]);

  console.log("\n--- assigned-to-me ---");
  const q2 = `
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT * FROM "ExceptionItem"
    WHERE "accountId" = $1 AND "assignedToUserId" = $2
    ORDER BY "createdAt" DESC, "id" DESC
    LIMIT 26`;
  const rows2 = await prisma.$queryRawUnsafe<Array<Record<string, string>>>(q2, TENANT_A, `${TENANT_A}_user_0`);
  for (const r of rows2) console.log(Object.values(r)[0]);
}

async function benchmark(iterations: number) {
  let queryCount = 0;
  prisma.$on("query" as never, () => {
    queryCount += 1;
  });

  // Warm up.
  await runQuery();

  const firstPage = await runQuery();
  const rowsReturned = Math.min(firstPage.length, 25);
  const payloadBytes = Buffer.byteLength(JSON.stringify(firstPage.slice(0, 25)));

  // Page 1 latency.
  const p1: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    await runQuery();
    p1.push(performance.now() - t0);
  }

  // Deep page latency (page ~40 via repeated cursoring, then time that page).
  let cursor: { createdAt: Date; id: string } | undefined;
  for (let i = 0; i < 40; i++) {
    const page = await runQuery(cursor);
    const last = page[Math.min(page.length, 25) - 1];
    if (!last) break;
    cursor = { createdAt: last.createdAt, id: last.id };
  }
  const deep: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    await runQuery(cursor);
    deep.push(performance.now() - t0);
  }

  queryCount = 0;
  await runQuery();
  const queriesPerPage = queryCount;

  p1.sort((a, b) => a - b);
  deep.sort((a, b) => a - b);

  const fmt = (n: number) => `${n.toFixed(1)} ms`;
  console.log("\nActions exception-list benchmark");
  console.log("================================");
  console.log(`iterations           ${iterations}`);
  console.log(`rows returned        ${rowsReturned}`);
  console.log(`payload size         ${(payloadBytes / 1024).toFixed(1)} KB`);
  console.log(`SQL queries / page   ${queriesPerPage}`);
  console.log("");
  console.log(`page 1   p50 ${fmt(percentile(p1, 50))}   p95 ${fmt(percentile(p1, 95))}`);
  console.log(`page ~40 p50 ${fmt(percentile(deep, 50))}   p95 ${fmt(percentile(deep, 95))}`);
}

async function main() {
  if (flag("seed")) {
    await seed(opt("seed", 10000));
  } else if (flag("explain")) {
    await explain();
  } else {
    await benchmark(opt("iterations", 200));
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
