import { db } from "@qubere/db";

export type AuditSource = "UI" | "CHAT" | "SYSTEM" | "API" | "EMAIL" | "AGENT";

export function assertAppendOnlyAuditPolicy(operation: "INSERT" | "UPDATE" | "DELETE" = "INSERT"): boolean {
  if (operation !== "INSERT") {
    throw new Error(`AuditLog mutation violation: ${operation} operation prohibited on append-only audit trail.`);
  }
  return true;
}

export interface CreateAuditLogParams {
  accountId: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  source?: AuditSource | string | null;
  metadata?: Record<string, unknown> | null;
  beforeJson?: Record<string, unknown> | null;
  afterJson?: Record<string, unknown> | null;
  correlationId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  success?: boolean;
  failClosed?: boolean;
}

export async function createAuditLog(params: CreateAuditLogParams) {
  try {
    let ipAddress = params.ipAddress;
    let userAgent = params.userAgent;
    let headerSource: AuditSource | null = null;

    try {
      if (typeof window === "undefined") {
        const { headers: getHeaders } = await import("next/headers");
        const headerList = await getHeaders();
        if (!ipAddress) {
          ipAddress =
            headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            headerList.get("x-real-ip") ||
            null;
        }
        if (!userAgent) {
          userAgent = headerList.get("user-agent") || null;
        }
        const xSource = headerList.get("x-qubere-source") || headerList.get("x-audit-source");
        if (
          xSource === "CHAT" ||
          xSource === "SYSTEM" ||
          xSource === "API" ||
          xSource === "UI" ||
          xSource === "EMAIL" ||
          xSource === "AGENT"
        ) {
          headerSource = xSource as AuditSource;
        }
      }
    } catch {
      // Ignore if called outside request context
    }

    const metadata: Record<string, unknown> | undefined =
      params.metadata || params.beforeJson || params.afterJson
        ? {
            ...(params.metadata ?? {}),
            ...(params.beforeJson ? { beforeJson: params.beforeJson } : {}),
            ...(params.afterJson ? { afterJson: params.afterJson } : {}),
          }
        : undefined;

    const resolvedSource =
      params.source && params.source !== "UI"
        ? params.source
        : (headerSource ?? params.source ?? "UI");

    return await db.auditLog.create({
      data: {
        accountId: params.accountId,
        userId: params.userId ?? null,
        action: String(params.action),
        entity: params.entity,
        entityId: params.entityId,
        source: resolvedSource,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        requestId: params.requestId || null,
        success: params.success ?? true,
      },
    });
  } catch (error) {
    if (params.failClosed) {
      throw error;
    }
    console.error("Failed to create audit log entry:", error);
    return null;
  }
}
