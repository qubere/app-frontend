import { NextResponse } from "next/server";
import { getAccountContext, hasPermission } from "@/lib/auth";
import { db, isDataMode, withAccountIdContext, withDataModeContext } from "@/lib/db";
import { isQboConfigured } from "@/lib/integrations/quickbooks/config";
import { isConnectionActive, loadQboConnection } from "@/lib/integrations/quickbooks/client";
import { QBO_PROVIDER } from "@/lib/integrations/quickbooks/config";

export const runtime = "nodejs";

/** Connection status for the Settings UI. */
export async function GET() {
  const ctx = await getAccountContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission("integration.read"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return withDataModeContext(isDataMode(ctx.dataMode) ? ctx.dataMode : null, async () =>
    withAccountIdContext(ctx.accountId, async () => {
      const cfg = await loadQboConnection(ctx.accountId);
      const recentLogs = cfg
        ? await db.integrationSyncLog.findMany({
            where: { accountId: ctx.accountId, integrationConfigId: cfg.id },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true,
              direction: true,
              entityType: true,
              qubereId: true,
              providerId: true,
              status: true,
              message: true,
              durationMs: true,
              createdAt: true,
            },
          })
        : [];

      return NextResponse.json({
        provider: QBO_PROVIDER,
        configured: isQboConfigured(),
        connected: isConnectionActive(cfg),
        environment: cfg?.environment ?? null,
        companyName: cfg?.providerAccountName ?? null,
        realmId: cfg?.realmId ?? null,
        connectedAt: cfg?.connectedAt?.toISOString() ?? null,
        lastSyncAt: cfg?.lastSyncAt?.toISOString() ?? null,
        lastErrorAt: cfg?.lastErrorAt?.toISOString() ?? null,
        lastErrorMessage: cfg?.lastErrorMessage ?? null,
        recentLogs: recentLogs.map((l) => ({
          ...l,
          createdAt: l.createdAt.toISOString(),
        })),
      });
    }),
  );
}
