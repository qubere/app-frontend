vi.mock('@/modules/inbound/inboundNotifications', () => ({ summarizeInboundReceipt: vi.fn() }));
import { beforeEach, describe, expect, it, vi } from 'vitest';
const { db, resolve, proof, link } = vi.hoisted(() => ({ db: { $transaction: vi.fn(), $queryRaw: vi.fn(), shipmentDocument: { findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() }, shipment: { findFirst: vi.fn() }, inboundAddress: { findUnique: vi.fn() }, inboundSenderRoute: { findMany: vi.fn() }, inboundDocumentReview: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() }, inboundAttachment: { updateMany: vi.fn() }, inboundEmail: { updateMany: vi.fn() }, customsFiling: { findMany: vi.fn() } }, resolve: vi.fn(), proof: vi.fn(), link: vi.fn() }));
vi.mock('@/lib/db', () => ({ db }));
vi.mock('@/modules/shipments/shipmentMatching', () => ({ resolveShipmentForDocument: resolve, plainTextFromParsedResult: (n: unknown) => String(n) }));
vi.mock('@/modules/documentAssociations/service', () => ({ linkDocument: link }));
vi.mock('@/lib/filing/entryProofService', () => ({ generateEntryProof: proof }));
vi.mock('@/lib/audit', () => ({ createAuditLog: vi.fn(), AuditAction: { AUTO_ATTACH_DOCUMENT: 'auto.attach' } }));
vi.mock('@/modules/notifications/notifyAccount', () => ({ notifyAccountRoleHolders: vi.fn() }));
import { routeParsedInboundDocument, attachInboundDocument } from '@/modules/inbound/inboundDocumentRouting';
const doc = { id: 'doc', clientId: 'target', shipmentId: null, source: 'INBOUND_EMAIL', status: 'Received', fileName: 'inv.pdf', inboundRoutedAt: null, inboundProofPending: false, inboundDocumentReview: null, inboundAttachment: { inboundEmail: { id: 'email', inboundAddressId: 'address', normalizedFromAddress: 'ops@acme.test', senderApprovedAt: null, subject: 'SHP-TGT-2026-001', bodyText: null } } };
const noMatch = { matchedShipmentId: null, candidates: [], llm: null, outcome: 'NO_MATCH' as const };
beforeEach(() => { vi.resetAllMocks(); db.$transaction.mockImplementation(fn => fn(db)); db.shipmentDocument.findFirst.mockResolvedValue(doc); db.shipment.findFirst.mockResolvedValue({ id: 'shipment' }); db.customsFiling.findMany.mockResolvedValue([]); db.inboundAddress.findUnique.mockResolvedValue({ id: 'address', senderPolicy: 'OPEN', autoAttachPolicy: 'CONFIDENT' }); db.inboundSenderRoute.findMany.mockResolvedValue([]); db.inboundDocumentReview.upsert.mockResolvedValue({ id: 'review' }); resolve.mockResolvedValue(noMatch); });
describe('recipient-owned document decisions', () => {
  it('passes client scope + email body to matching and makes a review when there are no candidates', async () => {
    await routeParsedInboundDocument('a', 'doc', 'invoice');
    expect(resolve).toHaveBeenCalledWith(expect.objectContaining({ accountId: 'a', clientId: 'target', autoAttachPolicy: 'CONFIDENT' }));
    expect(db.inboundDocumentReview.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ reason: 'NO_MATCH', clientId: 'target' }) }));
    expect(db.shipmentDocument.update).not.toHaveBeenCalled();
  });
  it('keeps unknown-sender documents out of automatic selection (live policy)', async () => {
    db.inboundAddress.findUnique.mockResolvedValue({ id: 'address', senderPolicy: 'REVIEW', autoAttachPolicy: 'CONFIDENT' });
    await routeParsedInboundDocument('a', 'doc', 'invoice');
    expect(resolve).toHaveBeenCalledWith(expect.objectContaining({ requireReview: true }));
  });
  it('lets an approved sender auto-attach even if a prior review was UNKNOWN_SENDER', async () => {
    db.inboundAddress.findUnique.mockResolvedValue({ id: 'address', senderPolicy: 'REVIEW', autoAttachPolicy: 'CONFIDENT' });
    db.shipmentDocument.findFirst.mockResolvedValue({ ...doc, inboundAttachment: { inboundEmail: { ...doc.inboundAttachment.inboundEmail, senderApprovedAt: new Date() } }, inboundDocumentReview: { reason: 'UNKNOWN_SENDER', status: 'OPEN' } });
    await routeParsedInboundDocument('a', 'doc', 'invoice');
    expect(resolve).toHaveBeenCalledWith(expect.objectContaining({ requireReview: false }));
  });
  it('forces review when the address auto-attach policy is OFF', async () => {
    db.inboundAddress.findUnique.mockResolvedValue({ id: 'address', senderPolicy: 'OPEN', autoAttachPolicy: 'OFF' });
    await routeParsedInboundDocument('a', 'doc', 'invoice');
    expect(resolve).toHaveBeenCalledWith(expect.objectContaining({ requireReview: true, autoAttachPolicy: 'OFF' }));
  });
  it('attaches and records the outcome when matching resolves a shipment', async () => {
    resolve.mockResolvedValue({ matchedShipmentId: 'shipment', candidates: [], llm: { model: 'gemini-x', suggestedShipmentId: 'shipment', confidence: 0.9, reasoning: 'BL match', extractedIdentifiers: [], alternativeShipmentIds: [] }, outcome: 'AUTO_ATTACH_LLM_VERIFIED' });
    const out = await routeParsedInboundDocument('a', 'doc', 'invoice');
    expect(out).toBe('shipment');
    expect(db.shipmentDocument.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ shipmentId: 'shipment' }) }));
    expect(db.inboundDocumentReview.upsert).not.toHaveBeenCalled();
  });
  it('surfaces the LLM reasoning in the review candidate summary', async () => {
    resolve.mockResolvedValue({ matchedShipmentId: null, candidates: [], llm: { model: 'gemini-x', suggestedShipmentId: 'ship-9', confidence: 0.55, reasoning: 'Mentions the Nike order', extractedIdentifiers: [], alternativeShipmentIds: [] }, outcome: 'LOW_CONFIDENCE' });
    await routeParsedInboundDocument('a', 'doc', 'invoice');
    expect(db.inboundDocumentReview.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ reason: 'LOW_CONFIDENCE', candidateSummary: expect.arrayContaining([expect.objectContaining({ shipmentId: 'ship-9', reasoning: 'Mentions the Nike order' })]) }) }));
  });
  it('rejects a cross-client attachment at the write boundary', async () => {
    db.shipment.findFirst.mockResolvedValue(null);
    await expect(attachInboundDocument('a', 'doc', 'amazon-shipment')).rejects.toThrow('SHIPMENT_CLIENT_MISMATCH');
    expect(db.shipment.findFirst).toHaveBeenCalledWith({ where: { id: 'amazon-shipment', accountId: 'a', deletedAt: null, clientId: 'target' }, select: { id: true } });
    expect(db.shipmentDocument.update).not.toHaveBeenCalled();
  });
  it('refreshes a proof using the document as an idempotency trigger', async () => {
    db.shipmentDocument.findFirst.mockResolvedValue({ ...doc, shipmentId: 'shipment', inboundProofPending: true }); db.customsFiling.findMany.mockResolvedValue([{ id: 'filing' }]);
    await routeParsedInboundDocument('a', 'doc', 'invoice');
    expect(proof).toHaveBeenCalledWith('filing', { accountId: 'a' }, { inboundDocumentId: 'doc' });
  });
  it('does not re-attach an already-routed document', async () => {
    db.shipmentDocument.findFirst.mockResolvedValue({ ...doc, shipmentId: 'shipment', inboundRoutedAt: new Date(), inboundProofPending: false });
    const out = await routeParsedInboundDocument('a', 'doc', 'invoice');
    expect(out).toBe('shipment');
    expect(db.shipmentDocument.update).not.toHaveBeenCalled();
    expect(proof).not.toHaveBeenCalled();
  });
  it('is a no-op for a non-inbound document', async () => {
    db.shipmentDocument.findFirst.mockResolvedValue({ ...doc, source: 'UPLOAD', inboundAttachment: null });
    await routeParsedInboundDocument('a', 'doc', 'invoice');
    expect(resolve).not.toHaveBeenCalled();
  });
  it('preserves discarded decisions on parser retries', async () => {
    db.shipmentDocument.findFirst.mockResolvedValue({ ...doc, status: 'DISCARDED' }); await routeParsedInboundDocument('a', 'doc', 'invoice'); expect(resolve).not.toHaveBeenCalled();
  });
});
