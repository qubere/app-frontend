import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Source-level guarantees for the Compliance Reporting & Analytics API
// surface (saved report definitions, schedules, and ad-hoc runs). Mirrors the
// approach in compliance-batch-routes-tenant-isolation.test.ts: scan route.ts
// source text rather than importing the modules, so these checks don't need
// a live db/env and stay cheap to run.
// ---------------------------------------------------------------------------

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, found);
    else if (full.endsWith(".ts") || full.endsWith(".tsx")) found.push(full);
  }
  return found;
}

const REPORTS_API_DIR = join(__dirname, "..", "src/app/api/compliance/reports");
const PERMISSION_PATTERN = /permission:\s*"([a-z_]+(?:\.[a-z_]+)+)"/;

describe("compliance reports API routes", () => {
  const routes = sourceFiles(REPORTS_API_DIR).filter((file) => file.endsWith("route.ts"));

  it("has routes to check", () => {
    expect(routes.length).toBeGreaterThanOrEqual(8);
  });

  it("authenticates every route through the shared guard", () => {
    const unguarded = routes.filter((file) => !readFileSync(file, "utf8").includes("withAuthenticatedRoute"));
    expect(unguarded).toEqual([]);
  });

  it("declares a dot-separated permission literal on every route", () => {
    const missing = routes.filter((file) => !PERMISSION_PATTERN.test(readFileSync(file, "utf8")));
    expect(missing).toEqual([]);
  });

  it("every write:true route (create/update/delete/lifecycle action) records an audit log", () => {
    const mutating = routes.filter((file) => /write:\s*true/.test(readFileSync(file, "utf8")));
    expect(mutating.length).toBeGreaterThanOrEqual(8);
    const missingAudit = mutating.filter((file) => !readFileSync(file, "utf8").includes("createAuditLog"));
    expect(missingAudit).toEqual([]);
  });

  it("scopes every findFirst on ReportDefinition/ReportSchedule/ReportArtifact by accountId", () => {
    const offenders: string[] = [];
    for (const file of routes) {
      const content = readFileSync(file, "utf8");
      for (const match of content.matchAll(
        /db\.(reportDefinition|reportSchedule|reportArtifact)\.findFirst\(\{\s*where:\s*\{([^}]*)\}/g
      )) {
        if (!/accountId/.test(match[2])) {
          offenders.push(`${file}: db.${match[1]}.findFirst({ where: { ${match[2].trim()} } })`);
        }
      }
      expect(content).not.toMatch(/db\.(reportDefinition|reportSchedule|reportArtifact)\.findUnique\(/);
    }
    expect(offenders).toEqual([]);
  });
});

describe("compliance reports catalog <-> query registry wiring", () => {
  const catalogSource = readFileSync(
    join(__dirname, "..", "src/modules/reports/catalog.ts"),
    "utf8"
  );
  const registrySource = readFileSync(
    join(__dirname, "..", "src/modules/reports/queries/index.ts"),
    "utf8"
  );

  function catalogEntryIds(): string[] {
    const body = catalogSource.slice(
      catalogSource.indexOf("REPORT_CATALOG"),
      catalogSource.indexOf("export function getCatalogEntry")
    );
    return [...body.matchAll(/id:\s*"([a-z0-9-]+)"/g)].map((m) => m[1]);
  }

  function registeredQueryIds(): string[] {
    return [...registrySource.matchAll(/"([a-z0-9-]+)":\s*query[A-Za-z]+/g)].map((m) => m[1]);
  }

  it("has a catalog entry for every 'reference-data-changes'-style report", () => {
    expect(catalogEntryIds()).toContain("reference-data-changes");
  });

  it("registers a query function for every catalog entry, and vice versa", () => {
    const catalogIds = new Set(catalogEntryIds());
    const registeredIds = new Set(registeredQueryIds());

    const catalogWithoutQuery = [...catalogIds].filter((id) => !registeredIds.has(id));
    const queryWithoutCatalog = [...registeredIds].filter((id) => !catalogIds.has(id));

    expect(catalogWithoutQuery).toEqual([]);
    expect(queryWithoutCatalog).toEqual([]);
  });
});
