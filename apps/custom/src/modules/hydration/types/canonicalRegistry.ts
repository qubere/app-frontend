/**
 * LLM-Driven Universal Field Hydration Engine — V1 Contracts & Types
 *
 * Grounding: Grounded evidence references, versioned semantic contracts,
 * candidates, facts, and evaluation metrics.
 */

export type EntityKind =
  | "SHIPMENT"
  | "PARTY_ROLE"
  | "LINE_ITEM"
  | "TRACKING_IDENTIFIER"
  | "EQUIPMENT"
  | "TRANSPORT_LEG"
  | "FILING_DRAFT"
  | "PRODUCT_ATTRIBUTE";

export type DataType =
  | "STRING"
  | "DECIMAL"
  | "INTEGER"
  | "DATE"
  | "COUNTRY"
  | "CURRENCY"
  | "CODE"
  | "JSON";

export type Cardinality = "ONE" | "MANY";

export type ProductEntitlement = "CUSTOMS" | "TMS";

export type RiskClass = "LOW" | "MEDIUM" | "CONSEQUENTIAL";

export type FieldState =
  | "OBSERVED"
  | "PROPOSED"
  | "PROMOTED"
  | "NEEDS_REVIEW"
  | "MISSING"
  | "NOT_APPLICABLE"
  | "CONFLICT"
  | "UNREADABLE"
  | "SUPERSEDED"
  | "HUMAN_LOCKED";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GroundedEvidenceReference {
  documentId: string;
  parseVersionId: string;
  extractionFieldId?: string;
  pageNumber?: number;
  bbox?: BoundingBox;
  rawLabel: string;
  rawValue: string;
  confidence?: number;
}

export interface CanonicalFieldDefinition {
  key: string; // e.g. "shipment.carrier.name", "lineItem[].htsCode"
  version: string; // e.g. "1.0.0"
  entityKind: EntityKind;
  label: string;
  description: string;
  dataType: DataType;
  cardinality: Cardinality;
  aliases: string[];
  sourceDocumentTypes: string[];
  products: ProductEntitlement[];
  jurisdictions: string[]; // ["*"] when universal, or e.g. ["US"]
  applicabilityRule: string;
  requiredRule: string | null;
  normalizer: string;
  validators: string[];
  riskClass: RiskClass;
  promotionPolicy: string;
  materializer: string;
  materializerConfig: Record<string, unknown>;
}

export interface HydrationProposal {
  targetFieldKey: string;
  targetEntityRef: string | null; // e.g. "line:1", "party:EXPORTER"
  sourceExtractionFieldIds: string[];
  evidenceReferences: GroundedEvidenceReference[];
  proposedValue: unknown;
  mappingConfidence: number;
  relationConfidence: number | null;
  reasoning: string;
  status: "PROPOSED" | "ABSTAINED";
  abstainReason: string | null;
}

export interface HydrationCandidate {
  id: string;
  hydrationRunId: string;
  accountId: string;
  shipmentId?: string;
  documentId: string;
  fieldDefinitionKey: string;
  targetEntityRef?: string;
  rawValue: unknown;
  normalizedValue?: unknown;
  extractionConfidence?: number;
  mappingConfidence?: number;
  validationScore?: number;
  corroborationScore?: number;
  calibratedDecisionScore?: number;
  status: FieldState;
  reasonCodes: string[];
  sourceExtractionFieldIds: string[];
  evidenceReferences: GroundedEvidenceReference[];
  supersedesCandidateId?: string;
  createdAt: string;
}

export interface FieldInventoryItem {
  legacyKey: string;
  tradeMetadataKey?: string;
  fieldReviewLabel?: string;
  directShipmentColumn?: string;
  factFieldName?: string;
  canonicalKey: string;
  entityKind: EntityKind;
  isDriftKey: boolean;
  notes?: string;
}

export interface EvalMetrics {
  totalBenchmarkFacts: number;
  totalApplicableFields: number;
  extractionRecall: number; // visible benchmark facts persisted with evidence / visible benchmark facts
  mappingCoverage: number; // applicable target fields with grounded candidate / applicable fields supported
  autoHydrationPrecision: number; // correct promoted values / all promoted values
  evidencedFillRate: number; // applicable fields with promoted or review-ready value / applicable fields
  conflictRate: number; // fields with unresolvable contradictory candidates / applicable fields
  avgLatencyMs: number;
  estimatedCostUsd: number;
}
