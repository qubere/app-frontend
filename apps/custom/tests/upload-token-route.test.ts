import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/upload/[token] is one of the routes fixed in cd37810: accountId comes
 * from a signed token rather than a session, and the route previously ran
 * the shipment lookup and the document write without ever entering the
 * AsyncLocalStorage tenant context. These tests pin the negative case -- a
 * token whose shipmentId no longer belongs to its own accountId (e.g. the
 * shipment was reassigned or deleted) must be refused, without writing a
 * document or enqueueing a pipeline job -- and that withAccountIdContext
 * actually runs before either.
 */

const verifyUploadTokenMock = vi.fn();
const withAccountIdContextSpy = vi.fn((accountId: string | null | undefined, fn: () => Promise<unknown>) => fn());

const dbMock = {
  shipment: { findFirst: vi.fn() },
  accountMembership: { findFirst: vi.fn() },
  shipmentDocument: { create: vi.fn() },
};

const storeDocumentFileMock = vi.fn();
const enqueueJobMock = vi.fn();
const screenUploadForMalwareMock = vi.fn();
const findCrossShipmentDuplicatesMock = vi.fn();
const enqueueDocumentParseMock = vi.fn();

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: () => {} };
});
vi.mock("@/lib/uploadToken", () => ({ verifyUploadToken: (t: string) => verifyUploadTokenMock(t) }));
vi.mock("@/lib/db", () => ({
  db: dbMock,
  withAccountIdContext: (accountId: string | null | undefined, fn: () => Promise<unknown>) =>
    withAccountIdContextSpy(accountId, fn),
}));
vi.mock("@/lib/storage", () => ({
  storeDocumentFile: (...args: unknown[]) => storeDocumentFileMock(...args),
  StorageValidationError: class StorageValidationError extends Error {},
}));
vi.mock("@/modules/agents/pipelineOrchestrator", () => ({
  PipelineOrchestrator: { processEvent: vi.fn().mockResolvedValue({}) },
}));
vi.mock("@/lib/queue/pgQueue", () => ({
  PgQueue: {
    enqueueJob: (...args: unknown[]) => enqueueJobMock(...args),
    claimJob: vi.fn(),
    completeJob: vi.fn(),
    failJob: vi.fn(),
  },
  toJobState: () => "COMPLETE",
}));
vi.mock("@/modules/documents/processing/documentProcessingWorker", () => ({
  enqueueDocumentParse: (...args: unknown[]) => enqueueDocumentParseMock(...args),
}));
vi.mock("@/modules/documents/processing/advanceProcessing", () => ({
  advanceDocumentProcessing: vi.fn(),
}));
vi.mock("@/modules/documents/processing/documentSource", () => ({
  assertParseableFormat: vi.fn(),
}));
vi.mock("@/modules/documents/parser/contracts", () => ({
  isDocumentParserError: () => false,
}));
vi.mock("@/modules/documents/processing/malwarePolicy", () => ({
  screenUploadForMalware: (...args: unknown[]) => screenUploadForMalwareMock(...args),
}));
vi.mock("@/modules/documents/duplicateDetection", () => ({
  findCrossShipmentDuplicates: (...args: unknown[]) => findCrossShipmentDuplicatesMock(...args),
}));

const upload = await import("@/app/api/upload/[token]/route");

const ACCOUNT = "acc_1";
const SHIPMENT = "shp_1";
const TOKEN_PAYLOAD = {
  shipmentId: SHIPMENT,
  accountId: ACCOUNT,
  documentType: "COMMERCIAL_INVOICE",
  recipientEmail: "supplier@example.com",
};

function call(token = "signed-token", file: File | null = new File(["contents"], "invoice.pdf")) {
  const formData = new FormData();
  if (file) formData.set("file", file);
  return upload.POST(
    new Request(`http://localhost/api/upload/${token}`, { method: "POST", body: formData }),
    { params: Promise.resolve({ token }) }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  withAccountIdContextSpy.mockImplementation((_accountId, fn) => fn());
  verifyUploadTokenMock.mockResolvedValue(TOKEN_PAYLOAD);
  dbMock.shipment.findFirst.mockResolvedValue({ id: SHIPMENT });
  dbMock.accountMembership.findFirst.mockResolvedValue({ userId: "u_1" });
  dbMock.shipmentDocument.create.mockResolvedValue({ id: "doc_1" });
  storeDocumentFileMock.mockResolvedValue({ url: "https://blob/invoice.pdf", checksum: "sha_1" });
  enqueueJobMock.mockResolvedValue({ id: "job_1" });
  screenUploadForMalwareMock.mockResolvedValue({ verdict: "CLEAN" });
  findCrossShipmentDuplicatesMock.mockResolvedValue([]);
  enqueueDocumentParseMock.mockResolvedValue({ blocker: null });
});

describe("POST /api/upload/[token]", () => {
  it("rejects an invalid or expired token before touching the database", async () => {
    verifyUploadTokenMock.mockRejectedValue(new Error("expired"));

    const res = await call();

    expect(res.status).toBe(401);
    expect(dbMock.shipment.findFirst).not.toHaveBeenCalled();
    expect(withAccountIdContextSpy).not.toHaveBeenCalled();
  });

  it("establishes the token's own account as tenant context before any query", async () => {
    await call();

    expect(withAccountIdContextSpy).toHaveBeenCalledWith(ACCOUNT, expect.any(Function));
    const contextCallOrder = withAccountIdContextSpy.mock.invocationCallOrder[0];
    const dbCallOrder = dbMock.shipment.findFirst.mock.invocationCallOrder[0];
    expect(contextCallOrder).toBeLessThan(dbCallOrder);
  });

  it("scopes the shipment lookup to the token's own account, not a caller-suppliable value", async () => {
    await call();

    expect(dbMock.shipment.findFirst.mock.calls[0][0].where).toEqual({
      id: SHIPMENT,
      accountId: ACCOUNT,
    });
  });

  it("refuses a token whose shipment no longer belongs to the token's account", async () => {
    // Simulates the shipment having moved accounts (or been deleted) after
    // the token was issued -- the accountId in the token is a claim, not a
    // guarantee, so the DB lookup is what actually has to fail closed.
    dbMock.shipment.findFirst.mockResolvedValue(null);

    const res = await call();

    expect(res.status).toBe(404);
    expect(dbMock.shipmentDocument.create).not.toHaveBeenCalled();
    expect(enqueueJobMock).not.toHaveBeenCalled();
    expect(storeDocumentFileMock).not.toHaveBeenCalled();
  });

  it("writes the uploaded document under the token's account, never a derived or guessed one", async () => {
    await call();

    expect(dbMock.shipmentDocument.create.mock.calls[0][0].data).toMatchObject({
      accountId: ACCOUNT,
      shipmentId: SHIPMENT,
    });
  });

  it("checks for duplicates only within the token's own account", async () => {
    await call();

    expect(findCrossShipmentDuplicatesMock).toHaveBeenCalledWith(ACCOUNT, "sha_1", SHIPMENT, "doc_1");
  });

  it("quarantines a flagged upload without writing a document or enqueueing work", async () => {
    screenUploadForMalwareMock.mockResolvedValue({ verdict: "QUARANTINE", reason: "matched signature" });

    const res = await call();

    expect(res.status).toBe(422);
    expect(dbMock.shipmentDocument.create).not.toHaveBeenCalled();
    expect(enqueueJobMock).not.toHaveBeenCalled();
  });
});
