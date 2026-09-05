import { NextResponse } from "next/server";
import { getAccountContext } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { db, isDataMode, withAccountIdContext, withDataModeContext } from "@/lib/db";
import { encryptSecret } from "@/lib/integrations/crypto";
import { getQboConfig, QBO_PROVIDER, QBO_SCOPES } from "@/lib/integrations/quickbooks/config";
import { exchangeCodeForTokens } from "@/lib/integrations/quickbooks/oauth";
import { qboApiFetch } from "@/lib/integrations/quickbooks/client";
import { verifyState } from "@/lib/integrations/quickbooks/state";

export const runtime = "nodejs";

const SETTINGS_PATH = "/app/billing/settings";

function backTo(reqUrl: string, params: Record<string, string>) {
  const url = new URL(SETTINGS_PATH, reqUrl);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

/**
 * Intuit OAuth redirect target. Exchanges the authorization code for tokens,
 * fetches the company name, and stores the (encrypted) connection against the
 * account.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const realmId = url.searchParams.get("realmId");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return backTo(req.url, { qbo: "error", reason: oauthError });
  }
  if (!code || !realmId || !state) {
    return backTo(req.url, { qbo: "error", reason: "missing_params" });
  }

  let statePayload;
  try {
    statePayload = verifyState(state);
  } catch {
    return backTo(req.url, { qbo: "error", reason: "bad_state" });
  }

  // The browser session must belong to the same account that started the flow.
  const ctx = await getAccountContext();
  if (!ctx || ctx.accountId !== statePayload.accountId) {
    return backTo(req.url, { qbo: "error", reason: "session_mismatch" });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    // Company display name (best-effort).
    let companyName: string | null = null;
    try {
      const info = await qboApiFetch<{ CompanyInfo?: { CompanyName?: string } }>({
        auth: { accessToken: tokens.accessToken, realmId },
        path: `/companyinfo/${realmId}`,
      });
      companyName = info.CompanyInfo?.CompanyName ?? null;
    } catch {
      // non-fatal
    }

    const now = Date.now();
    const { environment } = getQboConfig();

    await withDataModeContext(isDataMode(ctx.dataMode) ? ctx.dataMode : null, async () =>
      withAccountIdContext(ctx.accountId, async () => {
        const existing = await db.integrationConfig.findFirst({
          where: { accountId: ctx.accountId, provider: QBO_PROVIDER, clientId: null },
        });

        const data = {
          category: "ACCOUNTING" as const,
          name: "QuickBooks Online",
          status: "ACTIVE" as const,
          environment: environment === "production" ? "PRODUCTION" : "SANDBOX",
          realmId,
          providerAccountName: companyName,
          accessTokenEnc: encryptSecret(tokens.accessToken),
          refreshTokenEnc: encryptSecret(tokens.refreshToken),
          tokenExpiresAt: new Date(now + tokens.expiresIn * 1000),
          refreshTokenExpiresAt: new Date(now + tokens.refreshTokenExpiresIn * 1000),
          scopes: tokens.scope || QBO_SCOPES,
          connectedByUserId: ctx.userId,
          connectedAt: new Date(),
          lastErrorAt: null,
          lastErrorMessage: null,
        };

        const saved = existing
          ? await db.integrationConfig.update({ where: { id: existing.id }, data })
          : await db.integrationConfig.create({
              data: { accountId: ctx.accountId, provider: QBO_PROVIDER, clientId: null, ...data },
            });

        await createAuditLog({
          accountId: ctx.accountId,
          userId: ctx.userId,
          action: "INTEGRATION_CONNECTED",
          entity: "IntegrationConfig",
          entityId: saved.id,
          source: "UI",
          metadata: { provider: QBO_PROVIDER, realmId, environment, companyName },
        });
      }),
    );

    return backTo(req.url, { qbo: "connected" });
  } catch {
    return backTo(req.url, {
      qbo: "error",
      reason: "exchange_failed",
    });
  }
}
