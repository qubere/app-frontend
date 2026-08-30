/**
 * Cross-domain "Today" lanes.
 *
 * Today (/app/actions) has always been the Operations inbox: agent decisions,
 * exceptions, documents, filings. Phase 2 of the navigation redesign
 * (docs/plans/features/NAVIGATION-IA-REDESIGN.md) adds two more lanes so a
 * time-pressured broker sees everything on fire in one place:
 *
 *   - compliance -- open ComplianceFinding (the Review Queue) + open
 *     ComplianceScreeningFinding (embargo / UFLPA / end-use screening hits)
 *   - billing    -- open BillingException (revenue leakage, rate-card gaps)
 *
 * This module is the pure shape layer: DB rows in, a normalized `TodayLaneItem`
 * out, plus grouping and summary helpers. Querying lives in loadTodayLanes.ts.
 *
 * Deliberately NOT in this phase: inline resolve/waive for these lanes from
 * inside Today. Each item carries an `href` deep link to its native action
 * surface, where the existing, audited disposition flows live.
 */

export type TodayLane = "operations" | "compliance" | "billing";

export type TodaySeverity = "critical" | "high" | "normal";

const SEVERITY_RANK: Record<TodaySeverity, number> = { critical: 0, high: 1, normal: 2 };

export interface TodayLaneItem {
  id: string;
  lane: TodayLane;
  /** Sub-kind within the lane, e.g. "review-finding" | "screening-finding" | "billing-exception". */
  kind: string;
  severity: TodaySeverity;
  title: string;
  summary: string;
  /** Stable key for grouping cards -- a shipment id, filing id, or client id. */
  groupKey: string;
  /** Human label for the group header, e.g. "SHP-TGT-2026-001" or "Globex Corp". */
  groupLabel: string;
  clientName: string | null;
  shipmentNumber: string | null;
  /** Deep link to the native surface where this item is actioned. */
  href: string;
  /** ISO 8601. */
  createdAt: string;
}

export interface TodayLaneGroup {
  key: string;
  label: string;
  clientName: string | null;
  severity: TodaySeverity;
  items: TodayLaneItem[];
}

export interface TodayLaneSummary {
  lane: TodayLane;
  openCount: number;
  criticalCount: number;
  groups: TodayLaneGroup[];
}

// --- severity normalizers ---------------------------------------------------

/** ComplianceFinding: "Info" | "Warning" | "High" | "Critical". */
export function normalizeReviewFindingSeverity(raw: string): TodaySeverity {
  switch (raw.toLowerCase()) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    default:
      return "normal";
  }
}

/** ComplianceScreeningFinding / BillingException: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL". */
export function normalizeUpperSeverity(raw: string): TodaySeverity {
  switch (raw.toUpperCase()) {
    case "CRITICAL":
      return "critical";
    case "HIGH":
      return "high";
    default:
      return "normal";
  }
}

// --- row -> item mappers ---------------------------------------------------

export interface ReviewFindingRow {
  id: string;
  rule: string;
  severity: string;
  description: string;
  status: string;
  createdAt: Date;
  // ComplianceFinding -> CustomsFiling; client is resolved via the shipment.
  filing: {
    id: string;
    entryNumber: string;
    shipment: { id: string; shipmentNumber: string; client: { id: string; name: string } | null } | null;
  };
}

export function reviewFindingToItem(row: ReviewFindingRow): TodayLaneItem {
  const shipment = row.filing.shipment;
  const groupKey = shipment?.id ?? row.filing.id;
  const groupLabel = shipment?.shipmentNumber ?? `Entry ${row.filing.entryNumber}`;
  return {
    id: row.id,
    lane: "compliance",
    kind: "review-finding",
    severity: normalizeReviewFindingSeverity(row.severity),
    title: row.rule,
    summary: row.description,
    groupKey,
    groupLabel,
    clientName: shipment?.client?.name ?? null,
    shipmentNumber: shipment?.shipmentNumber ?? null,
    href: "/app/compliance?tab=review",
    createdAt: row.createdAt.toISOString(),
  };
}

export interface ScreeningFindingRow {
  id: string;
  category: string;
  ruleName: string;
  severity: string;
  details: string;
  status: string;
  createdAt: Date;
  shipment: { id: string; shipmentNumber: string; client: { id: string; name: string } | null } | null;
}

export function screeningFindingToItem(row: ScreeningFindingRow): TodayLaneItem {
  return {
    id: row.id,
    lane: "compliance",
    kind: "screening-finding",
    severity: normalizeUpperSeverity(row.severity),
    title: `${row.category.replace(/_/g, " ")}: ${row.ruleName}`,
    summary: row.details,
    groupKey: row.shipment?.id ?? row.id,
    groupLabel: row.shipment?.shipmentNumber ?? "Unlinked screening hit",
    clientName: row.shipment?.client?.name ?? null,
    shipmentNumber: row.shipment?.shipmentNumber ?? null,
    href: "/app/compliance?tab=screening",
    createdAt: row.createdAt.toISOString(),
  };
}

export interface BillingExceptionRow {
  id: string;
  type: string;
  severity: string;
  description: string;
  status: string;
  createdAt: Date;
  shipment: { id: string; shipmentNumber: string } | null;
  client: { id: string; name: string } | null;
}

export function billingExceptionToItem(row: BillingExceptionRow): TodayLaneItem {
  const groupKey = row.shipment?.id ?? row.client?.id ?? row.id;
  const groupLabel =
    row.shipment?.shipmentNumber ?? row.client?.name ?? "Account-level";
  return {
    id: row.id,
    lane: "billing",
    kind: "billing-exception",
    severity: normalizeUpperSeverity(row.severity),
    title: row.type
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    summary: row.description,
    groupKey,
    groupLabel,
    clientName: row.client?.name ?? null,
    shipmentNumber: row.shipment?.shipmentNumber ?? null,
    href: "/app/billing/exceptions",
    createdAt: row.createdAt.toISOString(),
  };
}

// --- grouping + summary --------------------------------------------------

function worstSeverity(items: TodayLaneItem[]): TodaySeverity {
  return items.reduce<TodaySeverity>(
    (worst, it) => (SEVERITY_RANK[it.severity] < SEVERITY_RANK[worst] ? it.severity : worst),
    "normal"
  );
}

/**
 * Group items into cards by `groupKey`, newest-activity groups first, most
 * severe within a group first. Stable: ties break on group label then id so
 * the order does not jitter between reloads.
 */
export function groupLaneItems(items: TodayLaneItem[]): TodayLaneGroup[] {
  const byKey = new Map<string, TodayLaneItem[]>();
  for (const item of items) {
    const bucket = byKey.get(item.groupKey);
    if (bucket) bucket.push(item);
    else byKey.set(item.groupKey, [item]);
  }

  const groups: TodayLaneGroup[] = [];
  for (const [key, groupItems] of byKey) {
    const sorted = [...groupItems].sort(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        b.createdAt.localeCompare(a.createdAt) ||
        a.id.localeCompare(b.id)
    );
    groups.push({
      key,
      label: sorted[0].groupLabel,
      clientName: sorted[0].clientName,
      severity: worstSeverity(sorted),
      items: sorted,
    });
  }

  return groups.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      b.items[0].createdAt.localeCompare(a.items[0].createdAt) ||
      a.label.localeCompare(b.label)
  );
}

export function summarizeLane(lane: TodayLane, items: TodayLaneItem[]): TodayLaneSummary {
  return {
    lane,
    openCount: items.length,
    criticalCount: items.filter((it) => it.severity === "critical").length,
    groups: groupLaneItems(items),
  };
}
