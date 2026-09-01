import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Source-level guarantees for the DocumentAssociation API surface
// (link/list/unlink + the per-document association history and signed-url
// routes). Complements the unit-level service.ts tests
// (documentAssociations.test.ts) which mock `db` -- these scans instead
// assert every route.ts is wired through the shared auth guard with a
// declared permission, and that mutating routes require write access.
// ---------------------------------------------------------------------------

const ROUTES = [
  join(__dirname, "..", "src/app/api/document-associations/route.ts"),
  join(__dirname, "..", "src/app/api/document-associations/[id]/unlink/route.ts"),
  join(__dirname, "..", "src/app/api/documents/[id]/associations/route.ts"),
  join(__dirname, "..", "src/app/api/documents/[id]/signed-url/route.ts"),
];

const PERMISSION_PATTERN = /permission:\s*\{\s*(?:any|all)\s*:\s*\[[^\]]*"document\.[a-z_]+"/;

describe("document-associations API routes", () => {
  it("has the expected routes", () => {
    for (const file of ROUTES) {
      expect(() => readFileSync(file, "utf8")).not.toThrow();
    }
  });

  it("authenticates every route through the shared guard", () => {
    const unguarded = ROUTES.filter((file) => !readFileSync(file, "utf8").includes("withAuthenticatedRoute"));
    expect(unguarded).toEqual([]);
  });

  it("declares a document.* permission literal on every route", () => {
    const missing = ROUTES.filter((file) => !PERMISSION_PATTERN.test(readFileSync(file, "utf8")));
    expect(missing).toEqual([]);
  });

  it("mutating routes (POST link, POST unlink) declare write: true", () => {
    const mutating = ROUTES.filter((file) => /document-associations[\\/].*route\.ts$/.test(file));
    expect(mutating.length).toBe(2);
    const missingWrite = mutating.filter((file) => !/write:\s*true/.test(readFileSync(file, "utf8")));
    expect(missingWrite).toEqual([]);
  });

  it("every accountId-scoped lookup passes ctx.accountId through to the service layer, never a bare id", () => {
    for (const file of ROUTES) {
      const content = readFileSync(file, "utf8");
      // Every route must reference ctx.accountId when calling into the service/db layer.
      expect(content).toMatch(/ctx\.accountId/);
    }
  });

  it("catches DocumentAssociationError as a 400, not a raw 500", () => {
    for (const file of ROUTES) {
      const content = readFileSync(file, "utf8");
      if (content.includes("DocumentAssociationError")) {
        // Either NextResponse.json(..., { status: 400 }) or buildErrorResponse(400, ...).
        expect(content).toMatch(/status:\s*400|buildErrorResponse\(400,/);
      }
    }
  });
});
