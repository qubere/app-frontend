/**
 * Pure routing + categorization for in-app (bell) notifications.
 *
 * No DB, no server-only imports -- the NotificationBell (client) and the
 * notify() helper (server) both read from this table so a notification always
 * lands the broker on the screen that can action it. Before this module every
 * notification linked to /app/documents regardless of what raised it.
 */

export type NotificationCategory =
  | "OPERATIONS"
  | "COMPLIANCE"
  | "LICENSING"
  | "BILLING"
  | "REGULATORY"
  | "DOCUMENTS"
  | "SYSTEM";

export interface NotificationLike {
  type: string;
  entityType: string | null;
  entityId: string | null;
}

interface NotificationTypeMeta {
  category: NotificationCategory;
  /** Human label for grouping in the bell. */
  label: string;
}

/**
 * Every `type` string written to the Notification table. Adding a producer?
 * Add its type here so the bell can categorize and route it.
 */
export const NOTIFICATION_TYPE_META: Record<string, NotificationTypeMeta> = {
  ASSIST_AMORTIZATION_WARNING: { category: "COMPLIANCE", label: "Assist balance" },
  INBOUND_EMAIL_DOCUMENTS: { category: "DOCUMENTS", label: "Documents" },
  DOCUMENT_MATCH_CONFLICT: { category: "DOCUMENTS", label: "Needs a shipment" },
  DOCUMENT_QUARANTINED: { category: "DOCUMENTS", label: "Quarantined" },
  WORK_ASSIGNED: { category: "OPERATIONS", label: "Assigned to you" },
  WORK_ESCALATED: { category: "OPERATIONS", label: "Escalated" },
  EXCEPTION_ASSIGNED: { category: "OPERATIONS", label: "Assigned to you" },
  EXCEPTION_CREATED: { category: "OPERATIONS", label: "New exception" },
  // Producers wired in a later phase -- listed now so routing is ready:
  LICENSE_EXPIRING: { category: "LICENSING", label: "License" },
  LICENSE_UTILIZATION: { category: "LICENSING", label: "License" },
  BILLING_EXCEPTION: { category: "BILLING", label: "Billing" },
  BILLING_LEAKAGE: { category: "BILLING", label: "Revenue leakage" },
  REGULATORY_UPDATE: { category: "REGULATORY", label: "Regulatory" },
  COMPLIANCE_FINDING: { category: "COMPLIANCE", label: "Compliance" },
  SLA_AT_RISK: { category: "OPERATIONS", label: "SLA at risk" },
  // Legacy type string, kept so pre-hub rows still categorize + route.
  regulatory_alert: { category: "REGULATORY", label: "Regulatory" },
};

const FALLBACK_META: NotificationTypeMeta = { category: "SYSTEM", label: "Update" };

export function notificationTypeMeta(type: string): NotificationTypeMeta {
  return NOTIFICATION_TYPE_META[type] ?? FALLBACK_META;
}

export function notificationCategory(type: string): NotificationCategory {
  return notificationTypeMeta(type).category;
}

/** Deep link for a notification row, keyed on its entity then its category. */
export function resolveNotificationHref(n: NotificationLike): string {
  switch (n.entityType) {
    case "InboundDocumentReview":
      return "/app/documents/inbound-review";
    case "Assist":
      return "/app/assists";
    case "AgentDecision":
      return n.entityId ? `/app/actions?decisionId=${encodeURIComponent(n.entityId)}` : "/app/actions";
    case "ExceptionItem":
      return n.entityId ? `/app/actions?exceptionId=${encodeURIComponent(n.entityId)}` : "/app/actions";
    case "Shipment":
      return n.entityId ? `/app/shipments/${encodeURIComponent(n.entityId)}` : "/app/shipments";
    case "CustomsFiling":
      return n.entityId ? `/app/filing/${encodeURIComponent(n.entityId)}` : "/app/filing";
    case "InboundEmail":
    case "ShipmentDocument":
      return "/app/documents";
    case "License":
    case "AccountLicense":
      return "/app/license-management";
    case "BillingException":
      return "/app/billing/exceptions";
    case "RegulatoryUpdate":
      return "/app/regulatory";
    case "ComplianceFinding":
      return "/app/compliance?tab=review";
    case "ComplianceScreeningFinding":
      return "/app/compliance?tab=screening";
  }

  // No entity -- fall back to the category's home surface.
  switch (notificationCategory(n.type)) {
    case "OPERATIONS":
      return "/app/actions";
    case "COMPLIANCE":
      return "/app/compliance";
    case "LICENSING":
      return "/app/license-management";
    case "BILLING":
      return "/app/billing";
    case "REGULATORY":
      return "/app/regulatory";
    case "DOCUMENTS":
      return "/app/documents";
    default:
      return "/app/actions";
  }
}
