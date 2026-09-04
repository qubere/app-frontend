import { NextResponse } from 'next/server';
import { withPortalAccount, portalScope, noStore } from '@/lib/portal-scope';
import { loadInboundAddresses } from '@/lib/inbound-addresses';
export const GET = withPortalAccount(async (_ctx, req: Request) => {
  const scope = await portalScope(req, 'portal.setup.read');
  if (scope.error) return scope.error;
  const addresses = await loadInboundAddresses(scope.ctx.accountId, scope.clientIds);
  return NextResponse.json({ inboundAddress: addresses.length === 1 ? addresses[0] : null, addresses }, noStore);
});
