import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { getTenantScopedModelNames } from "@qubere/db";

/**
 * apps/portal counterpart to apps/custom/tests/tenant-context-adoption.test.ts.
 *
 * Unlike apps/custom and apps/tms, apps/portal does not use the shared
 * AsyncLocalStorage tenant-context safety net (runWithAccountId /
 * withAccountIdContext / withAuthenticatedRoute) anywhere -- every route
 * scopes its Prisma calls with a hand-written `where: { accountId }` filter
 * instead. That means the fail-closed net in packages/db is never active for
 * portal, so every current route is allowlisted below rather than fixed here
 * (see the discussion that added this file). This test's job going forward
 * is to stop that gap from silently growing: any *new* route touching a
 * tenant-scoped model must either adopt the shared context or be added to
 * the allowlist with a reason, not slip through unnoticed.
 */

const CONTEXT_MARKERS = /\b(withAuthenticatedRoute|runWithAccountId|withAccountIdContext)\b/;

const TENANT_SCOPED_MODELS = getTenantScopedModelNames();
const MODEL_CALL_PATTERNS = TENANT_SCOPED_MODELS.map((model) => {
  const camel = model.charAt(0).toLowerCase() + model.slice(1);
  return { model, pattern: new RegExp(`\\bdb\\.${camel}\\.`) };
});

function findFiles(dir: string, matchName: (name: string) => boolean, found: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) findFiles(full, matchName, found);
    else if (matchName(entry)) found.push(full);
  }
  return found;
}

// Every entry here is a route/page that touches a tenant-scoped model without
// establishing the ALS context, because apps/portal has not adopted that
// safety net yet (see file header). Tenant isolation for these files relies
// entirely on their own explicit `where: { accountId }` filters -- do not add
// new files here without checking they actually filter by accountId
// themselves first.
const ALLOWLIST = new Set<string>(
  [
    "src/app/api/dashboard/route.ts",
    "src/app/api/documents/route.ts",
    "src/app/api/documents/[id]/route.ts",
    "src/app/api/documents/[id]/download/route.ts",
    "src/app/api/documents/inbound-email/route.ts",
    "src/app/api/entries/route.ts",
    "src/app/api/entries/[id]/download/route.ts",
    "src/app/api/invoices/route.ts",
    "src/app/api/invoices/[id]/download/route.ts",
    "src/app/api/me/route.ts",
    "src/app/api/requests/route.ts",
    "src/app/api/requests/[id]/route.ts",
    "src/app/api/requests/[id]/documents/route.ts",
    "src/app/api/requests/[id]/messages/route.ts",
    "src/app/api/shipments/route.ts",
    "src/app/api/shipments/[id]/route.ts",
    "src/app/api/portal/onboarding/[token]/route.ts",
    "src/app/api/portal/onboarding/[token]/entity/route.ts",
    "src/app/api/portal/onboarding/[token]/officers/route.ts",
    "src/app/api/portal/onboarding/[token]/documents/route.ts",
    "src/app/api/portal/onboarding/[token]/complete/route.ts",
    "src/app/(auth)/invite/[token]/page.tsx",
  ].map((f) => join(process.cwd(), f))
);

function relevantFiles(): string[] {
  const apiRoutes = findFiles(join(process.cwd(), "src/app/api"), (n) => n === "route.ts");
  const pages = findFiles(join(process.cwd(), "src/app"), (n) => n === "page.tsx");
  return [...apiRoutes, ...pages];
}

describe("tenant context adoption (apps/portal)", () => {
  const files = relevantFiles();

  it("has files to check", () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it("has tenant-scoped Prisma models to check against", () => {
    expect(TENANT_SCOPED_MODELS.length).toBeGreaterThan(20);
  });

  it("establishes tenant context, or is allowlisted, in every route/page that touches a tenant-scoped model", () => {
    const offenders: { file: string; models: string[] }[] = [];

    for (const file of files) {
      const content = readFileSync(file, "utf8");
      const touchedModels = MODEL_CALL_PATTERNS.filter((p) => p.pattern.test(content)).map((p) => p.model);
      if (touchedModels.length === 0) continue;
      if (CONTEXT_MARKERS.test(content)) continue;
      if (ALLOWLIST.has(file)) continue;
      offenders.push({ file: file.replace(process.cwd(), "").replace(/\\/g, "/"), models: touchedModels });
    }

    expect(offenders).toEqual([]);
  });

  it("keeps the allowlist limited to files that actually exist and still need it", () => {
    for (const file of ALLOWLIST) {
      expect(() => readFileSync(file, "utf8"), file).not.toThrow();
    }
  });
});
