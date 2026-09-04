export type WorkItemKind =
  | "decision"
  | "finding"
  | "filing"
  | "document"
  | "exception"
  | "tender"
  | "carrier_invoice";

export type WorkPriority = "critical" | "high" | "normal";

export interface UrgencyContext {
  deadlineType: string;
  dueAt: Date;
  msRemaining: number;
  breached: boolean;
  estimated: boolean;
  exposureUsd: number | null;
}

export interface WorkItemSla {
  dueAt: Date | string | null;
  state: "ok" | "due_soon" | "breached";
  hoursLeft: number | null;
}

export interface WorkItemUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

export interface WorkItem {
  id: string;
  kind: WorkItemKind;
  title: string;
  reason: string;
  href: string;
  priority: WorkPriority;
  score: number;
  createdAt: Date;
  shipmentNumber: string | null;
  assignedToMe: boolean;
  assignedToUserId?: string | null;
  assignedToUser?: WorkItemUser | null;
  sla?: WorkItemSla | null;
  escalationLevel?: number;
  filingDeadline: Date | null;
  urgency: UrgencyContext | null;
  /** Declared value exposed by this item's shipment, in USD. Drives the B-1 rank and its explanation. */
  valueAtRisk?: number | null;
  /** True when this item blocks a downstream filing step. */
  blocking?: boolean;
}
