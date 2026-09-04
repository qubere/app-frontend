vi.mock('@/modules/inbound/inboundNotifications', () => ({ summarizeInboundReceipt: vi.fn() }));
import { beforeEach, describe, expect, it, vi } from 'vitest';
const { db, match, proof, link } = vi.hoisted(() => ({ db: { $transaction: vi.fn(), $queryRaw: vi.fn(), shipmentDocument: { findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() }, shipment: { findFirst: vi.fn() }, inboundAddress: { findUnique: vi.fn() }, inboundSenderRoute: { findMany: vi.fn() }, inboundDocumentReview: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() }, inboundAttachment: { updateMany: vi.fn() }, inboundEmail: { updateMany: vi.fn() }, customsFiling: { findMany: vi.fn() } }, match: vi.fn(), proof: vi.fn(), link: vi.fn() }));
vi.mock('@/lib/db', () => ({ db }));
vi.mock('@/modules/shipments/shipmentMatching', () => ({ matchShipmentForDocument: match, isMatchConflict: (r: { candidates: unknown[] }) => r.candidates.length > 1 }));
vi.mock('@/modules/documentAssociations/service', () => ({ linkDocument: link }));
vi.mock('@/lib/filing/entryProofService', () => ({ generateEntryProof: proof }));
vi.mock('@/lib/audit', () => ({ createAuditLog: vi.fn(), AuditAction: { AUTO_ATTACH_DOCUMENT: 'auto.attach' } }));
vi.mock('@/modules/notifications/notifyAccount', () => ({ notifyAccountRoleHolders: vi.fn() }));
import { routeParsedInboundDocument, attachInboundDocument } from '@/modules/inbound/inboundDocumentRouting';
const doc = { id: 'doc', clientId: 'target', shipmentId: null, source: 'INBOUND_EMAIL', status: 'Received', inboundRoutedAt: null, inboundProofPending: false, inboundDocumentReview: null, inboundAttachment: { inboundEmail: { id: 'email', inboundAddressId: 'address', normalizedFromAddress: 'ops@acme.test', senderApprovedAt: null, subject: 'SHP-TGT-2026-001' } } };
beforeEach(() => { vi.resetAllMocks(); db.$transaction.mockImplementation(fn => fn(db)); db.shipmentDocument.findFirst.mockResolvedValue(doc); db.shipment.findFirst.mockResolvedValue({ id: 'shipment' }); db.customsFiling.findMany.mockResolvedValue([]); db.inboundAddress.findUnique.mockResolvedValue({ id: 'address', senderPolicy: 'OPEN' }); db.inboundSenderRoute.findMany.mockResolvedValue([]); db.inboundDocumentReview.upsert.mockResolvedValue({ id: 'review' }); match.mockResolvedValue({ matchedShipmentId: null, candidates: [] }); });
describe('recipient-owned document decisions', () => {
  it('passes client scope to matching and makes a review when there are no candidates', async () => {
    await routeParsedInboundDocument('a', 'doc', 'invoice');
    expect(match).toHaveBeenCalledWith(expect.objectContaining({ accountId: 'a', clientId: 'target' }));
    expect(db.inboundDocumentReview.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ reason: 'NO_MATCH', clientId: 'target' }) }));
    expect(db.shipmentDocument.update).not.toHaveBeenCalled();
  });
  it('keeps unknown-sender documents out of automatic selection (live policy)', async () => {
    db.inboundAddress.findUnique.mockResolvedValue({ id: 'address', senderPolicy: 'REVIEW' });
    await routeParsedInboundDocument('a', 'doc', 'invoice');
    expect(match).toHaveBeenCalledWith(expect.objectContaining({ requireReview: true }));
  });
  it('lets an approved sender auto-attach even if a prior review was UNKNOWN_SENDER', async () => {
    db.inboundAddress.findUnique.mockResolvedValue({ id: 'address', senderPolicy: 'REVIEW' });
    db.shipmentDocument.findFirst.mockResolvedValue({ ...doc, inboundAttachment: { inboundEmail: { ...doc.inboundAttachment.inboundEmail, senderApprovedAt: new Date() } }, inboundDocumentReview: { reason: 'UNKNOWN_SENDER', status: 'OPEN' } });
    await routeParsedInboundDocument('a', 'doc', 'invoice');
    expect(match).toHaveBeenCalledWith(expect.objectContaining({ requireReview: false }));
  });
  it('rejects a cross-client attachment at the write boundary', async () => {
    db.shipment.findFirst.mockResolvedValue(null);
    await expect(attachInboundDocument('a', 'doc', 'amazon-shipment')).rejects.toThrow('SHIPMENT_CLIENT_MISMATCH');
    expect(db.shipment.findFirst).toHaveBeenCalledWith({ where: { id: 'amazon-shipment', accountId: 'a', deletedAt: null, clientId: 'target' }, select: { id: true } });
    expect(db.shipmentDocument.update).not.toHaveBeenCalled();
  });
  it('refreshes a proof using the document as an idempotency trigger', async () => {
    db.shipmentDocument.findFirst.mockResolvedValue({ ...doc, shipmentId: 'shipment' }); db.customsFiling.findMany.mockResolvedValue([{ id: 'filing' }]);
    await routeParsedInboundDocument('a', 'doc', 'invoice');
    expect(proof).toHaveBeenCalledWith('filing', { accountId: 'a' }, { inboundDocumentId: 'doc' });
  });
  it('preserves discarded decisions on parser retries', async () => {
    db.shipmentDocument.findFirst.mockResolvedValue({ ...doc, status: 'DISCARDED' }); await routeParsedInboundDocument('a', 'doc', 'invoice'); expect(match).not.toHaveBeenCalled();
  });
});
