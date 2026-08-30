import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  shipmentDocument: { findUnique: vi.fn(), update: vi.fn() },
};
vi.mock("@/lib/db", () => ({ db: dbMock }));

const createAuditLog = vi.fn();
vi.mock("@/lib/audit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit")>("@/lib/audit");
  return { ...actual, createAuditLog };
});

const notifyAccountRoleHolders = vi.fn().mockResolvedValue(1);
vi.mock("@/modules/notifications/notifyAccount", () => ({ notifyAccountRoleHolders }));

const scanForMalware = vi.fn();
vi.mock("@/lib/security/clamav", async () => {
  const actual = await vi.importActual<typeof import("@/lib/security/clamav")>("@/lib/security/clamav");
  return { ...actual, scanForMalware };
});

const { scanDocumentForMalware } = await import("@/lib/security/scanDocument");

const CLEAN_PDF = Buffer.from("%PDF-1.4 hello");

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.shipmentDocument.findUnique.mockResolvedValue({
    id: "doc_1",
    accountId: "acct_A",
    fileName: "invoice.pdf",
    malwareScanStatus: "PENDING",
  });
  dbMock.shipmentDocument.update.mockResolvedValue({});
  scanForMalware.mockResolvedValue({ status: "CLEAN", scanner: "clamav" });
});

describe("scanDocumentForMalware", () => {
  it("records a CLEAN scan and reports safe", async () => {
    const r = await scanDocumentForMalware("doc_1", CLEAN_PDF);
    expect(r.safe).toBe(true);
    expect(dbMock.shipmentDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ malwareScanStatus: "CLEAN" }) })
    );
    // No quarantine, no notification.
    expect(dbMock.shipmentDocument.update.mock.calls[0][0].data.status).toBeUndefined();
    expect(notifyAccountRoleHolders).not.toHaveBeenCalled();
  });

  it("quarantines and notifies on an INFECTED verdict", async () => {
    scanForMalware.mockResolvedValue({ status: "INFECTED", detail: "Eicar-Test", scanner: "clamav" });
    const r = await scanDocumentForMalware("doc_1", CLEAN_PDF);
    expect(r.safe).toBe(false);
    expect(dbMock.shipmentDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ malwareScanStatus: "INFECTED", status: "QUARANTINED" }),
      })
    );
    expect(notifyAccountRoleHolders).toHaveBeenCalledWith(
      expect.objectContaining({ type: "DOCUMENT_QUARANTINED", entityId: "doc_1", dedupe: true })
    );
  });

  it("fails closed on a scanner ERROR (quarantine)", async () => {
    scanForMalware.mockResolvedValue({ status: "ERROR", detail: "clamd timeout", scanner: "clamav" });
    const r = await scanDocumentForMalware("doc_1", CLEAN_PDF);
    expect(r.safe).toBe(false);
    expect(dbMock.shipmentDocument.update.mock.calls[0][0].data.status).toBe("QUARANTINED");
  });

  it("catches an executable disguised as a PDF via the in-process heuristic", async () => {
    const mzExe = Buffer.concat([Buffer.from([0x4d, 0x5a]), Buffer.alloc(20)]);
    const r = await scanDocumentForMalware("doc_1", mzExe);
    expect(r.safe).toBe(false);
    expect(r.result.scanner).toBe("heuristic");
    // Heuristic hit short-circuits — the network scanner is never called.
    expect(scanForMalware).not.toHaveBeenCalled();
  });

  it("does not re-scan a document already CLEAN unless forced", async () => {
    dbMock.shipmentDocument.findUnique.mockResolvedValue({
      id: "doc_1",
      accountId: "acct_A",
      fileName: "invoice.pdf",
      malwareScanStatus: "CLEAN",
    });
    const r = await scanDocumentForMalware("doc_1", CLEAN_PDF);
    expect(r).toMatchObject({ safe: true, scanned: false });
    expect(scanForMalware).not.toHaveBeenCalled();
    expect(dbMock.shipmentDocument.update).not.toHaveBeenCalled();
  });
});
