import { NextResponse } from 'next/server';
import { authorizedProof } from '@/lib/entry-proof';
import { noStore, withPortalAccount } from '@/lib/portal-scope';
export const GET = withPortalAccount(async (_ctx, _req: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) => {
    const result = await authorizedProof((await params).id);
    if (result.error)
        return result.error;
    return NextResponse.json(result.proof.payload, noStore);
});
