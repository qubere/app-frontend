import { describe, it, expect, vi, beforeEach } from "vitest";

// Country Embargo Screening: adHocPairCheck.ts's checkCountryPair() must treat
// the legacy CYCY_IND_* columns as tri-state ("Y" / "N" / null) text, not as
// JS-truthy strings -- a "N" row (explicitly not sanctioned) or stray junk
// data must never surface a finding. Mirrors the same fix already applied to
// countryPairEvaluator.ts (see embargo-country-pair-evaluator.test.ts).

const resolveCountries = vi.fn();
const getCountryRelationship = vi.fn();

vi.mock("@/modules/agents/compliance/embargo/embargoRepository", () => ({
  resolveCountries,
  getCountryRelationship,
}));

const { checkCountryPair } = await import("@/modules/agents/compliance/embargo/adHocPairCheck");

const US = { cyId: "US", cyName: "USA", cyShortName: "USA" };
const IR = { cyId: "IR", cyName: "IRAN", cyShortName: "IRAN" };

beforeEach(() => {
  vi.clearAllMocks();
  resolveCountries.mockResolvedValue(
    new Map([
      ["US", US],
      ["IR", IR],
    ])
  );
});

describe("checkCountryPair", () => {
  it("reports embargoed for a direct row with cycyIndEmbargoed = Y", async () => {
    getCountryRelationship.mockResolvedValue({
      cycyIndEmbargoed: "Y",
      cycyIndNationalSanction: null,
      cycyIndEuSanction: null,
      cycyIndUnSanction: null,
    });

    const result = await checkCountryPair("US", "IR");

    expect(result.findings).toEqual([
      { kind: "EMBARGOED", message: "Country is embargoed. Individual Export License is required to ship to this country." },
    ]);
  });

  it("does not report a finding for a direct row with cycyIndEmbargoed = N", async () => {
    getCountryRelationship.mockResolvedValue({
      cycyIndEmbargoed: "N",
      cycyIndNationalSanction: "N",
      cycyIndEuSanction: null,
      cycyIndUnSanction: null,
    });

    const result = await checkCountryPair("US", "IR");

    expect(result.findings).toEqual([]);
  });

  it("does not report a finding for junk/non-Y-or-N indicator values", async () => {
    getCountryRelationship.mockResolvedValue({
      cycyIndEmbargoed: null,
      cycyIndNationalSanction: "r",
      cycyIndEuSanction: null,
      cycyIndUnSanction: null,
    });

    const result = await checkCountryPair("US", "IR");

    expect(result.findings).toEqual([]);
  });

  it("reports all four findings when every indicator is Y", async () => {
    getCountryRelationship.mockResolvedValue({
      cycyIndEmbargoed: "Y",
      cycyIndNationalSanction: "Y",
      cycyIndEuSanction: "Y",
      cycyIndUnSanction: "Y",
    });

    const result = await checkCountryPair("US", "IR");

    expect(result.findings.map((f) => f.kind).sort()).toEqual(
      ["EMBARGOED", "EU_SANCTION", "NATIONAL_SANCTION", "UN_SANCTION"].sort()
    );
  });

  it("returns no findings when no country-pair row exists", async () => {
    getCountryRelationship.mockResolvedValue(null);

    const result = await checkCountryPair("US", "IR");

    expect(result.findings).toEqual([]);
  });
});
