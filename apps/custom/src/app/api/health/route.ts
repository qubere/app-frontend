import { NextResponse } from "next/server";
import { withPublicRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { getThirdPartyProviderHealth } from "@/lib/health/thirdPartyHealthService";

/**
 * GET /api/health
 *
 * Readiness/liveness endpoint.
 * - Validates database connectivity.
 * - Reports which customs transmission provider is active.
 * - Includes Git commit metadata & 15 third-party provider health checks.
 * - In explicit production deployments (APP_ENV === "production"), rejects if mock provider is active.
 * Returns 200 when healthy, 503 when not ready to serve production traffic.
 */
export const GET = withPublicRoute(async () => {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  const commit =
    process.env.NEXT_PUBLIC_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
    process.env.COMMIT_SHA ||
    process.env.CONTAINER_SHA ||
    process.env.K_REVISION ||
    "unknown";

  // ── Database check ─────────────────────────────────────────────────────────
  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown error";
    checks.database = { ok: false, detail: message };
  }

  // ── Customs transmission provider check ────────────────────────────────────
  const hasCbpCredentials =
    !!process.env.CBP_ABI_FILER_CODE && !!process.env.CBP_ABI_FILER_PASSWORD;

  const activeProviderName = hasCbpCredentials
    ? "RealAceProvider"
    : "MockCustomsTransmissionProvider";

  const appEnv = process.env.APP_ENV ?? process.env.NEXT_PUBLIC_APP_ENV;
  const deploymentEnvironment = appEnv ?? (process.env.NODE_ENV === "production" ? "demo" : process.env.NODE_ENV ?? "unknown");
  const requiresRealCustomsProvider = appEnv === "production" || process.env.STRICT_PRODUCTION_PROVIDERS === "true";

  if (requiresRealCustomsProvider && !hasCbpCredentials) {
    checks.customsProvider = {
      ok: false,
      detail:
        `PROVIDER_UNAVAILABLE: Production requires RealAceProvider (a real CBP ABI provider). ` +
        `MockCustomsTransmissionProvider is active. ` +
        `Set CBP_ABI_FILER_CODE and CBP_ABI_FILER_PASSWORD to activate RealAceProvider.`,
    };
  } else {
    checks.customsProvider = {
      ok: true,
      detail: hasCbpCredentials
        ? `RealAceProvider is configured (CBP_ABI_FILER_CODE is set).`
        : `MockCustomsTransmissionProvider is active — acceptable in non-production/demo environments.`,
    };
  }

  // ── 15 Third-Party Provider Health Checks ─────────────────────────────────
  const thirdPartyProviders = await getThirdPartyProviderHealth();

  const allOk = Object.values(checks).every((c) => c.ok);
  const status = allOk ? 200 : 503;

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      service: "qubere-customs-app",
      gitCommit: commit,
      environment: deploymentEnvironment,
      timestamp: new Date().toISOString(),
      activeCustomsProvider: activeProviderName,
      checks,
      thirdPartyProviders,
    },
    { status }
  );
});

