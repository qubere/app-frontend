import { z } from "zod";
export const ASSIST_TYPES = ["tooling", "materials", "engineering", "design", "other"] as const;
export const ALLOCATION_METHODS = ["lump_sum", "equal_allocation", "value_proportional"] as const;
export const OVERRIDE_REASONS = ["broker_judgment", "customer_documentation", "prior_period_correction", "other"] as const;
export const moneyString = z.string().regex(/^\d{1,14}(\.\d{1,2})?$/, "Use a nonnegative amount with at most two decimals.");
export const assistInputSchema = z.object({
  type: z.enum(ASSIST_TYPES),
  description: z.string().trim().min(1).max(500),
  importerOfRecordId: z.string().min(1).nullable().default(null),
  totalValue: moneyString.refine(v => Number(v) > 0, "Total value must be positive."),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  allocationMethod: z.enum(ALLOCATION_METHODS),
  allocationBasis: z.enum(["entries", "units"]).default("entries"),
  estimatedVolume: z.string().regex(/^\d{1,12}(\.\d{1,6})?$/).refine(v => Number(v) > 0).nullable().default(null),
  estimatedImportValue: moneyString.refine(v => Number(v) > 0).nullable().default(null),
  skuPattern: z.string().trim().max(100).regex(/^[^*]*\*?$/, "Only an optional trailing * is supported.").nullable().default(null),
  suppliers: z.array(z.object({ partyId: z.string().min(1), role: z.enum(["SUPPLIER", "MANUFACTURER"]) }).strict()).max(100).default([]),
  hts: z.array(z.string().regex(/^(\d{4}|\d{6}|\d{8}|\d{10})$/, "Use a 4, 6, 8, or 10 digit HTS prefix.")).max(100).default([]),
  effectiveFrom: z.iso.datetime({ offset: true }),
  effectiveTo: z.iso.datetime({ offset: true }).nullable().default(null),
}).strict().refine(v => !v.effectiveTo || v.effectiveTo >= v.effectiveFrom, "End date must follow start date.");
export const assistPatchSchema = z.object({
  version: z.number().int().nonnegative(),
  action: z.enum(["edit", "activate", "suspend", "reactivate"]),
  input: assistInputSchema.optional(),
}).strict();
export const assistDecisionSchema = z.object({
  filingId: z.string().min(1),
  basisHash: z.string().length(64),
  assistVersion: z.number().int().nonnegative(),
  amount: moneyString.optional(),
  overrideReasonCode: z.enum(OVERRIDE_REASONS).optional(),
}).strict();
export type AssistInput = z.infer<typeof assistInputSchema>;
export type AssistPatch = z.infer<typeof assistPatchSchema>;
