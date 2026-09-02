import { beforeEach, describe, expect, it, vi } from 'vitest';
const { create, resolve, verify, after } = vi.hoisted(() => ({ create: vi.fn(), resolve: vi.fn(), verify: vi.fn(), after: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { inboundEmail: { create } } }));
vi.mock('@/lib/api/auth-guards', () => ({ withPublicRoute: (fn: unknown) => fn }));
vi.mock('next/server', async () => ({ ...await vi.importActual('next/server'), after }));
vi.mock('@/modules/documents/processing/inboundEmailWorker', () => ({ runInboundEmailWorkerTick: vi.fn() }));
vi.mock('@/modules/inbound/inboundAddressService', () => ({ clientInboundEnabled: () => true, resolveInboundAddress: resolve, acceptsInboundAddress: (a: { status: string }) => a.status === 'ACTIVE' }));
vi.mock('@/lib/inbound/resendClient', () => ({ verifyResendWebhook: verify, ResendConfigError: class extends Error {}, ResendWebhookVerificationError: class extends Error {} }));
import { POST } from '@/app/api/webhooks/resend/inbound/route';
const target = { id: 'target-inbox', accountId: 'broker', clientId: 'target', purpose: 'CLIENT_DOCUMENTS', address: 'docs-target@inbound.qubere.ai', status: 'ACTIVE' };
async function call() { return (POST as any)({ req: new Request('https://local/api/webhooks/resend/inbound', { method: 'POST', body: '{}', headers: { 'svix-id': 'event', 'svix-timestamp': '1', 'svix-signature': 'verified' } }), requestId: 'req' }); }
beforeEach(() => { vi.clearAllMocks(); verify.mockReturnValue({ type: 'email.received', data: { to: [target.address], from: 'Supplier <logistics@vendor.example>', email_id: 'email', created_at: '2026-09-02T00:00:00Z' } }); resolve.mockResolvedValue(target); create.mockResolvedValue({ id: 'email', routingStatus: 'RECEIVED', quarantineReason: null }); });
describe('signed recipient routing', () => {
  it('attributes the recipient account and client before dispatch without consulting sender routing', async () => {
    expect((await call()).status).toBe(202);
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ accountId: 'broker', clientId: 'target', inboundAddressId: 'target-inbox', normalizedFromAddress: 'logistics@vendor.example' }) });
    expect(after).toHaveBeenCalledOnce();
  });
  it.each([null, { ...target, status: 'REVOKED' }, { ...target, status: 'SUSPENDED' }])('rejects unknown or inactive recipients %j', async a => {
    resolve.mockResolvedValue(a); await call();
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ routingStatus: 'REJECTED' }) }); expect(after).not.toHaveBeenCalled();
  });
  it('refuses an email addressed to different clients instead of choosing the first', async () => {
    verify.mockReturnValue({ type: 'email.received', data: { to: ['target', 'amazon'], from: 'sender@example.com', email_id: 'email', created_at: '2026-09-02T00:00:00Z' } });
    resolve.mockResolvedValueOnce(target).mockResolvedValueOnce({ ...target, clientId: 'amazon' }); await call();
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ routingStatus: 'REJECTED', quarantineReason: 'multiple_destinations', accountId: null }) }); expect(after).not.toHaveBeenCalled();
  });
});
