export type TmsAgentTask =
  | "FREIGHT_INTAKE"
  | "MOVEMENT_PLANNING"
  | "CARRIER_SELECTION"
  | "RATE_QUOTING"
  | "TENDER_DISPATCH"
  | "ETA_PREDICTION"
  | "RISK_DETECTION"
  | "EXCEPTION_RESOLUTION"
  | "FREIGHT_AUDIT"
  | "APPOINTMENT_SCHEDULING"
  | "POD_VALIDATION";

export type TmsMemoryType =
  | "FACT"
  | "PREFERENCE"
  | "PROCEDURE"
  | "DECISION"
  | "EXCEPTION"
  | "PATTERN";

export type TmsMemorySubjectType =
  | "SHIPMENT"
  | "CUSTOMER"
  | "CARRIER"
  | "LANE"
  | "FACILITY"
  | "MOVEMENT"
  | "APPOINTMENT"
  | "RATE"
  | "TENDER"
  | "TRACKING"
  | "ETA"
  | "ACCESSORIAL"
  | "INVOICE";

export type TmsMemorySourceType =
  | "HUMAN_DECISION"
  | "VERIFIED_DOCUMENT"
  | "AGENT_INFERENCE"
  | "CUSTOMER_INSTRUCTION"
  | "TENDER_OUTCOME"
  | "CARRIER_PERFORMANCE"
  | "TRACKING_OUTCOME"
  | "INVOICE_AUDIT";

export const EMBEDDING_DIMENSIONS = 768;

export const TASK_SUBJECT_TYPES: Record<TmsAgentTask, TmsMemorySubjectType[]> = {
  FREIGHT_INTAKE: ["CUSTOMER", "LANE", "FACILITY"],
  MOVEMENT_PLANNING: ["LANE", "FACILITY", "MOVEMENT", "APPOINTMENT"],
  CARRIER_SELECTION: ["CARRIER", "LANE", "TENDER"],
  RATE_QUOTING: ["RATE", "LANE", "CUSTOMER", "ACCESSORIAL"],
  TENDER_DISPATCH: ["CARRIER", "LANE", "TENDER"],
  ETA_PREDICTION: ["ETA", "TRACKING", "LANE", "CARRIER", "FACILITY"],
  RISK_DETECTION: ["TRACKING", "ETA", "LANE", "FACILITY", "SHIPMENT"],
  EXCEPTION_RESOLUTION: ["SHIPMENT", "CARRIER", "FACILITY", "TRACKING", "ACCESSORIAL", "INVOICE"],
  FREIGHT_AUDIT: ["INVOICE", "ACCESSORIAL", "CARRIER", "RATE"],
  APPOINTMENT_SCHEDULING: ["APPOINTMENT", "FACILITY", "CARRIER"],
  POD_VALIDATION: ["SHIPMENT", "CUSTOMER", "CARRIER"],
};

export interface TmsMemoryScope extends Record<string, unknown> {
  shipmentId?: string;
  transportationOrderId?: string;
  movementId?: string;
  quoteId?: string;
  tenderId?: string;
  invoiceId?: string;
  exceptionId?: string;
  customerId?: string;
  customerName?: string;
  carrierId?: string;
  carrierName?: string;
  scac?: string;
  laneKey?: string;
  origin?: string;
  destination?: string;
  mode?: string;
  equipment?: string;
  serviceLevel?: string;
  incoterm?: string;
  customsRequired?: boolean;
  facilityId?: string;
  exceptionType?: string;
  chargeCode?: string;
  targetMarginPct?: number;
  requiredDocuments?: string[];
  trackingFreshnessHours?: number;
  promiseRiskBufferHours?: number;
  lfdRiskHours?: number;
  outcome?: "APPROVED" | "REJECTED" | "ACCEPTED" | "EXPIRED" | "RESOLVED" | "DISPUTED";
  ruleKey?: string;
}

export interface MemoryEvidenceRecord {
  id: string;
  accountId: string;
  memoryId: string;
  sourceType: TmsMemorySourceType;
  sourceId: string | null;
  eventKey: string | null;
  excerpt: string;
  confidence: number;
  createdAt: Date;
}

export interface TmsMemoryRecord {
  id: string;
  accountId: string;
  domain: "TMS";
  task: string | null;
  agentName: string | null;
  type: TmsMemoryType;
  subjectType: TmsMemorySubjectType;
  subjectId: string | null;
  content: string;
  confidence: number;
  validFrom: Date;
  validUntil: Date | null;
  sourceType: TmsMemorySourceType;
  sourceId: string | null;
  eventKey: string | null;
  supersedesMemoryId: string | null;
  embedding: number[];
  searchVector: string | null;
  scope: TmsMemoryScope | null;
  occurrenceCount: number;
  lastObservedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  evidence?: MemoryEvidenceRecord[];
}

export interface ScoredTmsMemory extends TmsMemoryRecord {
  score: number;
  lexicalRank: number | null;
  vectorRank: number | null;
  rrfScore: number;
  scopeMatches: number;
}

export interface TmsMemorySearchQuery {
  accountId: string;
  task: TmsAgentTask;
  query?: string;
  scope?: TmsMemoryScope;
  limit?: number;
  subjectTypes?: TmsMemorySubjectType[];
}

export interface TmsAccountMemoryContext {
  accountId: string;
  task: TmsAgentTask;
  memories: ScoredTmsMemory[];
  formattedText: string;
  memoryCount: number;
  retrievalStatus: "AVAILABLE" | "EMPTY" | "UNAVAILABLE";
}

export interface TmsMemoryCandidate {
  accountId: string;
  task: TmsAgentTask;
  agentName?: string | null;
  type: TmsMemoryType;
  subjectType: TmsMemorySubjectType;
  subjectId?: string | null;
  content: string;
  confidence: number;
  sourceType: TmsMemorySourceType;
  sourceId: string;
  evidenceExcerpt: string;
  scope?: TmsMemoryScope;
  observedAt?: string;
}

export type TmsMemoryDomainEvent =
  | { kind: "DECISION_REVIEWED"; accountId: string; eventId: string; decisionId: string; action: "approve" | "reject"; note?: string | null }
  | { kind: "EXCEPTION_RESOLVED"; accountId: string; eventId: string; exceptionId: string }
  | { kind: "TENDER_OUTCOME_RECORDED"; accountId: string; tenderId: string }
  | { kind: "INVOICE_AUDITED"; accountId: string; carrierInvoiceId: string; decisionId: string };
