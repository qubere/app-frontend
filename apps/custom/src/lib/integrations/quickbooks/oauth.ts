import { getQboConfig, QBO_SCOPES } from "./config";

/**
 * Raw Intuit OAuth 2.0 helpers (authorization-code grant). No SDK: Intuit's
 * node libraries are callback-based and stale; this is the entire surface we
 * need.
 */

export interface QboTokenSet {
  accessToken: string;
  refreshToken: string;
  /** seconds until the access token expires (typically 3600). */
  expiresIn: number;
  /** seconds until the refresh token expires (typically ~8726400 = 101 days). */
  refreshTokenExpiresIn: number;
  scope: string;
}

function basicAuthHeader(): string {
  const { clientId, clientSecret } = getQboConfig();
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

export function buildAuthorizeUrl(state: string): string {
  const { clientId, redirectUri, authorizeUrl } = getQboConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: QBO_SCOPES,
    redirect_uri: redirectUri,
    state,
  });
  return `${authorizeUrl}?${params.toString()}`;
}

interface IntuitTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
  token_type: string;
  scope?: string;
}

async function postToken(form: Record<string, string>): Promise<QboTokenSet> {
  const { tokenUrl } = getQboConfig();
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(form).toString(),
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Intuit token endpoint returned ${res.status}: ${text.slice(0, 500)}`);
  }
  const json = JSON.parse(text) as IntuitTokenResponse;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in,
    refreshTokenExpiresIn: json.x_refresh_token_expires_in,
    scope: json.scope ?? QBO_SCOPES,
  };
}

export function exchangeCodeForTokens(code: string): Promise<QboTokenSet> {
  const { redirectUri } = getQboConfig();
  return postToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
}

export function refreshAccessToken(refreshToken: string): Promise<QboTokenSet> {
  return postToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

/** Revoke a refresh (or access) token. Best-effort: never throws. */
export async function revokeToken(token: string): Promise<void> {
  try {
    const { revokeUrl } = getQboConfig();
    await fetch(revokeUrl, {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ token }),
      cache: "no-store",
    });
  } catch {
    // ignore — disconnect proceeds regardless
  }
}
