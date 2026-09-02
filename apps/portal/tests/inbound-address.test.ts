import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const m = vi.hoisted(() => ({ ctx: { accountId: 'target-workspace', userId: 'u', dataMode: 'DEMO', roleNames: ['CUSTOMER_ADMIN'], permissions: ['portal.setup.read'] }, query: vi.fn() }));
vi.mock('@qubere/db', () => ({ db: { inboundAddress: { findMany: m.query } }, withAccountIdContext: (_a: unknown, fn: (...args: any[]) => any) => fn(), withDataModeContext: (_a: unknown, fn: (...args: any[]) => any) => fn(), isDataMode: () => true }));
vi.mock('@qubere/auth', () => ({ getAccountContext: async () => m.ctx, hasRequiredPortalPermission: (ctx: typeof m.ctx, p: string) => ctx.permissions.includes(p), getPortalWorkspaceScope: () => ({}), resolvePortalClientScope: (_s: unknown, id?: string) => ({ forbidden: false, clientIds: id ? [id] : null }) }));
import { GET } from '../src/app/api/inbound-address/route';
import { documentClientWhere } from '../src/lib/client-ownership';
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('INBOUND_CLIENT_ADDRESSES_ENABLED', 'true'); m.ctx.permissions = ['portal.setup.read']; m.query.mockResolvedValue([{ address: 'docs-target@inbound.qubere.ai', purpose: 'CLIENT_DOCUMENTS' }]); });
afterEach(() => vi.unstubAllEnvs());
describe('portal inbound destination read', () => {
  it('always uses the authenticated workspace even when a foreign client is requested', async () => {
    const r = await GET(new Request('https://portal/api/inbound-address?clientId=foreign'));
    expect(r.status).toBe(200); expect(r.headers.get('Cache-Control')).toBe('no-store');
    expect(m.query).toHaveBeenCalledWith(expect.objectContaining({ where: { accountId: 'target-workspace', clientId: { in: ['foreign'] }, status: 'ACTIVE', purpose: 'CLIENT_DOCUMENTS' } }));
  });
  it('never chooses a first client address when a workspace has several', async () => {
    m.query.mockResolvedValue([{ address: 'a' }, { address: 'b' }]);
    expect((await (await GET(new Request('https://portal/api/inbound-address'))).json()).inboundAddress).toBeNull();
  });
  it('requires setup permission', async () => { m.ctx.permissions = []; expect((await GET(new Request('https://portal/api/inbound-address'))).status).toBe(404); expect(m.query).not.toHaveBeenCalled(); });
  it('returns no unprovisioned addresses while the feature is off', async () => { vi.stubEnv('INBOUND_CLIENT_ADDRESSES_ENABLED', 'false'); expect((await (await GET(new Request('https://portal/api/inbound-address'))).json()).addresses).toEqual([]); expect(m.query).not.toHaveBeenCalled(); });
  it('excludes discarded and internal inbound docs while retaining workspace access', () => {
    const where = documentClientWhere('target-workspace', null, new Map());
    expect(where.accountId).toBe('target-workspace'); expect(where.status).toEqual({ not: 'DISCARDED' });
    expect(where.AND).toContainEqual({ OR: [{ source: { not: 'INBOUND_EMAIL' } }, { portalVisibility: 'CUSTOMER' }] });
  });
});
