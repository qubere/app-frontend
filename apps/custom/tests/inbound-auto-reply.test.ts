import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ find: vi.fn(), claim: vi.fn(), update: vi.fn(), send: vi.fn(), get: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { inboundEmail: { findMany: m.find, updateMany: m.claim, update: m.update } } }));
vi.mock('@/lib/inbound/resendClient', () => ({ getReceivedEmail: m.get, sendInboundReceipt: m.send }));
import { shouldReplyToInbound, runInboundAutoReplies } from '@/modules/inbound/inboundAutoReply';
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('INBOUND_AUTO_REPLY_ENABLED', 'true'); m.find.mockResolvedValue([{ id: 'email', normalizedFromAddress: 'sender@example.com', routingStatus: 'ACCEPTED', authHeaders: {}, attachments: [{ processingStatus: 'STORED' }] }]); m.claim.mockResolvedValue({ count: 1 }); });
afterEach(() => vi.unstubAllEnvs());
describe('one-shot inbound receipts', () => {
  it('does no work while the global gate is off', async () => { vi.stubEnv('INBOUND_AUTO_REPLY_ENABLED', 'false'); await runInboundAutoReplies(); expect(m.find).not.toHaveBeenCalled(); });
  it.each([
    ['mailer-daemon@example.com', {}], ['noreply@example.com', {}],
    ['docs-abcdef@inbound.qubere.ai', {}], ['sender@example.com', { 'Auto-Submitted': 'auto-replied' }],
    ['sender@example.com', { Precedence: 'bulk' }], ['sender@example.com', { 'List-Id': 'list.example.com' }],
  ])('suppresses automatic/looping senders %s %j', (sender, headers) => { expect(shouldReplyToInbound(sender, headers)).toBe(false); });
  it('permits a human sender with Auto-Submitted: no', () => { expect(shouldReplyToInbound('sender@example.com', { 'Auto-Submitted': 'no' })).toBe(true); });
  it('claims before sending and never sends again after a timeout', async () => {
    m.claim.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    m.send.mockRejectedValue(new Error('provider timeout after accepting request'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try { await runInboundAutoReplies(); await runInboundAutoReplies(); } finally { log.mockRestore(); }
    expect(m.send).toHaveBeenCalledTimes(1);
    expect(m.claim.mock.invocationCallOrder[0]).toBeLessThan(m.send.mock.invocationCallOrder[0]);
    expect(m.update).not.toHaveBeenCalled();
  });
  it('records delivery only after a successful send', async () => {
    await runInboundAutoReplies(); expect(m.send).toHaveBeenCalledWith('email', 'sender@example.com', expect.stringContaining('1 document'));
    expect(m.update).toHaveBeenCalledWith({ where: { id: 'email' }, data: { autoReplySentAt: expect.any(Date) } });
  });
});
