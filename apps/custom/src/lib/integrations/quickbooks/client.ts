import type { IntegrationConfig } from "@prisma/client";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/integrations/crypto";
import { getQboConfig, QBO_MINOR_VERSION, QBO_PROVIDER } from "./config";
import { refreshAccessToken } from "./oauth";

/**
 * Loads the account-wide QuickBooks connection (clientId = null). Callers are
 * responsible for running inside the account's dataMode / accountId context.
 */
export async function loadQboConnection(accountId: string): Promise<IntegrationConfig | null> {
  return db.integrationConfig.findFirst({
    where: { accountId, provider: QBO_PROVIDER, clientId: null },
  });
}

export function isConnectionActive(cfg: IntegrationConfig | null): cfg is IntegrationConfig {
  return Boolean(
    cfg &&
      cfg.status === "ACTIVE" &&
      cfg.realmId &&
      cfg.accessTokenEnc &&
      cfg.refreshTokenEnc,
  );
}

export interface QboAuth {
  accessToken: string;
  realmId: string;
}

/**
 * Returns a valid access token for the connection, refreshing it (and
 * persisting the rotated refresh token) when it is within 2 minutes of expiry.
 * Must run inside the connection account's context.
 */
export async function ensureFreshToken(cfg: IntegrationConfig): Promise<QboAuth> {
  if (!isConnectionActive(cfg)) {
    throw new Error("QuickBooks is not connected for this account");
  }

  const skewMs = 2 * 60 * 1000;
  const expiresAt = cfg.tokenExpiresAt?.getTime() ?? 0;
  if (Date.now() < expiresAt - skewMs) {
    return { accessToken: decryptSecret(cfg.accessTokenEnc!), realmId: cfg.realmId! };
  }

  // Refresh.
  const currentRefresh = decryptSecret(cfg.refreshTokenEnc!);
  let tokens;
  try {
    tokens = await refreshAccessToken(currentRefresh);
  } catch (err) {
    await db.integrationConfig.update({
      where: { id: cfg.id },
      data: {
        status: "ERROR",
        lastErrorAt: new Date(),
        lastErrorMessage: `Token refresh failed: ${(err as Error).message}`,
      },
    });
    throw new Error(
      "QuickBooks session expired and could not be refreshed. Reconnect QuickBooks in Settings.",
    );
  }

  const now = Date.now();
  await db.integrationConfig.update({
    where: { id: cfg.id },
    data: {
      accessTokenEnc: encryptSecret(tokens.accessToken),
      refreshTokenEnc: encryptSecret(tokens.refreshToken),
      tokenExpiresAt: new Date(now + tokens.expiresIn * 1000),
      refreshTokenExpiresAt: new Date(now + tokens.refreshTokenExpiresIn * 1000),
      scopes: tokens.scope,
      status: "ACTIVE",
      lastErrorAt: null,
      lastErrorMessage: null,
    },
  });

  return { accessToken: tokens.accessToken, realmId: cfg.realmId! };
}

export interface QboRequest {
  auth: QboAuth;
  path: string; // e.g. "/query" or "/invoice"
  method?: "GET" | "POST";
  query?: Record<string, string>;
  body?: unknown;
}

/** Calls the QuickBooks Accounting API and returns parsed JSON. Throws with the
 * Intuit fault payload on non-2xx. */
export async function qboApiFetch<T = unknown>(req: QboRequest): Promise<T> {
  const { apiBaseUrl } = getQboConfig();
  const { accessToken, realmId } = req.auth;

  const url = new URL(`${apiBaseUrl}/v3/company/${realmId}${req.path}`);
  url.searchParams.set("minorversion", QBO_MINOR_VERSION);
  for (const [k, v] of Object.entries(req.query ?? {})) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    method: req.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(req.body ? { "Content-Type": "application/json" } : {}),
    },
    body: req.body ? JSON.stringify(req.body) : undefined,
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`QuickBooks API ${req.method ?? "GET"} ${req.path} -> ${res.status}: ${text.slice(0, 800)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/** QBO query language helper (SELECT ... FROM ...). */
export function qboQuery(auth: QboAuth, statement: string) {
  return qboApiFetch<{ QueryResponse: Record<string, unknown[]> }>({
    auth,
    path: "/query",
    query: { query: statement },
  });
}
