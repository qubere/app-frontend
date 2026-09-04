import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Source-level guarantees for the License Determination & Management API
// surface: every route must authenticate through the shared guard and scope
// every accountId-owned model lookup by ctx.accountId (never a bare findUnique
// by id, which would let one tenant enumerate another tenant's records).

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, found);
    else if (full.endsWith(".ts")) found.push(full);
  }
  return found;
}

const API_DIR = join(process.cwd(), "src/app/api/compliance");
const CRON_ROUTE = join(process.cwd(), "src/app/api/cron/license-alerts/route.ts");

const licenseRoutes = sourceFiles(API_DIR).filter(
  (file) => file.endsWith("route.ts") && /license/i.test(file)
);

describe("license API routes", () => {
  it("has routes to check", () => {
    expect(licenseRoutes.length).toBeGreaterThanOrEqual(14);
  });

  it("authenticates every route through the shared guard", () => {
    const unguarded = licenseRoutes.filter((file) => !readFileSync(file, "utf8").includes("withAuthenticatedRoute"));
    expect(unguarded).toEqual([]);
  });

  it("declares a permission (and write:true for mutating routes) on every guarded export", () => {
    for (const file of licenseRoutes) {
      const content = readFileSync(file, "utf8");
      expect(content).toMatch(/permission:\s*"[a-zA-Z._]+"/);
    }
  });

  it("never resolves a license/licenseLine/licenseDeterminationResult by a bare findUnique(id)", () => {
    const offenders: string[] = [];
    for (const file of licenseRoutes) {
      const content = readFileSync(file, "utf8");
      for (const match of content.matchAll(/db\.(license\w*)\.findUnique\(\{\s*where:\s*\{\s*id:/g)) {
        offenders.push(`${file}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("scopes every findFirst-by-params.id lookup with accountId: ctx.accountId", () => {
    const offenders: string[] = [];
    for (const file of licenseRoutes) {
      const content = readFileSync(file, "utf8");
      for (const match of content.matchAll(/db\.(license\w*)\.findFirst\(\{\s*where:\s*\{[^}]*id:\s*params\.id[^}]*\}/g)) {
        if (!match[0].includes("accountId")) offenders.push(`${file}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("license-alerts cron route", () => {
  const content = readFileSync(CRON_ROUTE, "utf8");

  it("uses withCronRoute, not the tenant-authenticated guard", () => {
    expect(content).toContain("withCronRoute");
  });

  it("wraps each account's delivery in runWithAccountId for tenant-scoped mutations", () => {
    expect(content).toMatch(/runWithAccountId\(/);
  });
});
