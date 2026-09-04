/**
 * RPS indexed candidate generation benchmark.
 *
 * Compares LEGACY_ONLY (full generateCandidates() scan over the entire
 * reference list) against CANDIDATE_PRIMARY (selectCandidateEntityIdsFromIndex
 * narrowing via ScreeningSearchToken, then the same generateCandidates() scan
 * over just the narrowed set) across a fixed battery of screening scenarios --
 * printing candidate-set size and latency for each mode side by side.
 *
 * It never touches the app database. It requires an explicit
 * `BENCH_DATABASE_URL` pointing at a disposable Postgres (already migrated,
 * with the ScreeningEntity/ScreeningSearchToken tables populated -- restore a
 * snapshot, or use `--seed` to generate a small synthetic set), and refuses
 * to run if that value equals `DATABASE_URL`. DATABASE_URL/DIRECT_URL are
 * rebound to BENCH_DATABASE_URL for this process only, before any app module
 * that uses the shared `@/lib/db` client is imported -- that's what lets this
 * script reuse selectCandidateEntityIdsFromIndex/getRestrictedPartyReferenceList
 * as-is instead of reimplementing their queries.
 *
 *   # 1. point at a throwaway DB, migrated and populated with reference data
 *   export BENCH_DATABASE_URL=postgresql://localhost:5432/qubere_bench
 *   DATABASE_URL=$BENCH_DATABASE_URL DIRECT_URL=$BENCH_DATABASE_URL \
 *     npx prisma migrate deploy --schema ../../packages/db/prisma/schema.prisma
 *
 *   # 2. (optional) seed a small synthetic set + its search tokens
 *   npx tsx scripts/rps-candidate-benchmark.ts --seed 5000
 *
 *   # 3. benchmark (repeat runs; --iterations controls sample size)
 *   npx tsx scripts/rps-candidate-benchmark.ts --iterations 50
 */

import { performance } from "node:perf_hooks";
import { PrismaClient } from "@prisma/client";

const BENCH_URL = process.env.BENCH_DATABASE_URL;
if (!BENCH_URL) {
  console.error("Refusing to run: set BENCH_DATABASE_URL to a disposable Postgres.");
  process.exit(1);
}
if (BENCH_URL === process.env.DATABASE_URL) {
  console.error("Refusing to run: BENCH_DATABASE_URL must not equal DATABASE_URL.");
  process.exit(1);
}

// Rebind before any app module resolves @/lib/db's PrismaClient singleton.
process.env.DATABASE_URL = BENCH_URL;
process.env.DIRECT_URL = BENCH_URL;

const bench = new PrismaClient({ datasources: { db: { url: BENCH_URL } }, log: [] });

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

interface Scenario {
  label: string;
  name: string;
  address?: string;
}

const SCENARIOS: Scenario[] = [
  { label: "exact match", name: "Bench Entity 1 Trading Co" },
  { label: "alias match", name: "Bench Alias 1" },
  { label: "common-word-heavy org name", name: "Bench Global Holdings Company Ltd" },
  { label: "phonetic misspelling", name: "Bentch Entity 1 Traiding Co" },
  { label: "individual name", name: "John Q Bench-Smith" },
  { label: "no match at all", name: "Zzyxx Nonexistent Nowhere Corp" },
  { label: "address-bearing entity", name: "Bench Entity 1 Trading Co", address: "1 Bench Street, Springfield" },
];

async function seed(count: number) {
  console.log(`Seeding ${count} synthetic ScreeningEntity rows + search tokens...`);
  const { syncSearchTokensForEntities } = await import("../src/modules/screening/searchTokenSync");

  await bench.screeningSearchToken.deleteMany({ where: { screeningEntityId: { startsWith: "bench_" } } });
  await bench.screeningEntity.deleteMany({ where: { id: { startsWith: "bench_" } } });

  const batch = 500;
  for (let i = 0; i < count; i += batch) {
    const rows = Array.from({ length: Math.min(batch, count - i) }, (_, k) => {
      const n = i + k;
      return {
        id: `bench_${n}`,
        entityHash: `bench_hash_${n}`,
        entityType: "COMPANY" as const,
        name: `Bench Entity ${n} Trading Co`,
        alternateNames: [`Bench Alias ${n}`],
        address: `${n} Bench Street`,
        city: "Springfield",
        country: "USA",
        programCodes: ["SDN"],
        sourceList: "SDN",
        publicationStatus: "PUBLISHED" as const,
        publishedAt: new Date(),
        sourcePublishedAt: new Date(),
      };
    });
    await bench.screeningEntity.createMany({ data: rows });
  }

  const ids = Array.from({ length: count }, (_, i) => `bench_${i}`);
  const tokenBatch = 1000;
  for (let i = 0; i < ids.length; i += tokenBatch) {
    await syncSearchTokensForEntities(ids.slice(i, i + tokenBatch));
  }
  console.log("Seed complete.");
}

async function benchmark(iterations: number) {
  const { getRestrictedPartyReferenceList } = await import(
    "../src/modules/agents/compliance/restrictedParty/restrictedPartyRepository"
  );
  const { generateCandidates } = await import("../src/modules/agents/compliance/restrictedParty/candidateGeneration");
  const { selectCandidateEntityIdsFromIndex, isIndexCoverageAcceptable } = await import(
    "../src/modules/agents/compliance/restrictedParty/candidateIndexService"
  );

  console.log("Loading reference list...");
  const referenceList = await getRestrictedPartyReferenceList();
  console.log(`Reference list size: ${referenceList.length}`);
  console.log(`Index coverage acceptable: ${await isIndexCoverageAcceptable()}`);

  const fmt = (n: number) => `${n.toFixed(1)} ms`;

  console.log("\nRPS candidate generation benchmark");
  console.log("===================================");

  for (const scenario of SCENARIOS) {
    const legacy: number[] = [];
    let legacyCandidateCount = 0;
    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      const result = generateCandidates(scenario.name, referenceList, {});
      legacy.push(performance.now() - t0);
      legacyCandidateCount = result.candidates.length;
    }

    const indexed: number[] = [];
    let indexedCandidateCount = 0;
    let diagnostics: Record<string, unknown> = {};
    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      const { candidateEntityIds, diagnostics: d } = await selectCandidateEntityIdsFromIndex(scenario.name, scenario.address);
      const scanList = referenceList.filter((e) => candidateEntityIds.has(e.id));
      const result = generateCandidates(scenario.name, scanList, {});
      indexed.push(performance.now() - t0);
      indexedCandidateCount = result.candidates.length;
      diagnostics = { ...d };
    }

    legacy.sort((a, b) => a - b);
    indexed.sort((a, b) => a - b);

    console.log(`\n${scenario.label} ("${scenario.name}"${scenario.address ? ` @ "${scenario.address}"` : ""})`);
    console.log(
      `  LEGACY_ONLY       candidates=${legacyCandidateCount}  p50=${fmt(percentile(legacy, 50))}  p95=${fmt(percentile(legacy, 95))}`
    );
    console.log(
      `  CANDIDATE_PRIMARY candidates=${indexedCandidateCount}  p50=${fmt(percentile(indexed, 50))}  p95=${fmt(percentile(indexed, 95))}  index=${JSON.stringify(diagnostics)}`
    );
  }
}

async function main() {
  if (flag("seed")) {
    await seed(opt("seed", 5000));
  } else {
    await benchmark(opt("iterations", 50));
  }
  await bench.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
