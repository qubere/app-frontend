import { NextResponse } from "next/server";
import { getAccountContext, hasPermission } from "@/lib/auth";
import { isQboConfigured } from "@/lib/integrations/quickbooks/config";
import { buildAuthorizeUrl } from "@/lib/integrations/quickbooks/oauth";
import { signState } from "@/lib/integrations/quickbooks/state";

export const runtime = "nodejs";

/**
 * Starts the QuickBooks Online OAuth 2.0 authorization-code flow. Redirects the
 * browser to Intuit's consent screen with a signed `state` that carries the
 * initiating account/user through to the callback.
 */
export async function GET(req: Request) {
  const ctx = await getAccountContext();
  if (!ctx) {
    const signIn = new URL("/sign-in", req.url);
    return NextResponse.redirect(signIn);
  }

  if (!(await hasPermission("integration.configure"))) {
    return NextResponse.json(
      { error: "Forbidden: integration.configure permission required" },
      { status: 403 },
    );
  }

  if (!isQboConfigured()) {
    return NextResponse.json(
      {
        error:
          "QuickBooks integration is not configured. Set QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REDIRECT_URI and INTEGRATION_ENCRYPTION_KEY.",
      },
      { status: 500 },
    );
  }

  const state = signState({ accountId: ctx.accountId, userId: ctx.userId });
  return NextResponse.redirect(buildAuthorizeUrl(state));
}
