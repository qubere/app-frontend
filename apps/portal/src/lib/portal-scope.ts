import { getAccountContext, getEffectiveUserScope, resolvePortalClientScope, hasRequiredPortalPermission } from '@qubere/auth';
import { withDataModeContext, isDataMode } from '@qubere/db';
import { NextResponse } from 'next/server';
export const noStore = { headers: { 'Cache-Control': 'no-store' } };
export const notFound = () => NextResponse.json({ error: 'NOT_FOUND' }, { status: 404, ...noStore });
export async function portalScope(req: Request, permission: string) {
    const ctx = await getAccountContext();
    if (!ctx)
        return { error: NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 }) } as const;
    if (!hasRequiredPortalPermission(ctx, permission))
        return { error: notFound() } as const;
    const scope = await getEffectiveUserScope(ctx.userId, ctx.accountId, ctx.roleNames ?? []);
    const resolved = resolvePortalClientScope(scope, new URL(req.url).searchParams.get('clientId'));
    if (resolved.forbidden)
        return { error: notFound() } as const;
    return { ctx, clientIds: resolved.clientIds } as const;
}
export async function portalData<T>(ctx: {
    dataMode?: string | null;
}, fn: () => Promise<T>): Promise<T> {
    return withDataModeContext(isDataMode(ctx.dataMode) ? ctx.dataMode : null, fn);
}
