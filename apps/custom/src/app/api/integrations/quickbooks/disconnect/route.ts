import { NextResponse } from "next/server";
import { getAccountContext, hasPermission } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { db, isDataMode, withAccountIdContext, withDataModeContext } from "@/lib/db";
import { decryptSecret } from "@/lib/integrations/crypto";
import { QBO_PROVIDER } from "@/lib/integrations/quickbooks/config";
import { revokeToken } from "@/lib/integrations/quickbooks/oauth";
import { loadQboConnection } from "@/lib/integrations/quickbooks/client";

export const runtime = "nodejs";

/** Revokes the QuickBooks connection for the account and clears stored tokens. */
export async function POST() {
  const ctx = await getAccountContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission("integration.configure"))) {
    return NextResponse.json(
      { error: "Forbidden: integration.configure permission required" },
      { status: 403 },
    );
  }

  return withDataModeContext(isDataMode(ctx.dataMode) ? ctx.dataMode : null, async () =>
    withAccountIdContext(ctx.accountId, async () => {
      const cfg = await loadQboConnection(ctx.accountId);
      if (!cfg) return NextResponse.json({ success: true, alreadyDisconnected: true });

      if (cfg.refreshTokenEnc) {
        try {
          await revokeToken(decryptSecret(cfg.refreshTokenEnc));
        } catch {
          // best-effort
        }
      }

      await db.integrationConfig.update({
        where: { id: cfg.id },
        data: {
          status: "INACTIVE",
          accessTokenEnc: null,
          refreshTokenEnc: null,
          tokenExpiresAt: null,
          refreshTokenExpiresAt: null,
          connectedAt: null,
          connectedByUserId: null,
          lastErrorAt: null,
          lastErrorMessage: null,
        },
      });

      await createAuditLog({
        accountId: ctx.accountId,
        userId: ctx.userId,
        action: "INTEGRATION_DISCONNECTED",
        entity: "IntegrationConfig",
        entityId: cfg.id,
        source: "UI",
        metadata: { provider: QBO_PROVIDER, realmId: cfg.realmId },
      });

      return NextResponse.json({ success: true });
    }),
  );
}
