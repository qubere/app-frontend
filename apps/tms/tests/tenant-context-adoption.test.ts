import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { getTenantScopedModelNames } from "@qubere/db";

/**
 * apps/tms counterpart to apps/custom/tests/tenant-context-adoption.test.ts --
 * same regression guard (a route/page/job that reads/writes a tenant-scoped
 * Prisma model must establish the AsyncLocalStorage accountId context via
 * runWithAccountId / withAccountIdContext / withAuthenticatedRoute somewhere
 * in the same file), adapted to how tms actually does tenant-scoped access:
 * unlike apps/custom, tms has no server actions, and its dashboard pages
 * (src/app/**\/page.tsx) query the DB directly as server components rather
 * than only from API routes.
 *
 * This does not replace per-route tests -- it catches missing context, not
 * every possible leak (e.g. a hand-rolled accountId literal still passes).
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

// Files that touch a tenant-scoped model but are known-safe. Every entry must
// say why -- this list should stay short, and each addition here is exactly
// the kind of exception the audit that closed the original apps/custom gap
// had to individually justify.
const ALLOWLIST = new Set<string>([
  // Platform-wide admin dashboards: the account/agent-decision/exception/
  // invoice counts are intentionally global (cross-tenant summary for
  // platform operators), not scoped to the viewing account.
  join(process.cwd(), "src/app/admin/page.tsx"),
  join(process.cwd(), "src/app/platform-admin/page.tsx"),
  // System-level outbox dispatcher: every lookup/update is scoped by the
  // outbox event's own id, and it must run across all accounts' pending
  // events, not one tenant's.
  join(process.cwd(), "src/lib/inngest/functions/tmsMemoryExtraction.ts"),
  // Scheduled sweep that expires SENT tenders past their expiresAt across
  // every account by design; each update is scoped by the tender's own id.
  join(process.cwd(), "src/inngest/tenderExpirySweep.ts"),
]);

function relevantFiles(): string[] {
  const apiRoutes = findFiles(join(process.cwd(), "src/app"), (n) => n === "route.ts");
  const serverPages = findFiles(join(process.cwd(), "src/app"), (n) => n === "page.tsx");
  const inngestFunctions = [
    ...findFiles(join(process.cwd(), "src/lib/inngest/functions"), (n) => n.endsWith(".ts")),
    ...findFiles(join(process.cwd(), "src/inngest"), (n) => n.endsWith(".ts")),
  ];
  return [...apiRoutes, ...serverPages, ...inngestFunctions];
}

describe("tenant context adoption (apps/tms)", () => {
  const files = relevantFiles();

  it("has files to check", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("has tenant-scoped Prisma models to check against", () => {
    expect(TENANT_SCOPED_MODELS.length).toBeGreaterThan(20);
  });

  it("establishes tenant context in every route/page/job that touches a tenant-scoped model", () => {
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
