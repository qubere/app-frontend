import { describe, it, expect, vi, beforeEach } from "vitest";

// /api/v1/intake/document — partner document ingest. Covers the batch + 422
// hardening: single vs batch body, over-cap rejection, per-item validation,
// and that a queued item comes back with its documentId + candidates.

const authenticateApiKey = vi.fn();
const apiKeyHasScope = vi.fn();
vi.mock("@/lib/api/api-key-auth", () => ({ authenticateApiKey, apiKeyHasScope }));

const dbMock = {
  shipment: { findFirst: vi.fn() },
  shipmentDocument: { create: vi.fn(), update: vi.fn() },
};
vi.mock("@/lib/db", () => ({
  db: dbMock,
  withAccountIdContext: (_a: unknown, fn: () => Promise<unknown>) => fn(),
}));

const createAuditLog = vi.fn();
vi.mock("@/lib/audit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit")>("@/lib/audit");
  return { ...actual, createAuditLog };
});

const matchShipmentForDocument = vi.fn();
vi.mock("@/modules/shipments/shipmentMatching", () => ({ matchShipmentForDocument }));

vi.mock("@/lib/storage", () => {
  class StorageValidationError extends Error {}
  return {
    resolveStorageOrigin: (url: string) => {
      if (url.includes("evil.example")) throw new StorageValidationError("bad origin");
    },
    readStoredObject: vi.fn().mockResolvedValue({ body: Buffer.from("pdf"), contentType: "application/pdf" }),
    StorageValidationError,
  };
});

const { POST } = await import("@/app/api/v1/intake/document/route");

const RAW_KEY = "sk_live_intaketestkey00000";
function req(body: unknown) {
  return new Request("https://app.qubere.ai/api/v1/intake/document", {
    method: "POST",
    headers: { Authorization: `Bearer ${RAW_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticateApiKey.mockResolvedValue({ accountId: "acct_A" });
  apiKeyHasScope.mockReturnValue(true);
  dbMock.shipment.findFirst.mockResolvedValue(null);
  let n = 0;
  dbMock.shipmentDocument.create.mockImplementation(async () => ({ id: `doc_${++n}` }));
  dbMock.shipmentDocument.update.mockResolvedValue({});
  matchShipmentForDocument.mockResolvedValue({ matchedShipmentId: null, candidates: [] });
});

describe("POST /api/v1/intake/document", () => {
  it("queues a single document and returns its id + candidates", async () => {
    matchShipmentForDocument.mockResolvedValue({
      matchedShipmentId: null,
      candidates: [{ shipmentId: "shp_1", score: 0.6, best: { type: "PO_REFERENCE", value: "PO778899" } }],
    });
    const res = await POST(req({ url: "https://storage.qubere.ai/inv.pdf" }));
    expect(res.status).toBe(202);
    const json = await res.json();
    expect(json.documentId).toBe("doc_1");
    expect(json.candidates).toEqual([{ shipmentId: "shp_1", score: 0.6, matchedOn: "PO_REFERENCE:PO778899" }]);
  });

  it("rejects a batch over the cap with 422", async () => {
    const docs = Array.from({ length: 26 }, (_, i) => ({ url: `https://storage.qubere.ai/${i}.pdf` }));
    const res = await POST(req({ documents: docs }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/max 25/i);
    expect(dbMock.shipmentDocument.create).not.toHaveBeenCalled();
  });

  it("rejects a batch with an invalid item via 422 and enqueues nothing", async () => {
    const res = await POST(req({ documents: [{ url: "https://storage.qubere.ai/ok.pdf" }, { url: "not-a-url" }] }));
    expect(res.status).toBe(422);
    expect(dbMock.shipmentDocument.create).not.toHaveBeenCalled();
  });

  it("returns per-item results for a valid batch", async () => {
    const res = await POST(
      req({
        documents: [
          { url: "https://storage.qubere.ai/a.pdf" },
          { url: "https://evil.example.com/b.pdf" },
        ],
      })
    );
    expect(res.status).toBe(202);
    const json = await res.json();
    expect(json.results).toHaveLength(2);
    expect(json.results[0]).toMatchObject({ index: 0, status: "queued", documentId: "doc_1" });
    expect(json.results[1]).toMatchObject({ index: 1, status: "error" });
  });

  it("401 without a key, 403 without the scope", async () => {
    authenticateApiKey.mockResolvedValueOnce(null);
    expect((await POST(req({ url: "https://storage.qubere.ai/x.pdf" }))).status).toBe(401);

    apiKeyHasScope.mockReturnValueOnce(false);
    expect((await POST(req({ url: "https://storage.qubere.ai/x.pdf" }))).status).toBe(403);
  });
});
