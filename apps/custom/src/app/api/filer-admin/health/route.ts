import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { getFilerAdminHealth } from "@/modules/filing/filerAdminService";

/**
 * 19 CFR 143 Subpart A filer-admin health for the account's filer code,
 * computed from FilerExport delivery history and ABI credential state.
 */
export const GET = withAuthenticatedRoute(
  async ({ ctx, req, requestId }) => {
    const windowParam = Number(new URL(req.url).searchParams.get("windowDays"));
    const windowDays = Number.isFinite(windowParam) && windowParam > 0 ? Math.min(windowParam, 365) : undefined;

    const health = await getFilerAdminHealth(ctx.accountId, { windowDays });
    return NextResponse.json({ health, requestId });
  },
  { permission: "filing.read" }
);
