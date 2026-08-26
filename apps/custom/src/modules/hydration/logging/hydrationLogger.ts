/**
 * Structured Telemetry & Diagnostics Logger — LLM Universal Field Hydration
 *
 * Provides observable, structured logging for pipeline executions, fail-closed rejections,
 * swallowed exceptions, and materialization outcomes.
 */

export interface HydrationLogContext {
  accountId?: string;
  shipmentId?: string;
  documentId?: string;
  runId?: string;
  fieldKey?: string;
  [key: string]: unknown;
}

export class HydrationLogger {
  private static formatMessage(level: "INFO" | "WARN" | "ERROR", message: string, context?: HydrationLogContext): string {
    const timestamp = new Date().toISOString();
    const ctxString = context ? ` ${JSON.stringify(context)}` : "";
    return `[UNIVERSAL_HYDRATION] [${timestamp}] [${level}] ${message}${ctxString}`;
  }

  public static info(message: string, context?: HydrationLogContext) {
    console.log(this.formatMessage("INFO", message, context));
  }

  public static warn(message: string, context?: HydrationLogContext) {
    console.warn(this.formatMessage("WARN", message, context));
  }

  public static error(message: string, error?: unknown, context?: HydrationLogContext) {
    const errCtx = {
      ...context,
      errorMessage: error instanceof Error ? error.message : String(error ?? "Unknown error"),
      stack: error instanceof Error ? error.stack : undefined,
    };
    console.error(this.formatMessage("ERROR", message, errCtx));
  }
}
