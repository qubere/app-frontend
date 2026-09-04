import { portalReadError } from "./portal-errors";
import { getAccountContext, getPortalWorkspaceScope, resolvePortalClientScope, hasRequiredPortalPermission, type AccountContext } from '@qubere/auth';
import { withDataModeContext, withAccountIdContext, isDataMode } from '@qubere/db';
import { NextResponse } from 'next/server';
export const noStore = { headers: { 'Cache-Control': 'no-store' } };
export const notFound = () => NextResponse.json({ error: 'NOT_FOUND' }, { status: 404, ...noStore });
export async function portalScope(req: Request, permission: string) {
    const ctx = await getAccountContext();
    if (!ctx)
        return { error: NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 }) } as const;
    if (!hasRequiredPortalPermission(ctx, permission))
        return { error: notFound() } as const;
    const scope = await getPortalWorkspaceScope(ctx);
    const resolved = resolvePortalClientScope(scope, new URL(req.url).searchParams.get('clientId'));
    if (resolved.forbidden)
        return { error: notFound() } as const;
    return { ctx, clientIds: resolved.clientIds, availableClientIds: resolvePortalClientScope(scope).clientIds } as const;
}
export async function portalData<T>(ctx: {
    accountId: string;
    dataMode?: string | null;
}, fn: () => Promise<T>): Promise<T> {
    return withAccountIdContext(ctx.accountId, () => withDataModeContext(isDataMode(ctx.dataMode) ? ctx.dataMode : 'PRODUCTION', fn));
}

/** Establish account and data mode before even the first resource lookup. */
export function withPortalAccount<Args extends unknown[]>(
    handler: (ctx: AccountContext, ...args: Args) => Promise<Response>,
) {
    return async (...args: Args): Promise<Response> => {
        const ctx = await getAccountContext();
        if (!ctx) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401, ...noStore });
        return portalData(ctx, async () => {
            try {
                const response = await handler(ctx, ...args);
                response.headers.set('Cache-Control', 'no-store');
                return response;
            } catch (error) {
                return portalReadError(error);
            }
        });
    };
}
