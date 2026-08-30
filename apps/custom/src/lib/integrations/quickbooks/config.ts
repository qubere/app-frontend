/**
 * QuickBooks Online integration configuration.
 *
 * Required environment variables:
 *   QBO_CLIENT_ID           - Intuit app client id
 *   QBO_CLIENT_SECRET       - Intuit app client secret
 *   QBO_ENVIRONMENT         - "sandbox" | "production"  (default: "sandbox")
 *   QBO_REDIRECT_URI        - must exactly match a Redirect URI registered on
 *                             the Intuit app (e.g.
 *                             https://<preview-host>/api/integrations/quickbooks/callback)
 *
 * Also required (shared): INTEGRATION_ENCRYPTION_KEY  (see crypto.ts)
 */

export const QBO_PROVIDER = "QUICKBOOKS";
export const QBO_SCOPES = "com.intuit.quickbooks.accounting";

// Minor version pins the QBO API schema. Bump deliberately.
export const QBO_MINOR_VERSION = "75";

export type QboEnvironment = "sandbox" | "production";

export interface QboConfig {
  clientId: string;
  clientSecret: string;
  environment: QboEnvironment;
  redirectUri: string;
  /** OAuth authorize endpoint (same for both environments). */
  authorizeUrl: string;
  /** OAuth token + revoke endpoint (same for both environments). */
  tokenUrl: string;
  revokeUrl: string;
  /** Accounting API base, environment-specific. */
  apiBaseUrl: string;
}

export function getQboConfig(): QboConfig {
  const clientId = process.env.QBO_CLIENT_ID;
  const clientSecret = process.env.QBO_CLIENT_SECRET;
  const redirectUri = process.env.QBO_REDIRECT_URI;
  const environment = (process.env.QBO_ENVIRONMENT || "sandbox").toLowerCase() as QboEnvironment;

  const missing = [
    !clientId && "QBO_CLIENT_ID",
    !clientSecret && "QBO_CLIENT_SECRET",
    !redirectUri && "QBO_REDIRECT_URI",
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(`QuickBooks integration is not configured. Missing: ${missing.join(", ")}`);
  }
  if (environment !== "sandbox" && environment !== "production") {
    throw new Error(`QBO_ENVIRONMENT must be "sandbox" or "production" (got "${environment}")`);
  }

  return {
    clientId: clientId!,
    clientSecret: clientSecret!,
    environment,
    redirectUri: redirectUri!,
    authorizeUrl: "https://appcenter.intuit.com/connect/oauth2",
    tokenUrl: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    revokeUrl: "https://developer.api.intuit.com/v2/oauth2/tokens/revoke",
    apiBaseUrl:
      environment === "production"
        ? "https://quickbooks.api.intuit.com"
        : "https://sandbox-quickbooks.api.intuit.com",
  };
}

export function isQboConfigured(): boolean {
  return Boolean(
    process.env.QBO_CLIENT_ID &&
      process.env.QBO_CLIENT_SECRET &&
      process.env.QBO_REDIRECT_URI &&
      process.env.INTEGRATION_ENCRYPTION_KEY,
  );
}
