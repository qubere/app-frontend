export const EXCEPTION_CATEGORIES = [
  "MISSING_DATA",
  "CONFLICT",
  "VALIDATION",
  "COMPLIANCE",
  "DOCUMENT",
  "CLASSIFICATION",
  "VALUATION",
  "FILING",
  "PLAN_CHANGE",
  "SYSTEM",
] as const;
export type ExceptionCategory = (typeof EXCEPTION_CATEGORIES)[number];

export const EXCEPTION_TYPES = [
  "missing_document",
  "data_mismatch",
  "broker_hold",
  "compliance_flag",
  "plan_drift",
  "rdps_recall_gap",
  "rdps_worsening_transition",
  "unassigned_intake",
] as const;
export type ExceptionType = (typeof EXCEPTION_TYPES)[number];
