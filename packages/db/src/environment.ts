/**
 * Environment & Seed Safety Guard Utility
 * Guarantees that demo data seeding and mock routines are strictly disabled in production
 * and specifically blocked when deployed under app.qubere.ai.
 *
 * This is a deliberate duplicate of apps/custom/src/lib/environment.ts. That copy is
 * still used by app runtime code (e.g. src/modules/documents/parser/registry.ts) and
 * must stay there; this copy lets packages/db's own seed scripts guard demo seeding
 * without packages/db reaching back into an app package for a zero-dependency utility.
 * Keep the two in sync if the seeding-safety policy changes.
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
