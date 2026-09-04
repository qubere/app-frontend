import { describe, it, expect, vi, beforeEach } from "vitest";

// Covers the /api/shipments/[id]/legs/* routes: permission wiring, tenant
// scoping (404 for a shipment the caller doesn't own), the shared-stop
// invariant on create, and the guardrails on edit / delete / reorder / infer.

const { dbMock } = vi.hoisted(() => {
  const leg = {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const stop = { create: vi.fn(), aggregate: vi.fn().mockResolvedValue({ _max: { sequence: 0 } }) };
  const base = {
    shipmentLeg: leg,
    shipmentStop: stop,
    shipmentDocument: { findFirst: vi.fn() },
    shipmentLegDocument: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findFirst: vi.fn() },
    legInferenceRun: { upsert: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
  };
  return {
    dbMock: {
      ...base,
      $transaction: vi.fn(async (arg: any) => (typeof arg === "function" ? arg(base) : Promise.all(arg))),
    },
  };
});

const guardOptions: any[] = [];
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/api/auth-guards", () => ({
  withAuthenticatedRoute: (handler: any, options: any) => {
    guardOptions.push(options ?? null);
    return async (req: any, context: any) =>
      handler({
        req,
        ctx: { accountId: "acct_1", userId: "user_1" },
        requestId: "req_1",
        params: context?.params ? await context.params : {},
      });
  },
}));
vi.mock("@/modules/tracking/shipmentTracking", () => ({
  getShipmentTrackingProjection: vi.fn().mockResolvedValue({ journey: { legs: [], stops: [] } }),
}));

const legService = vi.hoisted(() => ({
  resolveOwnedShipment: vi.fn(),
  resequenceLegs: vi.fn(),
  nextStopSequence: vi.fn().mockResolvedValue(1),
}));
vi.mock("@/modules/legs/legService", () => legService);

const inferenceInputs = vi.hoisted(() => ({
  loadInferenceInputs: vi.fn().mockResolvedValue({ documents: [], identifiers: [], existingLegs: [] }),
  legSnapshots: vi.fn().mockReturnValue([]),
}));
vi.mock("@/modules/legs/inferenceInputs", () => inferenceInputs);

const legsPkg = vi.hoisted(() => ({
  runInference: vi.fn(),
  applyInferredJourney: vi.fn().mockResolvedValue("run_1"),
  appendInferredLegs: vi.fn().mockResolvedValue("run_1"),
  inferLegDocuments: vi.fn().mockReturnValue({ slots: [] }),
  matchDocumentToSlot: vi.fn().mockReturnValue(null),
}));
vi.mock("@qubere/shipment-legs", () => legsPkg);

const routes = await import("@/app/api/shipments/[id]/legs/route");
const legRoute = await import("@/app/api/shipments/[id]/legs/[legId]/route");
const reorderRoute = await import("@/app/api/shipments/[id]/legs/reorder/route");
const inferRoute = await import("@/app/api/shipments/[id]/legs/infer/route");
const acceptRoute = await import("@/app/api/shipments/[id]/legs/infer/accept/route");

const OWNED = {
  id: "shp_1",
  accountId: "acct_1",
  shipmentNumber: "SHP-1",
  transportMode: "Ocean",
  countryOfExport: "CN",
  countryOfOrigin: "CN",
  destinationCountry: "US",
  portOfEntry: "USLAX",
  incoterm: "FOB",
};

const req = (body?: unknown, url = "http://t/api") => ({ json: async () => body ?? {}, url });
const params = (p: Record<string, string>) => Promise.resolve(p);

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.shipmentStop.aggregate.mockResolvedValue({ _max: { sequence: 0 } });
  legService.nextStopSequence.mockResolvedValue(1);
});

describe("permission wiring", () => {
  it("every mutating leg route requires the shipments.manage write permission", () => {
    // GET /legs is read-only (no options); every other export is a write route.
    const writeOptions = guardOptions.filter((o) => o && o.write);
    expect(writeOptions.length).toBeGreaterThanOrEqual(6);
    expect(writeOptions.every((o) => o.permission === "shipments.manage")).toBe(true);
  });
});

describe("POST /legs", () => {
  it("404s for a shipment the caller does not own", async () => {
    legService.resolveOwnedShipment.mockResolvedValue(null);
    const res = await routes.POST(req({ destinationName: "Busan" }) as any, { params: params({ id: "shp_x" }) });
    expect(res.status).toBe(404);
  });

  it("creates the first leg with its own origin + destination stop", async () => {
    legService.resolveOwnedShipment.mockResolvedValue(OWNED);
    dbMock.shipmentLeg.findMany.mockResolvedValue([]);
    dbMock.shipmentStop.create
      .mockResolvedValueOnce({ id: "stop_origin" })
      .mockResolvedValueOnce({ id: "stop_dest" });
    dbMock.shipmentLeg.create.mockResolvedValue({ id: "leg_1", sequence: 1 });

    const res = await routes.POST(
      req({ destinationName: "Busan", legType: "MAIN_CARRIAGE", mode: "OCEAN" }) as any,
      { params: params({ id: "shp_1" }) }
    );
    expect(res.status).toBe(201);
    expect(dbMock.shipmentStop.create).toHaveBeenCalledTimes(2);
    const legArg = dbMock.shipmentLeg.create.mock.calls[0][0].data;
    expect(legArg.originStopId).toBe("stop_origin");
    expect(legArg.destinationStopId).toBe("stop_dest");
    expect(legArg.source).toBe("MANUAL");
  });

  it("reuses the previous leg's destination stop as the new leg's origin (shared-stop invariant)", async () => {
    legService.resolveOwnedShipment.mockResolvedValue(OWNED);
    dbMock.shipmentLeg.findMany.mockResolvedValue([
      { id: "leg_1", sequence: 1, destinationStopId: "stop_prevdest" },
    ]);
    dbMock.shipmentStop.create.mockResolvedValueOnce({ id: "stop_newdest" });
    dbMock.shipmentLeg.create.mockResolvedValue({ id: "leg_2", sequence: 2 });

    await routes.POST(req({ destinationName: "Long Beach" }) as any, { params: params({ id: "shp_1" }) });
    expect(dbMock.shipmentStop.create).toHaveBeenCalledTimes(1); // only the new destination
    expect(dbMock.shipmentLeg.create.mock.calls[0][0].data.originStopId).toBe("stop_prevdest");
  });
});

describe("PATCH /legs/[legId]", () => {
  it("rejects a mode change once the leg has left PLANNED", async () => {
    dbMock.shipmentLeg.findFirst.mockResolvedValue({
      id: "leg_1", accountId: "acct_1", shipmentId: "shp_1", mode: "OCEAN", status: "IN_TRANSIT",
    });
    const res = await legRoute.PATCH(req({ mode: "AIR" }) as any, { params: params({ id: "shp_1", legId: "leg_1" }) });
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("LEG_MODE_LOCKED");
  });

  it("allows other edits on an in-transit leg", async () => {
    dbMock.shipmentLeg.findFirst.mockResolvedValue({
      id: "leg_1", accountId: "acct_1", shipmentId: "shp_1", mode: "OCEAN", status: "IN_TRANSIT",
      carrierName: null, statusReason: null,
    });
    dbMock.shipmentLeg.update.mockResolvedValue({ id: "leg_1" });
    const res = await legRoute.PATCH(req({ carrierName: "COSCO" }) as any, { params: params({ id: "shp_1", legId: "leg_1" }) });
    expect(res.status).toBe(200);
  });
});

describe("DELETE /legs/[legId]", () => {
  it("refuses to delete a leg that has recorded actuals", async () => {
    dbMock.shipmentLeg.findFirst.mockResolvedValue({
      id: "leg_1", accountId: "acct_1", shipmentId: "shp_1", actualDeparture: new Date(), actualArrival: null,
    });
    const res = await legRoute.DELETE(req() as any, { params: params({ id: "shp_1", legId: "leg_1" }) });
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("LEG_HAS_ACTUALS");
  });

  it("deletes a planned leg and re-sequences the rest", async () => {
    dbMock.shipmentLeg.findFirst.mockResolvedValue({
      id: "leg_2", accountId: "acct_1", shipmentId: "shp_1", actualDeparture: null, actualArrival: null,
    });
    dbMock.shipmentLeg.findMany.mockResolvedValue([{ id: "leg_1" }, { id: "leg_3" }]);
    const res = await legRoute.DELETE(req() as any, { params: params({ id: "shp_1", legId: "leg_2" }) });
    expect(res.status).toBe(200);
    expect(legService.resequenceLegs).toHaveBeenCalledWith(expect.anything(), "shp_1", ["leg_1", "leg_3"]);
  });
});

describe("POST /legs/reorder", () => {
  it("422s when legIds is not a permutation of the shipment's legs", async () => {
    legService.resolveOwnedShipment.mockResolvedValue(OWNED);
    dbMock.shipmentLeg.findMany.mockResolvedValue([{ id: "leg_1" }, { id: "leg_2" }]);
    const res = await reorderRoute.POST(req({ legIds: ["leg_1", "leg_9"] }) as any, { params: params({ id: "shp_1" }) });
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("LEG_REORDER_MISMATCH");
  });

  it("re-sequences on a valid permutation", async () => {
    legService.resolveOwnedShipment.mockResolvedValue(OWNED);
    dbMock.shipmentLeg.findMany.mockResolvedValue([{ id: "leg_1" }, { id: "leg_2" }]);
    const res = await reorderRoute.POST(req({ legIds: ["leg_2", "leg_1"] }) as any, { params: params({ id: "shp_1" }) });
    expect(res.status).toBe(200);
    expect(legService.resequenceLegs).toHaveBeenCalledWith(expect.anything(), "shp_1", ["leg_2", "leg_1"]);
  });
});

describe("POST /legs/infer", () => {
  it("auto-applies the inferred journey when the shipment has no legs", async () => {
    legService.resolveOwnedShipment.mockResolvedValue(OWNED);
    inferenceInputs.loadInferenceInputs.mockResolvedValue({ documents: [], identifiers: [], existingLegs: [] });
    legsPkg.runInference.mockReturnValue({
      inference: { inputsHash: "hash1", legs: [{ sequence: 1 }], overallConfidence: 0.7 },
      proposal: { hasChanges: true, changes: [] },
    });
    const res = await inferRoute.POST(req() as any, { params: params({ id: "shp_1" }) });
    const body = await res.json();
    expect(body.applied).toBe(true);
    expect(legsPkg.applyInferredJourney).toHaveBeenCalled();
  });

  it("returns a proposal (no apply) when the shipment already has legs", async () => {
    legService.resolveOwnedShipment.mockResolvedValue(OWNED);
    inferenceInputs.loadInferenceInputs.mockResolvedValue({
      documents: [], identifiers: [], existingLegs: [{ id: "leg_1" }],
    });
    legsPkg.runInference.mockReturnValue({
      inference: { inputsHash: "hash2", legs: [{ sequence: 1 }, { sequence: 2 }], overallConfidence: 0.6 },
      proposal: { hasChanges: true, changes: [{ type: "ADD", description: "add leg 2" }] },
    });
    dbMock.legInferenceRun.upsert.mockResolvedValue({ id: "run_2" });
    const res = await inferRoute.POST(req() as any, { params: params({ id: "shp_1" }) });
    const body = await res.json();
    expect(body.applied).toBe(false);
    expect(body.proposal.changes).toHaveLength(1);
    expect(legsPkg.applyInferredJourney).not.toHaveBeenCalled();
  });
});

describe("POST /legs/infer/accept", () => {
  it("409s when there is no pending run for the given inputsHash", async () => {
    legService.resolveOwnedShipment.mockResolvedValue(OWNED);
    dbMock.legInferenceRun.findFirst.mockResolvedValue(null);
    const res = await acceptRoute.POST(req({ inputsHash: "does-not-exist" }) as any, { params: params({ id: "shp_1" }) });
    expect(res.status).toBe(409);
  });

  it("409s when the proposal is stale (documents changed since it was generated)", async () => {
    legService.resolveOwnedShipment.mockResolvedValue(OWNED);
    dbMock.legInferenceRun.findFirst.mockResolvedValue({ id: "run_3", status: "PROPOSED" });
    inferenceInputs.loadInferenceInputs.mockResolvedValue({ documents: [], identifiers: [], existingLegs: [] });
    legsPkg.runInference.mockReturnValue({
      inference: { inputsHash: "fresh-hash", legs: [], overallConfidence: 0 },
      proposal: { hasChanges: false, changes: [] },
    });
    const res = await acceptRoute.POST(req({ inputsHash: "old-hash" }) as any, { params: params({ id: "shp_1" }) });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("PROPOSAL_STALE");
  });
});
