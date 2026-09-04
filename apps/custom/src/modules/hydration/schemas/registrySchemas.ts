/**
 * Runtime Zod Validation Schemas for LLM Universal Field Hydration Engine
 *
 * Validates registry releases, hydration run inputs, proposals, and candidates,
 * ensuring fail-closed protection against malformed field keys or cross-tenant data.
 */

import { z } from "zod";

export const EntityKindSchema = z.enum([
  "SHIPMENT",
  "PARTY_ROLE",
  "LINE_ITEM",
  "TRACKING_IDENTIFIER",
  "EQUIPMENT",
  "TRANSPORT_LEG",
  "FILING_DRAFT",
  "PRODUCT_ATTRIBUTE",
]);

export const DataTypeSchema = z.enum([
  "STRING",
  "DECIMAL",
  "INTEGER",
  "DATE",
  "COUNTRY",
  "CURRENCY",
  "CODE",
  "JSON",
]);

export const CardinalitySchema = z.enum(["ONE", "MANY"]);

export const RiskClassSchema = z.enum(["LOW", "MEDIUM", "CONSEQUENTIAL"]);

export const CanonicalFieldDefinitionSchema = z.object({
  key: z.string().min(1, "Field key is required"),
  version: z.string().min(1, "Version is required"),
  entityKind: EntityKindSchema,
  label: z.string().min(1, "Label is required"),
  description: z.string(),
  dataType: DataTypeSchema,
  cardinality: CardinalitySchema,
  aliases: z.array(z.string()),
  sourceDocumentTypes: z.array(z.string()),
  products: z.array(z.enum(["CUSTOMS", "TMS"])),
  jurisdictions: z.array(z.string()),
  applicabilityRule: z.string(),
  requiredRule: z.string().nullable(),
  normalizer: z.string(),
  validators: z.array(z.string()),
  riskClass: RiskClassSchema,
  promotionPolicy: z.string(),
  materializer: z.string(),
  materializerConfig: z.record(z.string(), z.unknown()),
});

export const HydrationRunInputSchema = z.object({
  accountId: z.string().min(1, "accountId is required"),
  shipmentId: z.string().optional(),
  documentId: z.string().min(1, "documentId is required"),
  activeParseVersionId: z.string().min(1, "activeParseVersionId is required"),
  fieldSchemaVersion: z.string().default("1.0.0"),
  extractionSchemaVersion: z.string().default("1.0.0"),
  mapperModelVersion: z.string().min(1),
  mapperPromptVersion: z.string().min(1),
  normalizationPolicyVersion: z.string().default("1.0.0"),
  idempotencyKey: z.string().optional(),
});

export const BoundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export const GroundedEvidenceReferenceSchema = z.object({
  documentId: z.string().min(1),
  parseVersionId: z.string().min(1),
  extractionFieldId: z.string().optional(),
  pageNumber: z.number().int().optional(),
  bbox: BoundingBoxSchema.optional(),
  rawLabel: z.string().min(1),
  rawValue: z.string(),
  confidence: z.number().optional(),
});

export const HydrationProposalSchema = z.object({
  targetFieldKey: z.string().min(1, "targetFieldKey is required"),
  targetEntityRef: z.string().nullable(),
  sourceExtractionFieldIds: z.array(z.string()),
  evidenceReferences: z.array(GroundedEvidenceReferenceSchema),
  proposedValue: z.unknown(),
  mappingConfidence: z.number().min(0).max(100),
  relationConfidence: z.number().min(0).max(100).nullable(),
  reasoning: z.string(),
  status: z.enum(["PROPOSED", "ABSTAINED"]),
  abstainReason: z.string().nullable(),
});
