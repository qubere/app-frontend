import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { unifiedSearch } from "@/modules/search/unifiedSearchService";

export const GET = withAuthenticatedRoute(async ({ req, ctx }) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const clientId = url.searchParams.get("clientId");
  const limitRaw = url.searchParams.get("limit");

  const limit = limitRaw ? parseInt(limitRaw, 10) : 20;

  const result = await unifiedSearch({
    accountId: ctx.accountId,
    clientId: clientId ?? undefined,
    query: q,
    limit,
  });

  return NextResponse.json(result);
});
