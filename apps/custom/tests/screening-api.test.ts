import { describe, it, expect, vi, beforeEach } from "vitest";

// This suite previously exercised a `ScreeningMockService` declared in this same
// file: a two-entry watchlist and a substring matcher, both written here. It
// asserted that sanctions screening worked while never loading the real code,
// which returned "passed" for every party.

const dbMock = {
  deniedPartyWatchlist: { findMany: vi.fn(), count: vi.fn() },
  embargoRule: { findMany: vi.fn(), count: vi.fn() },
  screeningLog: { create: vi.fn() },
  shipment: { findMany: vi.fn() },
  complianceScreeningFinding: { findMany: vi.fn(), createMany: vi.fn() },
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
};
// The sweep route wraps its read-then-write section in a transaction to
// close a duplicate-finding race; run the callback against this same mock so
// existing assertions against dbMock.complianceScreeningFinding still work.
dbMock.$transaction.mockImplementation(async (callback: (tx: typeof dbMock) => Promise<unknown>) => callback(dbMock));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  getAccountContext: vi.fn(async () => ({
    accountId: "acc_1",
    userId: "user_1",
    roleNames: ["ADMIN"],
    permissions: [],
    isPlatformAdmin: false,
  })),
  hasPermission: vi.fn(async () => true),
}));

const { ScreeningAgent } = await import("@/../../../packages/ai/screening/screeningAgent");
const { POST: screenParty } = await import("@/app/api/demo/screening/dps/route");
const { POST: screenEmbargo } = await import("@/app/api/screening/embargo/route");
const { POST: sweepEmbargo } = await import("@/app/api/screening/embargo/sweep/route");

function post(body: unknown) {
  return new Request("http://localhost/api", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const EMBARGO_RULES = [
  { id: "r1", countryCode: "CU", countryName: "Cuba", regime: "Comprehensive Sanctions", restriction: "31 CFR 515" },
  { id: "r2", countryCode: "IR", countryName: "Iran", regime: "Comprehensive Sanctions", restriction: "31 CFR 560" },
  {
    id: "r3",
    countryCode: "UFLPA_XINJIANG",
    countryName: "China (Xinjiang Region)",
    regime: "UFLPA Forced Labor Presumption",
    restriction: "UFLPA",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.screeningLog.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "log_1",
    screenedAt: new Date("2026-08-08T00:00:00Z"),
    ...data,
  }));
});

describe("ScreeningAgent", () => {
  it("does not report a party as passed when no provider is configured", async () => {
    const result = await ScreeningAgent.screenParty("Any Trading Co");

    // Previously returned isPassed:true for every party without consulting a list.
    expect(result.isPassed).toBeNull();
    expect(result.status).toBe("INDETERMINATE");
    expect(result.unavailableReason).toMatch(/no sanctions screening provider/i);
  });
});

describe("POST /api/demo/screening/dps", () => {
  it("refuses to clear a party when no denied party list is loaded", async () => {
    dbMock.deniedPartyWatchlist.findMany.mockResolvedValue([]);

    const res = await screenParty(post({ name: "Acme Trade Supplies LLC" }));
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.screeningResult.matchStatus).toBe("INDETERMINATE");
    expect(json.screeningResult.recommendation).not.toMatch(/clear to ship/i);
  });

  it("does not write watchlist entries of its own", async () => {
    dbMock.deniedPartyWatchlist.findMany.mockResolvedValue([]);

    await screenParty(post({ name: "Acme Trade Supplies LLC" }));

    // The route used to seed three invented companies labelled OFAC_SDN/BIS.
    expect(dbMock.deniedPartyWatchlist.count).not.toHaveBeenCalled();
    expect("createMany" in dbMock.deniedPartyWatchlist).toBe(false);
  });

  it("blocks an exact match against a loaded list", async () => {
    dbMock.deniedPartyWatchlist.findMany.mockResolvedValue([
      { entityName: "Global Defense Logistics LLC", listSource: "BIS_ENTITY_LIST", program: "RUSSIA-EO14024", country: "Russia" },
    ]);

    const res = await screenParty(post({ name: "Global Defense Logistics LLC" }));
    const json = await res.json();

    expect(json.screeningResult.matchStatus).toBe("BLOCKED");
    expect(json.screeningResult.matchedEntity.listSource).toBe("BIS_ENTITY_LIST");
  });
});

describe("POST /api/screening/embargo", () => {
  it("blocks an embargoed country given its ISO code", async () => {
    dbMock.embargoRule.findMany.mockResolvedValue(EMBARGO_RULES);

    // countryCode was stored but never compared, so "CU" reported CLEARED.
    const res = await screenEmbargo(post({ countryOfOrigin: "CU" }));
    const json = await res.json();

    expect(json.embargoResult.isEmbargoed).toBe(true);
    expect(json.embargoResult.status).toBe("BLOCKED_SANCTIONED_REGION");
  });

  it("blocks an embargoed country given its name", async () => {
    dbMock.embargoRule.findMany.mockResolvedValue(EMBARGO_RULES);

    const res = await screenEmbargo(post({ countryOfOrigin: "Cuba" }));
    const json = await res.json();

    expect(json.embargoResult.isEmbargoed).toBe(true);
  });

  it("does not treat a code appearing inside an unrelated word as a match", async () => {
    dbMock.embargoRule.findMany.mockResolvedValue(EMBARGO_RULES);

    // "IR" occurs inside "Ireland"; a naive substring test would embargo it.
    const res = await screenEmbargo(post({ countryOfOrigin: "Ireland" }));
    const json = await res.json();

    expect(json.embargoResult.isEmbargoed).toBe(false);
  });

  it("screens the transshipment port and manufacturer, not just the origin", async () => {
    dbMock.embargoRule.findMany.mockResolvedValue(EMBARGO_RULES);

    const res = await screenEmbargo(
      post({ countryOfOrigin: "Germany", transshipmentPort: "Bandar Abbas, Iran" })
    );
    const json = await res.json();

    expect(json.embargoResult.isEmbargoed).toBe(true);
  });

  it("reports not-screened rather than cleared when no rules are loaded", async () => {
    dbMock.embargoRule.findMany.mockResolvedValue([]);

    const res = await screenEmbargo(post({ countryOfOrigin: "Cuba" }));
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.embargoResult.status).toBe("NOT_SCREENED");
    expect(json.embargoResult.isEmbargoed).toBeNull();
  });
});

describe("POST /api/screening/embargo/sweep", () => {
  it("returns not-screened with a 503 when no rules are loaded", async () => {
    dbMock.embargoRule.findMany.mockResolvedValue([]);

    const res = await sweepEmbargo(post({}));
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.status).toBe("NOT_SCREENED");
    expect(dbMock.shipment.findMany).not.toHaveBeenCalled();
  });

  it("creates one finding per embargoed shipment and reuses findings that are already open", async () => {
    dbMock.embargoRule.findMany.mockResolvedValue(EMBARGO_RULES);
    dbMock.shipment.findMany.mockResolvedValue([
      { id: "shp_cu", shipmentNumber: "SHP-1", countryOfOrigin: "CU", countryOfExport: "MX" },
      { id: "shp_clean", shipmentNumber: "SHP-2", countryOfOrigin: "VN", countryOfExport: "VN" },
      { id: "shp_ir", shipmentNumber: "SHP-3", countryOfOrigin: "DE", countryOfExport: "Iran" },
    ]);
    // shp_ir already has an OPEN country-embargo finding for the Iran rule.
    dbMock.complianceScreeningFinding.findMany.mockResolvedValue([
      { shipmentId: "shp_ir", ruleId: "RULE-COUNTRY-EMBARGO-IR" },
    ]);
    dbMock.complianceScreeningFinding.createMany.mockResolvedValue({ count: 1 });

    const res = await sweepEmbargo(post({}));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.shipmentsScreened).toBe(3);
    expect(json.shipmentsWithHits).toBe(2);
    expect(json.findingsCreated).toBe(1);
    expect(json.findingsReused).toBe(1);

    const created = dbMock.complianceScreeningFinding.createMany.mock.calls[0][0].data;
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      shipmentId: "shp_cu",
      category: "COUNTRY_EMBARGO",
      ruleId: "RULE-COUNTRY-EMBARGO-CU",
      severity: "CRITICAL",
    });
  });

  it("does not write when every embargoed shipment already has an open finding", async () => {
    dbMock.embargoRule.findMany.mockResolvedValue(EMBARGO_RULES);
    dbMock.shipment.findMany.mockResolvedValue([
      { id: "shp_cu", shipmentNumber: "SHP-1", countryOfOrigin: "Cuba", countryOfExport: null },
    ]);
    dbMock.complianceScreeningFinding.findMany.mockResolvedValue([
      { shipmentId: "shp_cu", ruleId: "RULE-COUNTRY-EMBARGO-CU" },
    ]);

    const res = await sweepEmbargo(post({}));
    const json = await res.json();

    expect(json.findingsCreated).toBe(0);
    expect(json.findingsReused).toBe(1);
    expect(dbMock.complianceScreeningFinding.createMany).not.toHaveBeenCalled();
  });
});
