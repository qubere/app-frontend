import { describe, it, expect, vi, beforeEach } from "vitest";

const screeningEntityUpsert = vi.fn();
const screeningEntityFindMany = vi.fn();
const screeningEntityUpdateMany = vi.fn();
const referenceDataChangeSetCreateMany = vi.fn();

const dbMock = {
  screeningEntity: {
    upsert: screeningEntityUpsert,
    findMany: screeningEntityFindMany,
    updateMany: screeningEntityUpdateMany,
  },
  referenceDataChangeSet: { createMany: referenceDataChangeSetCreateMany },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@qubere/db", () => ({ db: dbMock }));

const { parseFdaDebarmentHtml, FdaDebarmentIngestionService } = await import(
  "@/modules/screening/fdaDebarmentIngestionService"
);

// Column layout and sample rows reconstructed from the live page's rendered
// structure (Last Name, First & Middle Names, Effective Date, End/Term of
// Debarment, FR Date, Volume Page) -- a direct curl/fetch of fda.gov from
// this environment is blocked by Akamai bot detection (302 to
// /apology_objects/abuse-detection-apology.html on every path, including
// the homepage), so this fixture is not a byte-for-byte page excerpt like
// the UFLPA one; it should be swapped for a real trimmed excerpt once a
// live fetch is verified from the deployed environment.
const FIRMS_TABLE = `
<table><thead><tr><th>Last Name</th><th>First &amp; Middle Names</th><th>Effective Date</th><th>End/Term of Debarment</th><th>FR Date</th><th>Volume Page</th></tr></thead>
<tbody><tr><td colspan="6">None as of this date.</td></tr></tbody></table>`;

function personsRow(lastName: string, firstMiddle: string, effectiveDate: string, endTerm: string, frDate: string, volumePage: string) {
  return `<tr><td>${lastName}</td><td>${firstMiddle}</td><td>${effectiveDate}</td><td>${endTerm}</td><td>${frDate}</td><td>${volumePage}</td></tr>`;
}

const TWO_PERSON_ROWS = `
<table><thead><tr><th>Last Name</th><th>First &amp; Middle Names</th><th>Effective Date</th><th>End/Term of Debarment</th><th>FR Date</th><th>Volume Page</th></tr></thead>
<tbody>
${personsRow("Acosta", "Gina", "05/15/2024", "Permanent", "05/15/2024", "89 FR 42474")}
${personsRow("Acuna", "Ricardo Andres", "08/03/2026", "Permanent", "08/03/2026", "91 FR 48877")}
</tbody></table>`;

describe("FDA Debarment List HTML parsing", () => {
  it("treats the first table as Firms and skips its 'None as of this date' placeholder row", () => {
    const entries = parseFdaDebarmentHtml(`<html><body>${FIRMS_TABLE}</body></html>`);
    expect(entries).toHaveLength(0);
  });

  it("parses Persons-table rows as INDIVIDUAL entries with name built from first+last, and a Permanent term as no expiration", () => {
    const entries = parseFdaDebarmentHtml(`<html><body>${FIRMS_TABLE}${TWO_PERSON_ROWS}</body></html>`);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      name: "Gina Acosta",
      entityType: "INDIVIDUAL",
      citation: "05/15/2024 -- 89 FR 42474",
      expirationDate: null,
    });
    expect(entries[0].effectiveDate?.toISOString()).toContain("2024-05-15");

    expect(entries[1]).toMatchObject({ name: "Ricardo Andres Acuna", entityType: "INDIVIDUAL" });
    expect(entries[1].effectiveDate?.toISOString()).toContain("2026-08-03");
  });

  it("parses a firms-table row (single name column) as an ENTITY entry", () => {
    const firmsWithRow = `
<table><thead><tr><th>Firm Name</th><th></th><th>Effective Date</th><th>End/Term of Debarment</th><th>FR Date</th><th>Volume Page</th></tr></thead>
<tbody><tr><td>Acme Pharma LLC</td><td></td><td>01/01/2025</td><td>5 years</td><td>01/01/2025</td><td>90 FR 1</td></tr></tbody></table>`;
    const entries = parseFdaDebarmentHtml(`<html><body>${firmsWithRow}</body></html>`);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ name: "Acme Pharma LLC", entityType: "ENTITY" });
  });

  it("refuses to ingest a near-empty parse", () => {
    const entries = parseFdaDebarmentHtml("<html><body><table><tbody></tbody></table></body></html>");
    expect(entries).toHaveLength(0);
  });
});

describe("FdaDebarmentIngestionService.fetchAndIngest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    screeningEntityFindMany.mockResolvedValue([]);
    screeningEntityUpdateMany.mockResolvedValue({ count: 0 });
    referenceDataChangeSetCreateMany.mockResolvedValue({ count: 0 });
  });

  it("aborts without writing anything when the parsed count is below the circuit-breaker floor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: async () => `<html><body>${FIRMS_TABLE}${TWO_PERSON_ROWS}</body></html>` })
    );

    await expect(FdaDebarmentIngestionService.fetchAndIngest()).rejects.toThrow(/only 2 entries/);
    expect(screeningEntityUpsert).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("throws when the page fetch returns a non-OK status (e.g. blocked/redirected)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    await expect(FdaDebarmentIngestionService.fetchAndIngest()).rejects.toThrow(/HTTP 404/);

    vi.unstubAllGlobals();
  });
});
