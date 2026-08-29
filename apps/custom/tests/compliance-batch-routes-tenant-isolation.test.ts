import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Source-level guarantees for the Bulk Compliance Screening (batches) API
// surface. Complements the unit-level service.ts tests
// (compliance-batch-service.test.ts) which mock `db` -- these scans instead
// assert every route.ts is wired through the shared auth guard with a
// declared permission, and that every tenant-owned lookup is scoped by
// accountId (never a bare findUnique/findFirst-by-id).
// ---------------------------------------------------------------------------

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, found);
    else if (full.endsWith(".ts") || full.endsWith(".tsx")) found.push(full);
  }
  return found;
}

const BATCHES_API_DIR = join(__dirname, "..", "src/app/api/compliance/batches");
const PERMISSION_PATTERN = /permission:\s*"([a-z_]+(?:\.[a-z_]+)+)"/;

describe("compliance batches API routes", () => {
  const routes = sourceFiles(BATCHES_API_DIR).filter((file) => file.endsWith("route.ts"));

  it("has routes to check", () => {
    expect(routes.length).toBeGreaterThanOrEqual(6);
  });

  it("authenticates every route through the shared guard", () => {
    const unguarded = routes.filter((file) => !readFileSync(file, "utf8").includes("withAuthenticatedRoute"));
    expect(unguarded).toEqual([]);
  });

  it("declares a dot-separated permission literal on every route", () => {
    const missing = routes.filter((file) => !PERMISSION_PATTERN.test(readFileSync(file, "utf8")));
    expect(missing).toEqual([]);
  });

  it("scopes every findFirst on ComplianceBatch/BatchRecord/BatchArtifact by accountId", () => {
    const offenders: string[] = [];
    for (const file of routes) {
      const content = readFileSync(file, "utf8");
      for (const match of content.matchAll(
        /db\.(complianceBatch|batchRecord|batchArtifact)\.findFirst\(\{\s*where:\s*\{([^}]*)\}/g
      )) {
        if (!/accountId/.test(match[2])) {
          offenders.push(`${file}: db.${match[1]}.findFirst({ where: { ${match[2].trim()} } })`);
        }
      }
      expect(content).not.toMatch(/db\.(complianceBatch|batchRecord|batchArtifact)\.findUnique\(/);
    }
    expect(offenders).toEqual([]);
  });

  it("mutating routes (cancel/retry/rescreen) declare write: true", () => {
    const mutatingRoutes = routes.filter((file) => /[\\/](cancel|retry|rescreen)[\\/]route\.ts$/.test(file));
    expect(mutatingRoutes.length).toBe(3);
    const missingWrite = mutatingRoutes.filter((file) => !/write:\s*true/.test(readFileSync(file, "utf8")));
    expect(missingWrite).toEqual([]);
  });

  it("maps ComplianceBatchStateError to a 409 response on lifecycle-action routes", () => {
    const lifecycleRoutes = routes.filter((file) => /[\\/](cancel|retry|rescreen)[\\/]route\.ts$/.test(file));
    const missing409 = lifecycleRoutes.filter((file) => {
      const content = readFileSync(file, "utf8");
      return !(content.includes("ComplianceBatchStateError") && /status:\s*409/.test(content));
    });
    expect(missing409).toEqual([]);
  });
});
