/**
 * Environment & Seed Safety Guard Utility
 * Guarantees that demo data seeding and mock routines are strictly disabled in production
 * and specifically blocked when deployed under app.qubere.ai.
 */

export function isProductionEnvironment(req?: Request): boolean {
  if (process.env.NODE_ENV === "production") return true;
  if (process.env.APP_ENV === "production" || process.env.NEXT_PUBLIC_APP_ENV === "production") return true;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  if (appUrl.includes("app.qubere.ai") || appUrl.includes("qubere.ai")) return true;

  if (req) {
    const host = req.headers.get("host") || "";
    const origin = req.headers.get("origin") || "";
    if (host.includes("app.qubere.ai") || origin.includes("app.qubere.ai")) {
      return true;
    }
  }

  return false;
}

/**
 * Coarse deployment tier, used to decide whether stand-in providers (mock
 * parser, etc.) may run. Unlike `isProductionEnvironment`, a hosted *demo* is
 * explicitly NOT "local" — the demo must behave like production for anything a
 * customer would rely on, including document parsing.
 *
 *  - "local"      — a developer machine or CI: no APP_ENV / NEXT_PUBLIC_APP_ENV,
 *                   or it is set to "development"/"test", and no hosted parser
 *                   endpoint is configured.
 *  - "demo"       — the shared demo deployment (APP_ENV=demo).
 *  - "production" — a real customer environment.
 */
export function deploymentTier(): "local" | "demo" | "production" {
  if (isProductionEnvironment()) return "production";

  const appEnv = (process.env.APP_ENV || process.env.NEXT_PUBLIC_APP_ENV || "").trim().toLowerCase();
  if (appEnv === "demo" || appEnv === "staging" || appEnv === "preview") return "demo";

  // A hosted parser endpoint is only ever set on a deployed environment; if one
  // is present treat this as "demo" so a stand-in provider cannot slip in.
  if ((process.env.DOCLING_API_BASE_URL || "").trim() !== "") return "demo";

  return "local";
}

export function isDemoSeedingAllowed(req?: Request): boolean {
  // Absolute block on production environments or app.qubere.ai domain
  if (isProductionEnvironment(req)) {
    return false;
  }

  // Allowed in local development or explicit sandbox staging setups
  return process.env.ALLOW_DEMO_SEEDING === "true" || process.env.NODE_ENV === "development";
}

export function assertDemoSeedingAllowed(req?: Request): void {
  if (!isDemoSeedingAllowed(req)) {
    throw new Error(
      "SECURITY_VIOLATION: Demo data seeding is strictly prohibited in production environments or on app.qubere.ai"
    );
  }
}
