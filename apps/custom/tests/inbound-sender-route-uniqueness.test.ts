import { beforeEach, describe, expect, it, vi } from 'vitest';
const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { inboundSenderRoute: { findMany } }, withDataModeContext: (_m: unknown, fn: (...args: any[]) => any) => fn() }));
vi.mock('@/lib/audit', () => ({ createAuditLog: vi.fn() }));
import { resolveInboundRoute } from '@/modules/inbound/senderRouting';
beforeEach(() => vi.resetAllMocks());
describe('legacy routing after destination-scoped sender rules', () => {
  it('refuses to guess when a sender is approved in two accounts', async () => {
    findMany.mockResolvedValue([{ id: 'a', accountId: 'target' }, { id: 'b', accountId: 'amazon' }]);
    expect(await resolveInboundRoute('same@vendor.example')).toBeNull();
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { normalizedSenderEmail: 'same@vendor.example', clientId: null, status: 'ACTIVE' }, take: 2 }));
  });
  it('continues routing a single unambiguous legacy account', async () => {
    findMany.mockResolvedValue([{ id: 'a', accountId: 'target', defaultAssignedToUserId: null }]);
    expect((await resolveInboundRoute('same@vendor.example'))?.accountId).toBe('target');
  });
});
