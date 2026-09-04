import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { getTenantScopedModelNames } from "@/lib/db";

/**
 * Regression guard for the adoption gap closed across 76f609d (billing
 * actions), 85f6a71 (cron/worker jobs), 7762a5a (session/API-key routes), and
 * cd37810 (remaining routes bypassing withAuthenticatedRoute): a route or
 * action that reads/writes a tenant-scoped Prisma model must establish the
 * AsyncLocalStorage accountId context (directly via runWithAccountId /
 * withAccountIdContext, or implicitly via withAuthenticatedRoute) somewhere
 * in the same file, so the tenant-scoping safety net in src/lib/db.ts
 * actually covers that call. Without it, a query that forgets its own
 * explicit accountId filter fails open instead of failing closed.
 *
 * This does not replace per-route tests -- it catches the specific shape of
 * bug the four commits above fixed: real DB access, real permission checks,
 * but no tenant context ever entered. A file can still leak across tenants
 * despite passing this check (e.g. a hand-rolled accountId literal); that is
 * what the route-specific negative tests are for.
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

// Files that touch a tenant-scoped model but are known-safe: the DB work is
// genuinely global (e.g. a system-role/permission catalogue with no
// per-account rows despite the account-scoped audit-log write beside it), or
// the accountId context is established by a caller this static scan cannot
// see. Every entry must say why -- this list should stay short, and each
// addition here is exactly the kind of exception the audit that closed the
// original gap had to individually justify.
const ALLOWLIST = new Set<string>([
  // Global Permission/Role catalogue sync; the only tenant-scoped write is
  // the audit log, and ctx.accountId (not a request-supplied value) is used.
  join(process.cwd(), "src/app/api/admin/permissions/sync/route.ts"),
]);

function relevantFiles(): string[] {
  const apiRoutes = findFiles(join(process.cwd(), "src/app/api"), (n) => n === "route.ts");
  const serverActions = findFiles(join(process.cwd(), "src/app/app"), (n) => n === "actions.ts");
  const inngestFunctions = findFiles(join(process.cwd(), "src/lib/inngest/functions"), (n) => n.endsWith(".ts"));
  return [...apiRoutes, ...serverActions, ...inngestFunctions];
}

describe("tenant context adoption", () => {
  const files = relevantFiles();

  it("has files to check", () => {
    expect(files.length).toBeGreaterThan(200);
  });

  it("has tenant-scoped Prisma models to check against", () => {
    expect(TENANT_SCOPED_MODELS.length).toBeGreaterThan(20);
  });

  it("establishes tenant context in every route/action/job that touches a tenant-scoped model", () => {
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
