import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ store: vi.fn(), db: { client: { findFirst: vi.fn() }, shipment: { findFirst: vi.fn() }, shipmentDocument: { findFirst: vi.fn(), create: vi.fn() } } }));
vi.mock('../../../packages/db/src/index', () => ({ db: m.db }));
vi.mock('@qubere/storage', () => ({ storeDocumentBytes: m.store }));
import { processSharedDocumentUpload } from '../../../packages/db/src/services/shared-upload-service';
const input = { accountId: 'target', fileName: 'invoice.pdf', fileBuffer: Buffer.from('%PDF test'), mimeType: 'application/pdf', docType: 'Invoice' };
beforeEach(() => { vi.resetAllMocks(); m.store.mockResolvedValue({ url: 'stored://file' }); m.db.shipmentDocument.create.mockImplementation(async ({ data }) => ({ ...data, id: 'doc', createdAt: new Date() })); });
describe('Workspace document upload ownership', () => {
  it('accepts an unattached workspace document without choosing an arbitrary client', async () => {
    await processSharedDocumentUpload(input);
    expect(m.db.shipmentDocument.create).toHaveBeenCalledWith({ data: expect.objectContaining({ accountId: 'target', clientId: null, shipmentId: null }) });
    expect(m.db.client.findFirst).not.toHaveBeenCalled();
  });
  it('accepts a workspace shipment with no client link', async () => {
    m.db.shipment.findFirst.mockResolvedValue({ clientId: null });
    await processSharedDocumentUpload({ ...input, shipmentId: '000001' });
    expect(m.db.shipment.findFirst).toHaveBeenCalledWith({ where: { id: '000001', accountId: 'target', deletedAt: null }, select: { clientId: true } });
    expect(m.db.shipmentDocument.create).toHaveBeenCalledWith({ data: expect.objectContaining({ accountId: 'target', clientId: null, shipmentId: '000001' }) });
  });
  it('rejects a foreign client before storing bytes or creating a document', async () => {
    m.db.client.findFirst.mockResolvedValue(null);
    await expect(processSharedDocumentUpload({ ...input, clientId: 'amazon-client' })).rejects.toThrow('not found in this workspace');
    expect(m.db.client.findFirst).toHaveBeenCalledWith({ where: { id: 'amazon-client', accountId: 'target' }, select: { id: true } });
    expect(m.store).not.toHaveBeenCalled(); expect(m.db.shipmentDocument.create).not.toHaveBeenCalled();
  });
  it('rejects an inaccessible shipment before storing bytes', async () => {
    m.db.shipment.findFirst.mockResolvedValue(null);
    await expect(processSharedDocumentUpload({ ...input, shipmentId: 'amazon-shipment' })).rejects.toThrow('Target shipment not found');
    expect(m.store).not.toHaveBeenCalled(); expect(m.db.shipmentDocument.create).not.toHaveBeenCalled();
  });
});
