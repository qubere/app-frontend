vi.mock('@/modules/inbound/inboundNotifications', () => ({ summarizeInboundReceipt: vi.fn() }));
import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  $transaction: (fn: (tx: unknown) => unknown) => fn(dbMock),
  inboundAddress: { findUnique: vi.fn() },
  inboundSenderRoute: { findMany: vi.fn() },
  inboundDocumentReview: { count: vi.fn().mockResolvedValue(0) },
  inboundEmail: {
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    findMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
  inboundAttachment: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  shipmentDocument: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  notification: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
};

const storeDocumentFileMock = vi.fn();
const screenUploadForMalwareMock = vi.fn();
const enqueueDocumentParseMock = vi.fn();
const resolveInboundRouteMock = vi.fn();
const resolveBlockedInboundRouteMock = vi.fn();
const getReceivedEmailMock = vi.fn();
const getAttachmentDownloadInfoMock = vi.fn();
const downloadAttachmentBytesMock = vi.fn();
const createAuditLogMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: dbMock,
  runWithAccountId: (_accountId: string | null | undefined, fn: () => unknown) => fn(),
  withAccountIdContext: (_accountId: string | null | undefined, fn: () => Promise<unknown>) => fn(),
  runWithDataMode: (_mode: string | null | undefined, fn: () => unknown) => fn(),
  withDataModeContext: (_mode: string | null | undefined, fn: () => Promise<unknown>) => fn(),
}));
vi.mock("@/modules/inbound/inboundDocumentRouting", () => ({ openInboundReview: vi.fn() }));
vi.mock("@/modules/notifications/notifyAccount", () => ({ notifyAccountRoleHolders: vi.fn() }));
vi.mock("@/lib/audit", () => ({
  createAuditLog: createAuditLogMock,
  AuditAction: { DOCUMENT_STORED: "document.stored", INBOUND_EMAIL_ATTACHMENT_QUARANTINED: "inbound_email.attachment_quarantined" },
}));
vi.mock("@/lib/storage", () => ({
  storeDocumentFile: storeDocumentFileMock,
  StorageValidationError: class StorageValidationError extends Error {},
}));
vi.mock("@/modules/documents/processing/malwarePolicy", () => ({
  screenUploadForMalware: screenUploadForMalwareMock,
}));
vi.mock("@/modules/documents/processing/documentSource", () => ({
  assertParseableFormat: vi.fn(),
}));
vi.mock("@/modules/documents/processing/documentProcessingWorker", () => ({
  enqueueDocumentParse: enqueueDocumentParseMock,
}));
vi.mock("@/modules/inbound/senderRouting", () => ({
  resolveInboundRoute: resolveInboundRouteMock,
  resolveBlockedInboundRoute: resolveBlockedInboundRouteMock,
}));
vi.mock("@/lib/inbound/resendClient", () => ({
  getReceivedEmail: getReceivedEmailMock,
  getAttachmentDownloadInfo: getAttachmentDownloadInfoMock,
  downloadAttachmentBytes: downloadAttachmentBytesMock,
}));
vi.mock("@/modules/intake/documentTypeCatalog", () => ({
  DocumentTypeCatalog: { matchDocumentType: () => ({ name: "COMMERCIAL_INVOICE" }) },
}));

const ROUTE = { id: "route_1", accountId: "acct_a", defaultAssignedToUserId: "user_jane" };
const RECEIVED_EMAIL = {
  id: "in_1",
  accountId: null,
  normalizedFromAddress: "jane@acme.com",
  originalFromAddress: "Jane <jane@acme.com>",
  providerEmailId: "resend_email_1",
  authHeaders: null,
  routingStatus: "RECEIVED",
};

describe("inbound email worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveBlockedInboundRouteMock.mockResolvedValue(null);
    dbMock.inboundEmail.findUniqueOrThrow.mockResolvedValue(RECEIVED_EMAIL);
    dbMock.inboundEmail.update.mockImplementation(async ({ data }) => ({ ...RECEIVED_EMAIL, ...data, accountId: data.accountId ?? "acct_a" }));
    resolveInboundRouteMock.mockResolvedValue(ROUTE);
    getReceivedEmailMock.mockResolvedValue({
      id: "resend_email_1",
      from: "jane@acme.com",
      to: ["docs@inbound.qubere.ai"],
      subject: "Invoice",
      receivedFor: ["docs@inbound.qubere.ai"],
      headers: { "X-Test": "1" },
      attachments: [],
    });
    dbMock.inboundAttachment.findUnique.mockResolvedValue(null);
    dbMock.inboundAttachment.upsert.mockImplementation(async ({ create }) => ({ id: "att_row_1", ...create }));
    dbMock.notification.findFirst.mockResolvedValue(null);
    dbMock.shipmentDocument.findMany.mockResolvedValue([]);
    createAuditLogMock.mockResolvedValue(null);
  });

  it("quarantines an unknown sender without creating any document or storage call", async () => {
    resolveInboundRouteMock.mockResolvedValue(null);
    dbMock.inboundEmail.findMany.mockResolvedValue([{ id: "in_1" }]);

    const { runInboundEmailWorkerTick } = await import("@/modules/documents/processing/inboundEmailWorker");
    const result = await runInboundEmailWorkerTick();

    expect(result.quarantined).toBe(1);
    expect(dbMock.inboundEmail.update).toHaveBeenCalledWith({
      where: { id: "in_1" },
      data: { routingStatus: "QUARANTINED", quarantineReason: "unknown_sender" },
    });
    expect(storeDocumentFileMock).not.toHaveBeenCalled();
    expect(dbMock.shipmentDocument.create).not.toHaveBeenCalled();
  });

  it("rejects a blocked sender before fetching the provider email or attachments", async () => {
    resolveBlockedInboundRouteMock.mockResolvedValue({
      id: "route_blocked",
      accountId: "acct_a",
      defaultAssignedToUserId: null,
    });
    dbMock.inboundEmail.findMany.mockResolvedValue([{ id: "in_1" }]);

    const { runInboundEmailWorkerTick } = await import("@/modules/documents/processing/inboundEmailWorker");
    const result = await runInboundEmailWorkerTick();

    expect(result.rejected).toBe(1);
    expect(dbMock.inboundEmail.update).toHaveBeenCalledWith({
      where: { id: "in_1" },
      data: { accountId: "acct_a", routingStatus: "REJECTED", quarantineReason: "blocked_sender" },
    });
    expect(getReceivedEmailMock).not.toHaveBeenCalled();
    expect(storeDocumentFileMock).not.toHaveBeenCalled();
  });

  it("downloads and stores an unknown sender's attachment into quarantine instead of dropping it", async () => {
    resolveInboundRouteMock.mockResolvedValue(null);
    getReceivedEmailMock.mockResolvedValue({
      id: "resend_email_1",
      from: "stranger@example.com",
      to: ["docs@inbound.qubere.ai"],
      subject: "Invoice",
      receivedFor: ["docs@inbound.qubere.ai"],
      headers: {},
      attachments: [
        { id: "att_1", filename: "invoice.pdf", size: 2048, contentType: "application/pdf", contentId: null, contentDisposition: "attachment" },
      ],
    });
    dbMock.inboundEmail.findMany.mockResolvedValue([{ id: "in_1" }]);
    getAttachmentDownloadInfoMock.mockResolvedValue({
      filename: "invoice.pdf",
      size: 2048,
      contentType: "application/pdf",
      contentDisposition: "attachment",
      downloadUrl: "https://signed.example/download",
    });
    downloadAttachmentBytesMock.mockResolvedValue(Buffer.from("%PDF-1.4\n...\n%%EOF"));
    screenUploadForMalwareMock.mockResolvedValue({ verdict: "NOT_SCANNED", reason: "no scanner configured", scannerName: null });
    storeDocumentFileMock.mockResolvedValue({
      url: "https://blob.vercel-storage.com/quarantine/x",
      checksum: "quarantinedchecksum",
      provider: "vercel-blob",
    });

    const { runInboundEmailWorkerTick } = await import("@/modules/documents/processing/inboundEmailWorker");
    const result = await runInboundEmailWorkerTick();

    expect(result.quarantined).toBe(1);
    expect(getAttachmentDownloadInfoMock).toHaveBeenCalled();
    expect(downloadAttachmentBytesMock).toHaveBeenCalled();
    expect(storeDocumentFileMock).toHaveBeenCalledWith(expect.anything(), "invoice.pdf", "quarantine");
    expect(dbMock.inboundAttachment.update).toHaveBeenCalledWith({
      where: { id: "att_row_1" },
      data: {
        processingStatus: "QUARANTINED",
        checksum: "quarantinedchecksum",
        quarantinedFileUrl: "https://blob.vercel-storage.com/quarantine/x",
        actualSize: 18,
        declaredMimeType: "application/pdf",
      },
    });
    expect(dbMock.shipmentDocument.create).not.toHaveBeenCalled();
    expect(enqueueDocumentParseMock).not.toHaveBeenCalled();
    expect(createAuditLogMock).not.toHaveBeenCalled();
    expect(dbMock.inboundEmail.update).toHaveBeenCalledWith({
      where: { id: "in_1" },
      data: { routingStatus: "QUARANTINED", quarantineReason: "unknown_sender" },
    });
  });

  it("records an inline attachment as SKIPPED_INLINE and never stores or parses it", async () => {
    getReceivedEmailMock.mockResolvedValue({
      id: "resend_email_1",
      from: "jane@acme.com",
      to: ["docs@inbound.qubere.ai"],
      subject: "Invoice",
      receivedFor: ["docs@inbound.qubere.ai"],
      headers: {},
      attachments: [
        { id: "att_logo", filename: "logo.png", size: 900, contentType: "image/png", contentId: "logo1", contentDisposition: "inline" },
      ],
    });
    dbMock.inboundEmail.findMany.mockResolvedValue([{ id: "in_1" }]);

    const { runInboundEmailWorkerTick } = await import("@/modules/documents/processing/inboundEmailWorker");
    await runInboundEmailWorkerTick();

    expect(dbMock.inboundAttachment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ processingStatus: "SKIPPED_INLINE" }),
      })
    );
    expect(getAttachmentDownloadInfoMock).not.toHaveBeenCalled();
    expect(storeDocumentFileMock).not.toHaveBeenCalled();
    expect(enqueueDocumentParseMock).not.toHaveBeenCalled();
  });

  it("stores a real attachment, assigns the route's default assignee, and enqueues parse-once extraction with the stored checksum", async () => {
    getReceivedEmailMock.mockResolvedValue({
      id: "resend_email_1",
      from: "jane@acme.com",
      to: ["docs@inbound.qubere.ai"],
      subject: "Invoice",
      receivedFor: ["docs@inbound.qubere.ai"],
      headers: {},
      attachments: [
        { id: "att_1", filename: "invoice.pdf", size: 2048, contentType: "application/pdf", contentId: null, contentDisposition: "attachment" },
      ],
    });
    dbMock.inboundEmail.findMany.mockResolvedValue([{ id: "in_1" }]);
    getAttachmentDownloadInfoMock.mockResolvedValue({
      filename: "invoice.pdf",
      size: 2048,
      contentType: "application/pdf",
      contentDisposition: "attachment",
      downloadUrl: "https://signed.example/download",
    });
    downloadAttachmentBytesMock.mockResolvedValue(Buffer.from("%PDF-1.4\n...\n%%EOF"));
    screenUploadForMalwareMock.mockResolvedValue({ verdict: "NOT_SCANNED", reason: "no scanner configured", scannerName: null });
    storeDocumentFileMock.mockResolvedValue({
      url: "https://blob.vercel-storage.com/x",
      checksum: "abc123checksum",
      provider: "vercel-blob",
    });
    dbMock.shipmentDocument.create.mockResolvedValue({ id: "doc_1" });

    const { runInboundEmailWorkerTick } = await import("@/modules/documents/processing/inboundEmailWorker");
    const result = await runInboundEmailWorkerTick();

    expect(result.accepted).toBe(1);
    expect(dbMock.shipmentDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: "acct_a",
        shipmentId: null,
        source: "EMAIL",
        assignedToUserId: "user_jane",
        checksum: "abc123checksum",
      }),
    });
    expect(enqueueDocumentParseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "acct_a",
        documentId: "doc_1",
        contentSha256: "abc123checksum",
        profile: "STANDARD",
        reason: "INITIAL",
      })
    );
    expect(dbMock.inboundAttachment.update).toHaveBeenCalledWith({
      where: { id: "att_row_1" },
      data: { processingStatus: "STORED", checksum: "abc123checksum", shipmentDocumentId: "doc_1" },
    });
    expect(dbMock.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: "acct_a",
        userId: "user_jane",
        type: "INBOUND_EMAIL_DOCUMENTS",
        message: "1 new document from Jane <jane@acme.com>",
        entityType: "InboundEmail",
        entityId: "in_1",
      }),
    });
  });

  it("creates no notification when every attachment is quarantined/rejected", async () => {
    getReceivedEmailMock.mockResolvedValue({
      id: "resend_email_1",
      from: "jane@acme.com",
      to: ["docs@inbound.qubere.ai"],
      subject: "Invoice",
      receivedFor: ["docs@inbound.qubere.ai"],
      headers: {},
      attachments: [
        { id: "att_bad", filename: "bad.pdf", size: 10, contentType: "application/pdf", contentId: null, contentDisposition: "attachment" },
      ],
    });
    dbMock.inboundEmail.findMany.mockResolvedValue([{ id: "in_1" }]);
    getAttachmentDownloadInfoMock.mockResolvedValue({
      filename: "bad.pdf",
      size: 10,
      contentType: "application/pdf",
      contentDisposition: "attachment",
      downloadUrl: "https://signed.example/download",
    });
    downloadAttachmentBytesMock.mockResolvedValue(Buffer.from("%PDF-1.4\n...\n%%EOF"));
    screenUploadForMalwareMock.mockResolvedValue({ verdict: "QUARANTINE", reason: "flagged", scannerName: null });

    const { runInboundEmailWorkerTick } = await import("@/modules/documents/processing/inboundEmailWorker");
    await runInboundEmailWorkerTick();

    expect(dbMock.notification.create).not.toHaveBeenCalled();
  });

  it("does not create a duplicate notification if a prior tick already recorded one for this email", async () => {
    getReceivedEmailMock.mockResolvedValue({
      id: "resend_email_1",
      from: "jane@acme.com",
      to: ["docs@inbound.qubere.ai"],
      subject: "Invoice",
      receivedFor: ["docs@inbound.qubere.ai"],
      headers: {},
      attachments: [
        { id: "att_1", filename: "invoice.pdf", size: 2048, contentType: "application/pdf", contentId: null, contentDisposition: "attachment" },
      ],
    });
    dbMock.inboundEmail.findMany.mockResolvedValue([{ id: "in_1" }]);
    getAttachmentDownloadInfoMock.mockResolvedValue({
      filename: "invoice.pdf",
      size: 2048,
      contentType: "application/pdf",
      contentDisposition: "attachment",
      downloadUrl: "https://signed.example/download",
    });
    downloadAttachmentBytesMock.mockResolvedValue(Buffer.from("%PDF-1.4\n...\n%%EOF"));
    screenUploadForMalwareMock.mockResolvedValue({ verdict: "NOT_SCANNED", reason: "no scanner configured", scannerName: null });
    storeDocumentFileMock.mockResolvedValue({
      url: "https://blob.vercel-storage.com/x",
      checksum: "abc123checksum",
      provider: "vercel-blob",
    });
    dbMock.shipmentDocument.create.mockResolvedValue({ id: "doc_1" });
    dbMock.notification.findFirst.mockResolvedValue({ id: "existing_notification" });

    const { runInboundEmailWorkerTick } = await import("@/modules/documents/processing/inboundEmailWorker");
    await runInboundEmailWorkerTick();

    expect(dbMock.notification.create).not.toHaveBeenCalled();
  });

  it("does not stop a sibling attachment when a malware-quarantined attachment precedes it", async () => {
    getReceivedEmailMock.mockResolvedValue({
      id: "resend_email_1",
      from: "jane@acme.com",
      to: ["docs@inbound.qubere.ai"],
      subject: "Invoice",
      receivedFor: ["docs@inbound.qubere.ai"],
      headers: {},
      attachments: [
        { id: "att_bad", filename: "bad.pdf", size: 10, contentType: "application/pdf", contentId: null, contentDisposition: "attachment" },
        { id: "att_good", filename: "good.pdf", size: 20, contentType: "application/pdf", contentId: null, contentDisposition: "attachment" },
      ],
    });
    dbMock.inboundEmail.findMany.mockResolvedValue([{ id: "in_1" }]);
    dbMock.inboundAttachment.upsert.mockImplementation(async ({ create }) => ({
      id: `row_${create.providerAttachmentId}`,
      ...create,
    }));
    getAttachmentDownloadInfoMock.mockResolvedValue({
      filename: "x.pdf",
      size: 10,
      contentType: "application/pdf",
      contentDisposition: "attachment",
      downloadUrl: "https://signed.example/download",
    });
    downloadAttachmentBytesMock.mockResolvedValue(Buffer.from("%PDF-1.4\n...\n%%EOF"));
    screenUploadForMalwareMock
      .mockResolvedValueOnce({ verdict: "QUARANTINE", reason: "flagged", scannerName: null })
      .mockResolvedValueOnce({ verdict: "NOT_SCANNED", reason: "no scanner configured", scannerName: null });
    storeDocumentFileMock.mockResolvedValue({
      url: "https://blob.vercel-storage.com/y",
      checksum: "goodchecksum",
      provider: "vercel-blob",
    });
    dbMock.shipmentDocument.create.mockResolvedValue({ id: "doc_good" });

    const { runInboundEmailWorkerTick } = await import("@/modules/documents/processing/inboundEmailWorker");
    await runInboundEmailWorkerTick();

    expect(dbMock.inboundAttachment.update).toHaveBeenCalledWith({
      where: { id: "row_att_bad" },
      data: { processingStatus: "REJECTED", rejectionReason: "flagged" },
    });
    expect(dbMock.shipmentDocument.create).toHaveBeenCalledTimes(1);
    expect(enqueueDocumentParseMock).toHaveBeenCalledTimes(1);
  });
});

describe('client-address worker routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.inboundEmail.updateMany.mockResolvedValue({ count: 1 });
    dbMock.inboundEmail.findMany.mockResolvedValue([{ ...RECEIVED_EMAIL, accountId: 'acct_a' }]);
    dbMock.inboundEmail.findUniqueOrThrow.mockResolvedValue({ ...RECEIVED_EMAIL, accountId: 'acct_a', clientId: 'target', inboundAddressId: 'target-address' });
    dbMock.inboundEmail.update.mockImplementation(async ({ data }) => ({ ...RECEIVED_EMAIL, accountId: 'acct_a', clientId: 'target', inboundAddressId: 'target-address', ...data }));
    dbMock.inboundAddress.findUnique.mockResolvedValue({ id: 'target-address', accountId: 'acct_a', clientId: 'target', status: 'ACTIVE', senderPolicy: 'ALLOWLIST' });
    dbMock.inboundSenderRoute.findMany.mockResolvedValue([]);
  });
  it.each(['NOT_SCANNED', 'QUARANTINE'])('rejects %s client attachments before storage', async verdict => {
    dbMock.inboundAddress.findUnique.mockResolvedValue({ accountId: 'acct_a', clientId: 'target', status: 'ACTIVE', senderPolicy: 'OPEN', purpose: 'CLIENT_DOCUMENTS' });
    getReceivedEmailMock.mockResolvedValue({ id: 'resend_email_1', headers: {}, attachments: [{ id: 'new_att', filename: 'invoice.pdf', contentType: 'application/pdf', contentDisposition: 'attachment', size: 20 }] });
    dbMock.inboundAttachment.findUnique.mockResolvedValue(null);
    dbMock.inboundAttachment.upsert.mockResolvedValue({ id: 'new_row' });
    getAttachmentDownloadInfoMock.mockResolvedValue({ downloadUrl: 'https://signed.example/download', contentType: 'application/pdf' });
    downloadAttachmentBytesMock.mockResolvedValue(Buffer.from('%PDF-1.4\n...\n%%EOF'));
    screenUploadForMalwareMock.mockResolvedValue({ verdict, reason: 'Scan not clean', scannerName: null });
    const { runInboundEmailWorkerTick } = await import('@/modules/documents/processing/inboundEmailWorker');
    await runInboundEmailWorkerTick();
    expect(storeDocumentFileMock).not.toHaveBeenCalled();
    expect(dbMock.shipmentDocument.create).not.toHaveBeenCalled();
    expect(dbMock.inboundAttachment.update).toHaveBeenCalledWith({ where: { id: 'new_row' }, data: { processingStatus: 'REJECTED', rejectionReason: 'Scan not clean' } });
  });
  it('stores clean REVIEW attachments under the recipient client and opens a sender review', async () => {
    dbMock.inboundAddress.findUnique.mockResolvedValue({ accountId: 'acct_a', clientId: 'target', status: 'ACTIVE', senderPolicy: 'REVIEW', purpose: 'CLIENT_DOCUMENTS' });
    getReceivedEmailMock.mockResolvedValue({ id: 'resend_email_1', headers: {}, attachments: [{ id: 'new_att', filename: 'invoice.pdf', contentType: 'application/pdf', contentDisposition: 'attachment', size: 20 }] });
    dbMock.inboundAttachment.findUnique.mockResolvedValue(null);
    dbMock.inboundAttachment.upsert.mockResolvedValue({ id: 'new_row' });
    getAttachmentDownloadInfoMock.mockResolvedValue({ downloadUrl: 'https://signed.example/download', contentType: 'application/pdf' });
    downloadAttachmentBytesMock.mockResolvedValue(Buffer.from('%PDF-1.4\n...\n%%EOF'));
    screenUploadForMalwareMock.mockResolvedValue({ verdict: 'CLEAN', reason: 'Scanned clean', scannerName: 'clamav' });
    storeDocumentFileMock.mockResolvedValue({ url: 'stored://fixture', checksum: 'hash', provider: 'test' });
    dbMock.shipmentDocument.create.mockResolvedValue({ id: 'new_doc' });
    dbMock.shipmentDocument.findMany.mockResolvedValue([]);
    const { runInboundEmailWorkerTick } = await import('@/modules/documents/processing/inboundEmailWorker');
    const { openInboundReview } = await import('@/modules/inbound/inboundDocumentRouting');
    await runInboundEmailWorkerTick();
    expect(storeDocumentFileMock).toHaveBeenCalledWith(expect.any(File), 'invoice.pdf', 'documents/acct_a/target');
    expect(dbMock.shipmentDocument.create).toHaveBeenCalledWith({ data: expect.objectContaining({ accountId: 'acct_a', clientId: 'target', source: 'INBOUND_EMAIL', portalVisibility: 'CUSTOMER', shipmentId: null }) });
    expect(openInboundReview).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'target', shipmentDocumentId: 'new_doc', reason: 'UNKNOWN_SENDER' }));
    expect(enqueueDocumentParseMock).toHaveBeenCalledWith(expect.objectContaining({ documentId: 'new_doc' }));
    expect(screenUploadForMalwareMock.mock.invocationCallOrder[0]).toBeLessThan(storeDocumentFileMock.mock.invocationCallOrder[0]);
  });
  it('holds an unknown ALLOWLIST sender without fetching or storing attachments', async () => {
    const { runInboundEmailWorkerTick } = await import('@/modules/documents/processing/inboundEmailWorker');
    await runInboundEmailWorkerTick();
    expect(getReceivedEmailMock).not.toHaveBeenCalled(); expect(storeDocumentFileMock).not.toHaveBeenCalled();
    expect(resolveInboundRouteMock).not.toHaveBeenCalled();
    expect(dbMock.inboundEmail.update).toHaveBeenCalledWith({ where: { id: 'in_1' }, data: expect.objectContaining({ routingStatus: 'NEEDS_REVIEW' }) });
  });
  it('rejects blocked senders before storage even if the destination is open', async () => {
    dbMock.inboundAddress.findUnique.mockResolvedValue({ accountId: 'acct_a', clientId: 'target', status: 'ACTIVE', senderPolicy: 'OPEN' });
    dbMock.inboundSenderRoute.findMany.mockResolvedValue([{ status: 'BLOCKED' }]);
    const { runInboundEmailWorkerTick } = await import('@/modules/documents/processing/inboundEmailWorker'); await runInboundEmailWorkerTick();
    expect(getReceivedEmailMock).not.toHaveBeenCalled(); expect(storeDocumentFileMock).not.toHaveBeenCalled();
  });
});
