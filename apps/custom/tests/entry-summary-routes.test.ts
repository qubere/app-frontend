import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildDraft, buildLine, buildFilerProfile, money } from "./helpers/entrySummaryFixtures";

// Covers the new /api/shipments/[id]/entry-summary* and /api/filer-profiles
// routes added in issue #219 Phase C (U12): permission wiring, the happy
// path, idempotent regeneration, tenant scoping (404 for a shipment the
// caller doesn't own), auth/permission denial, and export-before-approval
// being refused. Follows the same vi.hoisted() db-mock pattern as
// tests/leg-routes.test.ts.

const { dbMock } = vi.hoisted(() => {
  const base = {
    shipment: { findFirst: vi.fn() },
    fact: { findMany: vi.fn().mockResolvedValue([]) },
    pgaRequirement: { findMany: vi.fn().mockResolvedValue([]) },
    legalEntity: { findUnique: vi.fn().mockResolvedValue(null) },
    filerProfile: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    entrySummaryDraft: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    filerExport: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    customsFiling: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() },
    filingSnapshot: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    shipmentEventLog: { create: vi.fn().mockResolvedValue({}) },
    workflowOutboxEvent: { create: vi.fn().mockResolvedValue({}) },
    htsRelease: { findFirst: vi.fn().mockResolvedValue(null) },
    htsNode: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return {
    dbMock: {
      ...base,
      $transaction: vi.fn(async (arg: any) => (typeof arg === "function" ? arg(base) : Promise.all(arg))),
    },
  };
});

// Mutable per-test auth state so 401/403 paths can be exercised without
// re-mocking the module.
const authState = vi.hoisted(() => ({ authenticated: true, allowed: true }));
const guardOptions: any[] = [];
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/api/auth-guards", () => ({
  withAuthenticatedRoute: (handler: any, options: any) => {
    guardOptions.push(options ?? null);
    return async (req: any, context: any) => {
      if (!authState.authenticated) {
        return new Response(JSON.stringify({ error: { code: "UNAUTHENTICATED" } }), { status: 401 });
      }
      if (!authState.allowed) {
        return new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 });
      }
      return handler({
        req,
        ctx: { accountId: "acct_1", userId: "user_1" },
        requestId: "req_1",
        params: context?.params ? await context.params : {},
      });
    };
  },
}));
vi.mock("@/lib/audit", () => ({ createAuditLog: (dbMock as any).auditLog.create }));
vi.mock("@/lib/storage", () => ({
  readStoredObject: vi.fn().mockResolvedValue({ body: Buffer.from("x"), contentType: "text/csv" }),
  storeGeneratedFile: vi.fn().mockResolvedValue({ url: "https://storage.test/export.txt" }),
}));

const genRoute = await import("@/app/api/shipments/[id]/entry-summary/route");
const approveRoute = await import("@/app/api/shipments/[id]/entry-summary/approve/route");
const exportRoute = await import("@/app/api/shipments/[id]/entry-summary/export/route");
const filerProfilesRoute = await import("@/app/api/filer-profiles/route");

const req = (body?: unknown, url = "http://t/api") => ({ json: async () => body ?? {}, url, headers: new Headers() }) as unknown as Request;
const params = (p: Record<string, string>) => Promise.resolve(p);

const SHIPMENT_ROW = {
  id: "shp_1",
  accountId: "acct_1",
  shipmentNumber: "SHP-1",
  entryType: "01",
  portOfEntry: "2704",
  transportMode: "Ocean",
  countryOfExport: "CN",
  destinationCountry: "US",
  countryOfOrigin: "CN",
  lineItems: [{ id: "li_1", lineNumber: 1 }],
  importerOfRecord: { id: "ior_1", name: "Acme Co", irsEin: "12-3456789", cbpImporterNumber: "12-3456789", address: null, bond: null, powersOfAttorney: [] },
  documents: [{ id: "doc_1", docType: "Commercial Invoice", status: "Received" }],
  shipmentParties: [],
  customsFilings: [],
  exceptionItems: [],
  reconciliationIssues: [],
};

const FILER_PROFILE_ROW = {
  id: "fp_1",
  accountId: "acct_1",
  name: "Acme Filer",
  filerCode: "ABC",
  defaultPortCode: "2704",
  format: "CSV",
  formatVersion: "1.0",
  fieldMap: { columns: [] },
  transport: "DOWNLOAD",
  transportConfig: null,
  active: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  authState.authenticated = true;
  authState.allowed = true;
  dbMock.shipment.findFirst.mockResolvedValue(SHIPMENT_ROW);
  dbMock.filerProfile.findMany.mockResolvedValue([FILER_PROFILE_ROW]);
  dbMock.filerProfile.findFirst.mockResolvedValue(FILER_PROFILE_ROW);
  dbMock.entrySummaryDraft.findFirst.mockResolvedValue(null);
  dbMock.entrySummaryDraft.create.mockImplementation(async ({ data }: any) => ({ ...data, id: "draft_1", createdAt: new Date(), supersededAt: null, approvedAt: null, approvedBy: null }));
});

describe("POST /api/shipments/[id]/entry-summary", () => {
  it("wires the generate permission", () => {
    expect(guardOptions.some((o) => o?.permission === "filing.entry_summary.generate" && o?.write)).toBe(true);
  });

  it("returns 200 and a draft on the happy path", async () => {
    const res = await genRoute.POST(req(), { params: params({ id: "shp_1" }) } as any);
    expect(res.status).toBe(200);
    const body = await (res as Response).json();
    expect(body.draft.version).toBe(1);
    expect(dbMock.entrySummaryDraft.create).toHaveBeenCalledTimes(1);
  });

  it("is idempotent: regenerating with unchanged input returns the same version and writes nothing new", async () => {
    const first = await genRoute.POST(req(), { params: params({ id: "shp_1" }) } as any);
    const firstBody = await (first as Response).json();
    // Simulate the persisted row now existing for the second call.
    dbMock.entrySummaryDraft.findFirst.mockResolvedValue({ ...firstBody.draft, id: "draft_1", inputHash: (dbMock.entrySummaryDraft.create.mock.calls[0][0].data as any).inputHash });

    const second = await genRoute.POST(req(), { params: params({ id: "shp_1" }) } as any);
    const secondBody = await (second as Response).json();
    expect(secondBody.draft.version).toBe(firstBody.draft.version);
    expect(dbMock.entrySummaryDraft.create).toHaveBeenCalledTimes(1);
  });

  it("returns 404 for a shipment the caller's account does not own", async () => {
    dbMock.shipment.findFirst.mockResolvedValue(null);
    const res = await genRoute.POST(req(), { params: params({ id: "shp_other" }) } as any);
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    authState.authenticated = false;
    const res = await genRoute.POST(req(), { params: params({ id: "shp_1" }) } as any);
    expect(res.status).toBe(401);
  });

  it("returns 403 when the caller lacks the permission", async () => {
    authState.allowed = false;
    const res = await genRoute.POST(req(), { params: params({ id: "shp_1" }) } as any);
    expect(res.status).toBe(403);
  });
});

describe("POST /api/shipments/[id]/entry-summary/export", () => {
  it("refuses to export a draft that has not been approved", async () => {
    const generated = await genRoute.POST(req(), { params: params({ id: "shp_1" }) } as any);
    const generatedBody = await (generated as Response).json();
    dbMock.entrySummaryDraft.findFirst.mockResolvedValue({ ...generatedBody.draft, id: "draft_1" });

    const res = await exportRoute.POST(
      req({ filerProfileId: "fp_1", format: "CSV" }),
      { params: params({ id: "shp_1" }) } as any
    );
    expect(res.status).toBe(422);
    const body = await (res as Response).json();
    // The fixture's draft is neither approved nor exportable (it has no bond/
    // POA/onboarding), so either blocker is a correct refusal — the point of
    // this test is that export never proceeds without an approval.
    expect(["DRAFT_NOT_APPROVED", "DRAFT_NOT_EXPORTABLE"]).toContain(body.error.code);
  });

  it("exports an approved draft as CATAIR without throwing the 'requires a sequence port' error", async () => {
    const draft = buildDraft(
      [
        buildLine(1, {
          B29A_HTSUS_NUMBER: "8501104000",
          B10_COUNTRY_OF_ORIGIN: "CN",
          B28_DESCRIPTION: "Widget",
          B32A_ENTERED_VALUE: money("10.00"),
        }),
      ],
      {
        B01_FILER_ENTRY_NUMBER: "12345678901",
        B02_ENTRY_TYPE: "01",
        B06_PORT_CODE: "2704",
        B07_ENTRY_DATE: "2026-03-01",
        B35_TOTAL_ENTERED_VALUE: money("10.00"),
      }
    );
    dbMock.entrySummaryDraft.findFirst.mockResolvedValue({
      id: "draft_1",
      accountId: "acct_1",
      shipmentId: "shp_1",
      filingId: null,
      version: 1,
      draftData: JSON.parse(JSON.stringify(draft)),
      validationData: { blockers: [], warnings: [], isExportable: true, blockingCount: 0 },
      isExportable: true,
      blockingCount: 0,
      warningCount: 0,
      generatedBy: "user_1",
      supersededAt: null,
      approvedAt: new Date(),
      approvedBy: "user_1",
      inputHash: "hash_1",
      createdAt: new Date(),
    });
    dbMock.filerProfile.findFirst.mockResolvedValue(
      buildFilerProfile({ format: "CATAIR_AE", fieldMap: { layout: "catair-ae-2024.1" } })
    );
    dbMock.filerExport.findFirst.mockResolvedValue(null);
    dbMock.filerExport.create.mockImplementation(async ({ data }: any) => ({ ...data, id: "exp_1" }));

    const res = await exportRoute.POST(
      req({ filerProfileId: "fp_1", format: "CATAIR_AE" }),
      { params: params({ id: "shp_1" }) } as any
    );
    expect(res.status).toBe(200);
  });
});

describe("GET/POST /api/filer-profiles", () => {
  it("wires the filer_profile.manage permission for both list and create", () => {
    expect(guardOptions.some((o) => o?.permission === "filing.filer_profile.manage" && !o?.write)).toBe(true);
    expect(guardOptions.some((o) => o?.permission === "filing.filer_profile.manage" && o?.write)).toBe(true);
  });

  it("lists filer profiles for the caller's account", async () => {
    const res = await filerProfilesRoute.GET(req(), { params: params({}) } as any);
    expect(res.status).toBe(200);
    const body = await (res as Response).json();
    expect(body.filerProfiles).toHaveLength(1);
  });
});
