import { beforeEach, describe, expect, it, vi } from 'vitest';
const session = vi.hoisted(() => ({ ctx: { accountId: 'target', userId: 'porter', roleNames: ['CUSTOMER_USER'], permissions: ['portal.shipments.read', 'portal.documents.read', 'portal.setup.read'] } as any }));
vi.mock('../../../packages/auth/src/auth', () => ({ getAccountContext: async () => session.ctx }));
// Exercise the real authorization engine, not a mocked authorization result.
import { authorizePortalResource, getPortalWorkspaceScope } from '../../../packages/auth/src/portal-auth';
beforeEach(() => { session.ctx = { accountId: 'target', userId: 'porter', roleNames: ['CUSTOMER_USER'], permissions: ['portal.shipments.read', 'portal.documents.read', 'portal.setup.read'] }; });

describe('Customer workspace isolation', () => {
  it.each(['portal.shipments.read', 'portal.documents.read', 'portal.setup.read'])('allows all Target records with %s regardless of client metadata', async permission => {
    for (const clientId of [null, 'target-corporation', 'duplicate-target']) {
      const result = await authorizePortalResource({ permission, resourceAccountId: 'target', resourceClientId: clientId, portalVisibility: 'INTERNAL' });
      expect(result.authorized).toBe(true);
    }
  });
  it.each(['amazon', 'dhl'])('blocks Target users from the %s workspace even with matching client IDs', async resourceAccountId => {
    for (const permission of session.ctx.permissions) {
      const result = await authorizePortalResource({ permission, resourceAccountId, resourceClientId: 'target-corporation' });
      expect(result.errorResponse?.status).toBe(404);
    }
  });
  it('re-evaluates the active authenticated workspace after a switch', async () => {
    session.ctx.accountId = 'amazon';
    expect((await authorizePortalResource({ permission: 'portal.shipments.read', resourceAccountId: 'target' })).errorResponse?.status).toBe(404);
    expect((await authorizePortalResource({ permission: 'portal.shipments.read', resourceAccountId: 'amazon', resourceClientId: null })).authorized).toBe(true);
  });
  it('keeps read-only workspace members from write operations', async () => {
    expect((await authorizePortalResource({ permission: 'portal.requests.respond', resourceAccountId: 'target' })).errorResponse?.status).toBe(404);
  });
  it('still requires filing publication', async () => {
    session.ctx.permissions.push('portal.entries.read');
    expect((await authorizePortalResource({ permission: 'portal.entries.read', resourceAccountId: 'target', customerVisibleAt: null })).errorResponse?.status).toBe(404);
  });
  it('rejects missing authentication before deriving workspace scope', async () => {
    session.ctx = null;
    expect((await authorizePortalResource({ permission: 'portal.setup.read', resourceAccountId: 'target' })).errorResponse?.status).toBe(401);
    expect(() => getPortalWorkspaceScope({ accountId: '' })).toThrow();
  });
});
