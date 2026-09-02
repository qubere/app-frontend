import { beforeEach, describe, expect, it, vi } from 'vitest';

// One broker Account ("target-brokerage") holds two customer client workspaces:
// Target Corporation and Amazon Import Services. A CUSTOMER_USER assigned to
// Target must never reach Amazon's records, and vice versa.
const session = vi.hoisted(() => ({
  ctx: null as any,
  scope: { isAllClients: false, authorizedClientIds: ['target-corporation'], teamIds: [] } as any,
  importer: null as any,
}));
vi.mock('../../../packages/auth/src/auth', () => ({ getAccountContext: async () => session.ctx }));
vi.mock('../../../packages/auth/src/scope-engine', () => ({ getEffectiveUserScope: async () => session.scope }));
vi.mock('@qubere/db', () => ({ db: { importerOfRecord: { findFirst: async () => session.importer } } }));

import { authorizePortalResource, getPortalWorkspaceScope } from '../../../packages/auth/src/portal-auth';

const BROKER = 'target-brokerage';
const READ_PERMS = ['portal.shipments.read', 'portal.documents.read', 'portal.setup.read'];

beforeEach(() => {
  session.ctx = { accountId: BROKER, userId: 'porter', roleNames: ['CUSTOMER_USER'], permissions: [...READ_PERMS, 'portal.entries.read', 'portal.requests.respond'] };
  session.scope = { isAllClients: false, authorizedClientIds: ['target-corporation'], teamIds: [] };
  session.importer = null;
});

describe('Customer workspace isolation', () => {
  it.each(READ_PERMS)('grants a Target user their own client records with %s', async permission => {
    const result = await authorizePortalResource({ permission, resourceAccountId: BROKER, resourceClientId: 'target-corporation' });
    expect(result.authorized).toBe(true);
    expect(result.errorResponse).toBeNull();
  });

  it.each(READ_PERMS)('fails closed (404) when a Target user requests an Amazon client record with %s', async permission => {
    const result = await authorizePortalResource({ permission, resourceAccountId: BROKER, resourceClientId: 'amazon-import-services' });
    expect(result.authorized).toBe(false);
    expect(result.errorResponse?.status).toBe(404);
  });

  it('fails closed when the record has no client link and no importer resolves ownership', async () => {
    const result = await authorizePortalResource({ permission: 'portal.shipments.read', resourceAccountId: BROKER, resourceClientId: null });
    expect(result.authorized).toBe(false);
    expect(result.errorResponse?.status).toBe(404);
  });

  it('resolves a null-client record through an unambiguous importer link', async () => {
    session.importer = { clientId: 'target-corporation', onboardingEntities: [] };
    const result = await authorizePortalResource({ permission: 'portal.shipments.read', resourceAccountId: BROKER, resourceClientId: null, importerOfRecordId: 'ior-1' });
    expect(result.authorized).toBe(true);
  });

  it('refuses to guess ownership when an importer points at more than one client', async () => {
    session.importer = { clientId: null, onboardingEntities: [{ case: { clientId: 'target-corporation' } }, { case: { clientId: 'amazon-import-services' } }] };
    const result = await authorizePortalResource({ permission: 'portal.shipments.read', resourceAccountId: BROKER, resourceClientId: null, importerOfRecordId: 'ior-1' });
    expect(result.authorized).toBe(false);
    expect(result.errorResponse?.status).toBe(404);
  });

  it('blocks a different broker account outright', async () => {
    const result = await authorizePortalResource({ permission: 'portal.shipments.read', resourceAccountId: 'other-brokerage', resourceClientId: 'target-corporation' });
    expect(result.errorResponse?.status).toBe(404);
  });

  it('lets a broker/all-clients context see every client in the account', async () => {
    session.scope = { isAllClients: true, authorizedClientIds: [], teamIds: [] };
    session.ctx.roleNames = ['BROKER_ADMIN'];
    const result = await authorizePortalResource({ permission: 'portal.shipments.read', resourceAccountId: BROKER, resourceClientId: 'amazon-import-services' });
    expect(result.authorized).toBe(true);
  });

  it('keeps read-only workspace members from write operations', async () => {
    session.ctx.permissions = [...READ_PERMS];
    expect((await authorizePortalResource({ permission: 'portal.requests.respond', resourceAccountId: BROKER, resourceClientId: 'target-corporation' })).errorResponse?.status).toBe(404);
  });

  it('still requires filing publication', async () => {
    expect((await authorizePortalResource({ permission: 'portal.entries.read', resourceAccountId: BROKER, resourceClientId: 'target-corporation', customerVisibleAt: null })).errorResponse?.status).toBe(404);
  });

  it('rejects missing authentication before deriving workspace scope', async () => {
    session.ctx = null;
    expect((await authorizePortalResource({ permission: 'portal.setup.read', resourceAccountId: BROKER, resourceClientId: 'target-corporation' })).errorResponse?.status).toBe(401);
    await expect(getPortalWorkspaceScope({ accountId: '', userId: 'u', roleNames: [] })).rejects.toThrow();
  });
});
