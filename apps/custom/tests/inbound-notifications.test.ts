import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ email: vi.fn(), members: vi.fn(), notification: vi.fn(), reconcile: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { inboundEmail: { findFirst: m.email, updateMany: m.reconcile }, accountMembership: { findMany: m.members }, notification: { updateMany: vi.fn(), upsert: m.notification } } }));
vi.mock('@/modules/notifications/notifyAccount', () => ({ notifyAccountRoleHolders: vi.fn() }));
import { summarizeInboundReceipt } from '@/modules/inbound/inboundNotifications';
const email = { id: 'email', inboundAddressId: 'address', clientId: 'target', client: { name: 'Target' }, reviews: [], attachments: [{ shipmentDocument: { clientId: 'target', status: 'Received', portalVisibility: 'CUSTOMER', shipmentId: 'target-shipment', shipment: { shipmentNumber: 'SHP-TGT-2026-001' } } }] };
beforeEach(() => { vi.resetAllMocks(); m.email.mockResolvedValue(email); m.members.mockResolvedValue([{ userId: 'target-user' }]); });
it('sends portal receipts only to active members assigned to the destination client', async () => {
  await summarizeInboundReceipt('account', 'email');
  expect(m.members).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ accountId: 'account', status: 'ACTIVE', user: { deletedAt: null, clientAssignments: { some: { clientId: 'target' } } } }) }));
  expect(m.notification).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ userId: 'target-user', entityId: 'target', message: expect.stringContaining('SHP-TGT-2026-001') }) }));
});
it('does not expose another client shipment after a broker reassigns the document', async () => {
  m.email.mockResolvedValue({ ...email, attachments: [{ shipmentDocument: { ...email.attachments[0].shipmentDocument, clientId: 'amazon', shipment: { shipmentNumber: 'SHP-AMAZON-001' } } }] });
  await summarizeInboundReceipt('account', 'email');
  expect(m.members).not.toHaveBeenCalled(); expect(m.notification).not.toHaveBeenCalled();
});
