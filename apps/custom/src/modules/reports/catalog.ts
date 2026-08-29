/**
 * Compliance Reports catalog -- the single source of truth for which reports
 * exist, their formats and their available filters. Report code must never
 * offer a filter or column that isn't backed by an authoritative domain field.
 */

export type ReportFormat = "CSV" | "XLSX" | "PDF";

export type ReportFilterType = "dateRange" | "text" | "select" | "multiSelect" | "boolean";

export interface ReportFilterDef {
  key: string;
  label: string;
  type: ReportFilterType;
  options?: string[];
}

export interface ReportColumnDef {
  key: string;
  label: string;
}

export interface ReportCatalogEntry {
  id: string;
  name: string;
  description: string;
  domain:
    | "AUDIT_GOVERNANCE"
    | "SCREENING"
    | "CONTINUOUS_MONITORING"
    | "PRODUCT_CLASSIFICATION"
    | "LICENSES";
  formats: ReportFormat[];
  filters: ReportFilterDef[];
  columns: ReportColumnDef[];
  /** Permission required beyond the baseline "compliance.reports.generate". */
  requiresDomain?: boolean;
}

export const REPORT_CATALOG: ReportCatalogEntry[] = [
  {
    id: "compliance-audit",
    name: "Compliance Audit",
    description:
      "Audit-ready record of compliance decisions, evidence, reviews, overrides, users and timestamps.",
    domain: "AUDIT_GOVERNANCE",
    formats: ["CSV", "XLSX", "PDF"],
    filters: [
      { key: "dateFrom", label: "Date From", type: "dateRange" },
      { key: "dateTo", label: "Date To", type: "dateRange" },
      { key: "shipmentId", label: "Shipment / Transaction", type: "text" },
      { key: "executionType", label: "Compliance Service", type: "text" },
      { key: "status", label: "Automated Result", type: "text" },
    ],
    columns: [
      { key: "executionId", label: "Execution ID" },
      { key: "dateTime", label: "Date / Time" },
      { key: "shipment", label: "Shipment / Transaction" },
      { key: "complianceService", label: "Compliance Service" },
      { key: "automatedResult", label: "Automated Result" },
      { key: "finalOutcome", label: "Final Outcome" },
      { key: "override", label: "Override?" },
      { key: "reviewer", label: "Reviewer / User" },
      { key: "reason", label: "Reason" },
      { key: "correlationId", label: "Correlation ID" },
    ],
  },
  {
    id: "screening-activity",
    name: "Screening Activity",
    description: "Summary and detail of all party screening activity across screening types.",
    domain: "SCREENING",
    formats: ["CSV", "XLSX"],
    filters: [
      { key: "dateFrom", label: "Date From", type: "dateRange" },
      { key: "dateTo", label: "Date To", type: "dateRange" },
      { key: "matchStatus", label: "Result", type: "select", options: ["PASSED", "FLAGGED", "BLOCKED"] },
      { key: "targetType", label: "Screening Type", type: "text" },
    ],
    columns: [
      { key: "screenedAt", label: "Screened At" },
      { key: "party", label: "Party" },
      { key: "screeningType", label: "Screening Type" },
      { key: "result", label: "Result" },
      { key: "topMatch", label: "Top Match" },
      { key: "score", label: "Score" },
      { key: "listSource", label: "List" },
    ],
  },
  {
    id: "restricted-party-screening",
    name: "Restricted Party Screening",
    description: "Detailed RPS results with match evidence and reviewer disposition, per screening pass.",
    domain: "SCREENING",
    formats: ["CSV", "XLSX"],
    filters: [
      { key: "dateFrom", label: "Screening Date From", type: "dateRange" },
      { key: "dateTo", label: "Screening Date To", type: "dateRange" },
      { key: "status", label: "Automated Result", type: "select", options: ["CLEAR", "HIT", "REVIEW_REQUIRED", "PARTIAL", "ERROR"] },
      { key: "partyId", label: "Party", type: "text" },
    ],
    columns: [
      { key: "party", label: "Party" },
      { key: "screeningDate", label: "Screening Date" },
      { key: "automatedResult", label: "Automated Result" },
      { key: "hitCount", label: "Hit Count" },
      { key: "redFlagCount", label: "Red Flags" },
      { key: "matcherVersion", label: "Matcher Version" },
      { key: "referenceDataAsOf", label: "Reference Data Version" },
      { key: "correlationId", label: "Source Record ID" },
    ],
  },
  {
    id: "embargo-screening",
    name: "Embargo Screening",
    description: "Embargo/country-control decisions per shipment line with decision source and rule provenance.",
    domain: "SCREENING",
    formats: ["CSV", "XLSX"],
    filters: [
      { key: "dateFrom", label: "Date From", type: "dateRange" },
      { key: "dateTo", label: "Date To", type: "dateRange" },
      { key: "result", label: "Decision", type: "select", options: ["P", "F"] },
      { key: "shipmentId", label: "Shipment", type: "text" },
    ],
    columns: [
      { key: "shipment", label: "Shipment / Transaction" },
      { key: "complianceCountry", label: "Compliance Country" },
      { key: "screenedCountry", label: "Screened Country" },
      { key: "eccn", label: "ECCN" },
      { key: "militaryEndUse", label: "Military End Use" },
      { key: "matcher", label: "Decision Source" },
      { key: "ruleId", label: "Rule / Rule ID" },
      { key: "decision", label: "Decision" },
      { key: "screenedAt", label: "Timestamp" },
    ],
  },
  {
    id: "party-compliance",
    name: "Party Compliance",
    description: "Current compliance posture per party: RPS status, pre-approval, and monitoring state.",
    domain: "CONTINUOUS_MONITORING",
    formats: ["CSV", "XLSX"],
    filters: [
      { key: "partyId", label: "Party", type: "text" },
      { key: "status", label: "Current RPS Status", type: "text" },
    ],
    columns: [
      { key: "party", label: "Party" },
      { key: "currentRpsStatus", label: "Current RPS Status" },
      { key: "lastActualRpsScreen", label: "Last Actual RPS Screen" },
    ],
  },
  {
    id: "continuous-party-monitoring",
    name: "Continuous Party Monitoring",
    description: "Reference-data-triggered re-screening outcomes: transitions, escalations, and risk reduction.",
    domain: "CONTINUOUS_MONITORING",
    formats: ["CSV", "XLSX"],
    filters: [
      { key: "dateFrom", label: "Date From", type: "dateRange" },
      { key: "dateTo", label: "Date To", type: "dateRange" },
      { key: "transitionType", label: "Transition", type: "text" },
    ],
    columns: [
      { key: "party", label: "Party" },
      { key: "previousStatus", label: "Previous RPS Status" },
      { key: "newStatus", label: "Current RPS Status" },
      { key: "transitionType", label: "Transition" },
      { key: "isWorsening", label: "Escalation" },
      { key: "runId", label: "RDPS Run ID" },
      { key: "createdAt", label: "Screened At" },
    ],
  },
  {
    id: "compliance-exceptions-overrides",
    name: "Compliance Exceptions & Overrides",
    description: "Every human override of an automated compliance decision, with original decision preserved.",
    domain: "AUDIT_GOVERNANCE",
    formats: ["CSV", "XLSX", "PDF"],
    filters: [
      { key: "dateFrom", label: "Date From", type: "dateRange" },
      { key: "dateTo", label: "Date To", type: "dateRange" },
      { key: "resultRefType", label: "Compliance Service", type: "text" },
    ],
    columns: [
      { key: "date", label: "Date" },
      { key: "resultRefType", label: "Compliance Service" },
      { key: "originalDecision", label: "Original Decision" },
      { key: "overrideDecision", label: "Override Decision" },
      { key: "reason", label: "Reason" },
      { key: "overriddenBy", label: "Reviewer / User" },
      { key: "revoked", label: "Revoked?" },
      { key: "correlationId", label: "Correlation ID" },
    ],
  },
  {
    id: "classification-decisions",
    name: "Classification Decisions",
    description: "Attested HTS classification decisions with rationale, overrides and effective dates.",
    domain: "PRODUCT_CLASSIFICATION",
    formats: ["CSV", "XLSX"],
    filters: [
      { key: "dateFrom", label: "Date From", type: "dateRange" },
      { key: "dateTo", label: "Date To", type: "dateRange" },
      { key: "decisionStatus", label: "Decision Status", type: "select", options: ["APPROVED", "REJECTED", "OVERRIDDEN"] },
      { key: "caseId", label: "Case", type: "text" },
    ],
    columns: [
      { key: "date", label: "Attested Date" },
      { key: "case", label: "Case" },
      { key: "htsCode", label: "HTS Code" },
      { key: "description", label: "Description" },
      { key: "decisionStatus", label: "Decision Status" },
      { key: "reviewer", label: "Reviewer / User" },
      { key: "rationale", label: "Rationale" },
      { key: "overrideReason", label: "Override Reason" },
      { key: "effectiveFrom", label: "Effective From" },
      { key: "correlationId", label: "Correlation ID" },
    ],
  },
];

export function getCatalogEntry(reportType: string): ReportCatalogEntry | undefined {
  return REPORT_CATALOG.find((r) => r.id === reportType);
}
