import { getAccountContext } from "@/lib/auth";

export interface ThirdPartyLogOptions {
  provider: string;
  url: string;
  method?: string;
  status?: number;
  statusText?: string;
  durationMs: number;
  error?: unknown;
  userId?: string | null;
  accountId?: string | null;
  correlationId?: string | null;
  metadata?: string | null;
}

export async function logThirdPartyCall(options: ThirdPartyLogOptions): Promise<void> {
  const timestamp = new Date().toISOString();
  let userId = options.userId;
  let accountId = options.accountId;

  if (userId === undefined || accountId === undefined) {
    try {
      const ctx = await getAccountContext();
      if (ctx) {
        userId = userId ?? ctx.userId;
        accountId = accountId ?? ctx.accountId;
      }
    } catch {
      // Ignore context resolution failure outside request context
    }
  }

  const userStr = userId ? `[User: ${userId}]` : "[User: system]";
  const accountStr = accountId ? `[Account: ${accountId}]` : "[Account: N/A]";
  const correlationStr = options.correlationId ? ` [Correlation: ${options.correlationId}]` : "";
  const metaStr = options.metadata ? ` (${options.metadata})` : "";
  const methodStr = (options.method || "GET").toUpperCase();
  const statusStr = options.status != null ? `Status: ${options.status} ${options.statusText || ""}`.trim() : "FAILED";

  if (options.error) {
    console.error(
      `[ThirdPartyHTTP] [${timestamp}] ${userStr} ${accountStr}${correlationStr} [Provider: ${options.provider}] ${methodStr} ${options.url} -> ${statusStr} (${options.durationMs}ms)${metaStr}:`,
      options.error
    );
  } else {
    console.log(
      `[ThirdPartyHTTP] [${timestamp}] ${userStr} ${accountStr}${correlationStr} [Provider: ${options.provider}] ${methodStr} ${options.url} -> ${statusStr} (${options.durationMs}ms)${metaStr}`
    );
  }
}

export async function thirdPartyFetch(
  provider: string,
  url: string,
  init?: RequestInit & { userId?: string | null; accountId?: string | null; correlationId?: string | null }
): Promise<Response> {
  const startTime = Date.now();
  const method = init?.method || "GET";
  const { userId, accountId, correlationId, ...fetchInit } = init || {};

  try {
    const res = await fetch(url, fetchInit);
    const durationMs = Date.now() - startTime;
    void logThirdPartyCall({
      provider,
      url,
      method,
      status: res.status,
      statusText: res.statusText,
      durationMs,
      userId,
      accountId,
      correlationId,
    });
    return res;
  } catch (err) {
    const durationMs = Date.now() - startTime;
    void logThirdPartyCall({
      provider,
      url,
      method,
      durationMs,
      error: err,
      userId,
      accountId,
      correlationId,
    });
    throw err;
  }
}
