// Restricted / Denied-Party Screening -- indexed candidate-lookup observability.
//
// Structured, low-cardinality diagnostics only (entity/token counts,
// durations, boolean flags) -- never raw screened names or matched entity
// data, which would be PII in a log line. Follows the same
// [TAG] [timestamp] [LEVEL] message {context} shape as HydrationLogger
// (apps/custom/src/modules/hydration/logging/hydrationLogger.ts). Logging
// only -- no new DB table, no persisted diagnostics.
export interface RpsIndexLogContext {
  [key: string]: unknown;
}

function formatMessage(level: "INFO" | "WARN", message: string, context?: RpsIndexLogContext): string {
  const timestamp = new Date().toISOString();
  const ctxString = context ? ` ${JSON.stringify(context)}` : "";
  return `[RPS_INDEX] [${timestamp}] [${level}] ${message}${ctxString}`;
}

export const rpsIndexLogger = {
  info(message: string, context?: RpsIndexLogContext): void {
    console.log(formatMessage("INFO", message, context));
  },
  warn(message: string, context?: RpsIndexLogContext): void {
    console.warn(formatMessage("WARN", message, context));
  },
};
