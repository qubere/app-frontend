import { createHmac, timingSafeEqual } from "crypto";

/**
 * Signed, self-contained OAuth `state` value. Carries the initiating account /
 * user through the Intuit redirect so the callback can bind the connection
 * without a server-side session lookup, and is HMAC-signed to prevent
 * tampering / CSRF. Expires after 15 minutes.
 */

const MAX_AGE_MS = 15 * 60 * 1000;

interface StatePayload {
  accountId: string;
  userId: string;
  iat: number;
}

function secret(): string {
  const s = process.env.INTEGRATION_STATE_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("INTEGRATION_STATE_SECRET (or NEXTAUTH_SECRET) must be set for OAuth state signing");
  return s;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function signState(input: { accountId: string; userId: string }): string {
  const payload: StatePayload = { accountId: input.accountId, userId: input.userId, iat: Date.now() };
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(token: string | null | undefined): StatePayload {
  if (!token || !token.includes(".")) throw new Error("Missing or malformed OAuth state");
  const [body, sig] = token.split(".");
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("OAuth state signature mismatch");
  }
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as StatePayload;
  if (!payload.accountId || !payload.userId || typeof payload.iat !== "number") {
    throw new Error("OAuth state payload is incomplete");
  }
  if (Date.now() - payload.iat > MAX_AGE_MS) {
    throw new Error("OAuth state has expired; please retry the connection");
  }
  return payload;
}
