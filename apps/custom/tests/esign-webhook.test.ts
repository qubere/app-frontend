import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The e-sign webhook route previously only accepted DROPBOX_SIGN, even though
// OpenSign is the only provider with a working createEnvelope/getEnvelope
// implementation — DropboxSignProvider's own create/get methods throw
// "not yet implemented". A POA signed through OpenSign had no automatic path
// to mark itself complete. This suite covers the OPEN_SIGN webhook path.

const dbMock = {
  poaEnvelope: { findFirst: vi.fn(), update: vi.fn() },
  powerOfAttorney: { update: vi.fn() },
  onboardingEntity: { findMany: vi.fn().mockResolvedValue([]) },
  onboardingEvent: { upsert: vi.fn() },
  poaTemplate: { findUnique: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
};

vi.mock("@/lib/db", () => ({
  db: dbMock,
  runWithAccountId: vi.fn(async (_accountId: string, cb: () => unknown) => cb()),
}));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn() }));

vi.mock('@qubere/storage', () => ({ storeDocumentBytes: vi.fn(async () => ({ url: 'stored://executed-poa' })) }));
vi.mock('@/lib/portal/clientSetup', () => ({ promoteSetupForPoa: vi.fn() }));
import { OpenSignProvider } from '@/lib/esign/providers/openSignProvider';
import { storeDocumentBytes } from '@qubere/storage';
import { promoteSetupForPoa } from '@/lib/portal/clientSetup';

const WEBHOOK_SECRET = "test-open-sign-secret";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(OpenSignProvider.prototype, 'getEnvelope').mockResolvedValue({ providerEnvelopeId: 'doc_1', status: 'completed', signerName: 'Signer', signerEmail: 'signer@example.com' });
  vi.spyOn(OpenSignProvider.prototype, 'downloadExecutedDocument').mockResolvedValue(Buffer.from('%PDF signed'));
  vi.stubEnv("OPEN_SIGN_WEBHOOK_SECRET", WEBHOOK_SECRET);
  dbMock.$transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

const { POST } = await import("@/app/api/webhooks/esign/[provider]/route");

function postWebhook(provider: string, payload: unknown, secret?: string) {
  const url = new URL(`http://localhost/api/webhooks/esign/${provider}`);
  if (secret !== undefined) url.searchParams.set("secret", secret);
  return POST(new Request(url, { method: "POST", body: JSON.stringify(payload) }), {
    params: Promise.resolve({ provider }),
  });
}

describe("e-sign webhook — OpenSign", () => {
  it("rejects a request with the wrong secret", async () => {
    const res = await postWebhook("open_sign", { objectId: "doc_1", IsCompleted: true }, "wrong-secret");
    expect(res.status).toBe(400);
    expect(dbMock.poaEnvelope.findFirst).not.toHaveBeenCalled();
  });

  it("rejects a request with no secret", async () => {
    const res = await postWebhook("open_sign", { objectId: "doc_1", IsCompleted: true });
    expect(res.status).toBe(400);
  });

  it("marks the envelope and POA executed on a completed event with a valid secret", async () => {
    dbMock.poaEnvelope.findFirst.mockResolvedValue({
      id: "env_1",
      providerEnvelopeId: "doc_1",
      webhookEventsRaw: [],
      powerOfAttorney: {
        id: "poa_1",
        accountId: "acc_1",
        templateId: null,
        expirationDate: null,
      },
    });

    const res = await postWebhook(
      "open_sign",
      { objectId: "doc_1", IsCompleted: true, updatedAt: "2026-09-01T00:00:00.000Z" },
      WEBHOOK_SECRET,
    );

    expect(res.status).toBe(200);
    expect(storeDocumentBytes).toHaveBeenCalled();
    expect(promoteSetupForPoa).toHaveBeenCalledWith('acc_1', 'poa_1');
    expect(dbMock.$transaction).toHaveBeenCalledTimes(1);
    expect(dbMock.poaEnvelope.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "env_1" }, data: expect.objectContaining({ status: "completed" }) }),
    );
    expect(dbMock.powerOfAttorney.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "poa_1" }, data: expect.objectContaining({ status: "executed" }) }),
    );
  });

  it("ignores an event for an envelope it doesn't recognize", async () => {
    dbMock.poaEnvelope.findFirst.mockResolvedValue(null);
    const res = await postWebhook("open_sign", { objectId: "doc_unknown", IsCompleted: true }, WEBHOOK_SECRET);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ignored: true });
  });

  it("still rejects providers outside the allowlist", async () => {
    const res = await postWebhook("docusign", { objectId: "doc_1" });
    expect(res.status).toBe(400);
  });
});
