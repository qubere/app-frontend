/**
 * Shared structured logger for operational/observability logging (server
 * console / log aggregator), distinct from `createAuditLog` (the persisted
 * compliance trail in `@qubere/decisions`). Every log line is a single JSON
 * object so it stays greppable and parseable by a log aggregator, with a
 * consistent set of fields across every call site: timestamp, level,
 * accountId, userId.
 */

export type LogLevel = "info" | "warn" | "error";

export interface LogContext {
  accountId?: string | null;
  userId?: string | null;
  requestId?: string | null;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  method?: string;
  path?: string;
  status?: number;
  durationMs?: number;
  [key: string]: unknown;
}

function write(level: LogLevel, message: string, context?: LogContext, error?: unknown) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    accountId: context?.accountId ?? null,
    userId: context?.userId ?? null,
    ...context,
    ...(error !== undefined
      ? {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }
      : {}),
  };

  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, context?: LogContext) => write("info", message, context),
  warn: (message: string, context?: LogContext) => write("warn", message, context),
  error: (message: string, context?: LogContext, error?: unknown) => write("error", message, context, error),
};

/**
 * One line per API request: method, path, resolved account/user, status, and
 * duration. Wired into `withAuthenticatedRoute` / `withPublicRoute` /
 * `withCronRoute` in `./auth-guards`, so any route built on those gets this
 * automatically without a per-route change.
 */
export function logApiRequest(params: {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  accountId?: string | null;
  userId?: string | null;
  requestId?: string | null;
  error?: unknown;
}) {
  const { method, path, status, durationMs, accountId, userId, requestId, error } = params;
  const message = `${method} ${path} -> ${status} (${durationMs}ms)`;
  const context: LogContext = { method, path, status, durationMs, accountId, userId, requestId };

  if (error || status >= 500) {
    logger.error(message, context, error);
  } else {
    logger.info(message, context);
  }
}

/**
 * One line for a business-level event a route wants called out explicitly
 * beyond the automatic per-request line above — e.g. "document doc123
 * uploaded" or "decision dec_abc approved". Handlers for critical actions
 * should call this alongside (not instead of) `createAuditLog`, which
 * remains the persisted compliance record.
 */
export function logEvent(params: {
  action: string;
  message: string;
  accountId?: string | null;
  userId?: string | null;
  resourceType?: string;
  resourceId?: string;
  requestId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { action, message, accountId, userId, resourceType, resourceId, requestId, metadata } = params;
  logger.info(message, { action, accountId, userId, resourceType, resourceId, requestId, ...metadata });
}
