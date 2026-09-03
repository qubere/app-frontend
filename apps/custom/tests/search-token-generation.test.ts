import { describe, it, expect } from "vitest";
import { buildSearchTokenRows } from "@/modules/agents/compliance/restrictedParty/searchTokenGeneration";

// Restricted / Denied-Party Screening: searchTokenGeneration.ts's
// buildSearchTokenRows. This is the ingestion-time half of the indexed
// candidate layer -- candidateIndexService.ts's query-time lookup can only
// be recall-safe if these rows faithfully mirror what candidateGeneration.ts
// already checks (whole-name EXACT/phonetic, per-token RAW_WORD/
// ALTERNATE_WHOLE_WORD).

describe("buildSearchTokenRows", () => {
  it("tags the primary name NAME and every alternate/alias name ALIAS", () => {
    const rows = buildSearchTokenRows({
      id: "e1",
      name: "Acme Trading Co",
      alternateNames: ["Acme Trading Company"],
      aliases: [{ name: "Acme Co" }],
    });

    const wholeNameRows = rows.filter((r) => r.normalizedToken === r.originalToken || r.originalToken);
    const primaryRows = rows.filter((r) => r.originalToken === "Acme Trading Co");
    const alternateRows = rows.filter((r) => r.originalToken === "Acme Trading Company");
    const aliasRows = rows.filter((r) => r.originalToken === "Acme Co");

    expect(primaryRows.every((r) => r.fieldType === "NAME")).toBe(true);
    expect(alternateRows.every((r) => r.fieldType === "ALIAS")).toBe(true);
    expect(aliasRows.every((r) => r.fieldType === "ALIAS")).toBe(true);
    expect(wholeNameRows.length).toBeGreaterThan(0);
  });

  it("emits one whole-name row and one row per meaningful token for each candidate name", () => {
    // "Company" is a LEGAL_FORM_WORD stripped by normalizeForMatching, so the
    // whole-name row is "ACME WIDGETS" (not "ACME WIDGETS COMPANY") -- this
    // mirrors candidateGeneration.ts's own EXACT/RAW_WORD checks exactly,
    // which compare against that same stripped form.
    const rows = buildSearchTokenRows({
      id: "e1",
      name: "Acme Widgets Company",
      alternateNames: [],
      aliases: [],
    });

    const wholeNameRow = rows.find((r) => r.normalizedToken === "ACME WIDGETS");
    expect(wholeNameRow).toBeDefined();
    expect(wholeNameRow!.doubleMetaphonePrimary).toBeTruthy();
    expect(wholeNameRow!.metaphone).toBeTruthy();

    // Per-token rows for the meaningful (length > 1) words in the name.
    const tokenRows = rows.filter((r) => r.normalizedToken !== "ACME WIDGETS");
    const tokenValues = tokenRows.map((r) => r.normalizedToken);
    expect(tokenValues).toContain("ACME");
    expect(tokenValues).toContain("WIDGETS");
  });

  it("skips a name that normalizes to empty", () => {
    const rows = buildSearchTokenRows({
      id: "e1",
      name: "   ",
      alternateNames: [],
      aliases: [],
    });
    expect(rows).toEqual([]);
  });

  it("de-dupes candidate name strings the same way candidateNames() does (case-insensitive)", () => {
    const rows = buildSearchTokenRows({
      id: "e1",
      name: "Acme Widgets Company",
      alternateNames: ["ACME WIDGETS COMPANY"],
      aliases: [{ name: "acme widgets company" }],
    });

    const wholeNameRows = rows.filter((r) => r.normalizedToken === "ACME WIDGETS");
    expect(wholeNameRows).toHaveLength(1);
  });

  it("down-weights legal-form and weak-business-term tokens instead of omitting them", () => {
    // Unlike normalizeForMatching (which fully strips these as noise for the
    // matcher's own comparison string), the per-token index rows keep them --
    // just at a low tokenWeight -- so candidateScore-based pruning in
    // candidateIndexService.ts has something to rank them by.
    const rows = buildSearchTokenRows({
      id: "e1",
      name: "Acme Trading Co",
      alternateNames: [],
      aliases: [],
    });

    // "Acme Trading Co" normalizes+strips to just "ACME" -- the whole-name
    // row is always pushed first, before the per-token loop.
    const wholeNameRow = rows[0];
    const coRow = rows.find((r) => r.normalizedToken === "CO");
    const tradingRow = rows.find((r) => r.normalizedToken === "TRADING");

    expect(wholeNameRow.normalizedToken).toBe("ACME");
    expect(wholeNameRow.tokenWeight).toBe(1);
    expect(coRow).toBeDefined();
    expect(coRow!.tokenWeight).toBeLessThan(1);
    expect(tradingRow).toBeDefined();
    expect(tradingRow!.tokenWeight).toBeGreaterThan(coRow!.tokenWeight);
    expect(tradingRow!.tokenWeight).toBeLessThan(1);
  });

  it("emits low-weight ADDRESS rows from ScreeningEntityAddress-shaped input, stripping address noise words", () => {
    const rows = buildSearchTokenRows({
      id: "e1",
      name: "Acme Widgets Company",
      alternateNames: [],
      aliases: [],
      addresses: [{ addressLine: "123 Main Street", city: "Springfield", stateOrProvince: null, countryName: "USA" }],
    });

    const addressRows = rows.filter((r) => r.fieldType === "ADDRESS");
    const addressTokens = addressRows.map((r) => r.normalizedToken);
    expect(addressTokens).toContain("MAIN");
    expect(addressTokens).toContain("SPRINGFIELD");
    expect(addressTokens).toContain("USA");
    expect(addressTokens).not.toContain("STREET");
    expect(addressRows.every((r) => r.tokenWeight < 1)).toBe(true);
  });

  it("falls back to flat address/city/country fields when no addresses array is given", () => {
    const rows = buildSearchTokenRows({
      id: "e1",
      name: "Acme Widgets Company",
      alternateNames: [],
      aliases: [],
      address: "456 Oak Road",
      city: "Metropolis",
      country: "USA",
    });

    const addressTokens = rows.filter((r) => r.fieldType === "ADDRESS").map((r) => r.normalizedToken);
    expect(addressTokens).toContain("OAK");
    expect(addressTokens).toContain("METROPOLIS");
    expect(addressTokens).toContain("USA");
  });

  it("emits no ADDRESS rows when no address data is present", () => {
    const rows = buildSearchTokenRows({ id: "e1", name: "Acme Widgets Company", alternateNames: [], aliases: [] });
    expect(rows.some((r) => r.fieldType === "ADDRESS")).toBe(false);
  });

  it("scopes every row to the given entity id", () => {
    const rows = buildSearchTokenRows({
      id: "entity-123",
      name: "John Smith",
      alternateNames: [],
      aliases: [],
    });
    expect(rows.every((r) => r.screeningEntityId === "entity-123")).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });
});
