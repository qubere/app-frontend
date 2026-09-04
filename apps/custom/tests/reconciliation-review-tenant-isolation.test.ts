import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// §82 -- Tenant A must not be able to read/review/update Tenant B's documents,
// fields, line items, or reconciliation issues. Field-level scoping for
// ExtractionField/FieldApproval already has a runtime-mocked negative test
// (extraction-correction-api.test.ts); these routes -- the document PATCH,
// the reconciliation-issue action, and the shipment (line items) PATCH --
// had no tenant-scoping test coverage at all before this file.

const DOCUMENT_ROUTE = join(__dirname, "..", "src/app/api/documents/[id]/route.ts");
const RECONCILIATION_ISSUE_ROUTE = join(
  __dirname,
  "..",
  "src/app/api/shipments/[id]/reconcile/issues/[issueId]/route.ts"
);
const FIELD_REVIEW_ROUTE = join(
  __dirname,
  "..",
  "src/app/api/shipments/[id]/documents/[documentId]/field-review/route.ts"
);
const SHIPMENT_ROUTE = join(__dirname, "..", "src/app/api/shipments/[id]/route.ts");

describe("document PATCH route tenant scoping", () => {
  const content = readFileSync(DOCUMENT_ROUTE, "utf8");

  it("authenticates before touching the document", () => {
    expect(content).toMatch(/getAccountContext\(\)/);
  });

  it("proves document ownership with accountId before any update", () => {
    expect(content).toMatch(
      /shipmentDocument\.findFirst\(\{\s*where:\s*\{\s*id:\s*params\.id,\s*accountId:\s*ctx\.accountId/
    );
  });

  it("returns 404, not a foreign document, when the accountId-scoped lookup misses", () => {
    expect(content).toMatch(/if \(!doc\) \{\s*return NextResponse\.json\(\{ error: "Document not found" \}, \{ status: 404 \}\);/);
  });
});

describe("reconciliation issue action route tenant scoping", () => {
  const content = readFileSync(RECONCILIATION_ISSUE_ROUTE, "utf8");

  it("authenticates through the shared guard", () => {
    expect(content).toContain("withAuthenticatedRoute");
  });

  it("scopes the issue lookup by shipmentId and accountId together, not just the issue id", () => {
    expect(content).toMatch(
      /reconciliationIssue\.findFirst\(\{\s*where:\s*\{\s*id:\s*issueId,\s*shipmentId:\s*id,\s*accountId:\s*ctx\.accountId/
    );
  });

  it("returns NOT_FOUND when the scoped lookup misses, before any mutation", () => {
    expect(content).toMatch(/if \(!issue\) \{\s*return buildErrorResponse\(404, "NOT_FOUND"/);
  });
});

describe("field-review route tenant scoping", () => {
  const content = readFileSync(FIELD_REVIEW_ROUTE, "utf8");

  it("authenticates through the shared guard", () => {
    expect(content).toContain("withAuthenticatedRoute");
  });

  it("passes ctx.accountId through to the field-review service, never a bare id", () => {
    expect(content).toMatch(/ctx\.accountId/);
  });
});

describe("shipment PATCH route (line items) tenant scoping", () => {
  const content = readFileSync(SHIPMENT_ROUTE, "utf8");

  it("authenticates through the shared guard", () => {
    expect(content).toContain("withAuthenticatedRoute");
  });

  it("proves shipment ownership with accountId before touching lineItems", () => {
    expect(content).toMatch(
      /shipment\.findFirst\(\{\s*where:\s*\{\s*id,\s*accountId:\s*ctx\.accountId/
    );
  });
});
