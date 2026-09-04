// Shared filter/where-builder for the Audit, Service Usage & Compliance
// History surface. Used by BOTH the execution-search API and the
// service-usage summary API so their numbers always reconcile for the same
// filter set -- summary must never compute its own, slightly different,
// where clause.
import { z } from "zod";
import type { Prisma, ComplianceExecutionType, ComplianceExecutionStatus, ComplianceExecutionSource } from "@prisma/client";

export const executionFilterSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  executionType: z.string().optional(),
  status: z.string().optional(),
  shipmentId: z.string().optional(),
  partyId: z.string().optional(),
  productId: z.string().optional(),
  initiatedByUserId: z.string().optional(),
  source: z.string().optional(),
  countryChecked: z.string().optional(),
  correlationId: z.string().optional(),
  /** "true" | "false" -- has at least one linked ComplianceScreeningFinding with status RESOLVED. Domains with no linked findings (RPS/embargo/classification) are never "reviewed" under this definition. */
  reviewed: z.enum(["true", "false"]).optional(),
  /** "true" | "false" -- has at least one ComplianceFormalOverride pointing at this execution. */
  overridden: z.enum(["true", "false"]).optional(),
});

export type ExecutionFilterInput = z.infer<typeof executionFilterSchema>;

export const executionSearchSchema = executionFilterSchema.extend({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(25),
  sortBy: z.enum(["startedAt", "completedAt", "durationMs", "status", "executionType"]).optional().default("startedAt"),
  sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type ExecutionSearchInput = z.infer<typeof executionSearchSchema>;

/**
 * Builds a tenant-scoped Prisma where clause. accountId is ALWAYS taken from
 * the caller (the authenticated session's ctx.accountId) -- never from the
 * filter payload -- so a request can never read another account's rows.
 */
export function buildExecutionWhere(
  accountId: string,
  filters: ExecutionFilterInput
): Prisma.ComplianceExecutionWhereInput {
  const where: Prisma.ComplianceExecutionWhereInput = { accountId };

  if (filters.dateFrom || filters.dateTo) {
    where.startedAt = {
      ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
    };
  }
  if (filters.executionType) where.executionType = filters.executionType as ComplianceExecutionType;
  if (filters.status) where.status = filters.status as ComplianceExecutionStatus;
  if (filters.shipmentId) where.shipmentId = filters.shipmentId;
  if (filters.partyId) where.partyId = filters.partyId;
  if (filters.productId) where.productId = filters.productId;
  if (filters.initiatedByUserId) where.initiatedByUserId = filters.initiatedByUserId;
  if (filters.source) where.source = filters.source as ComplianceExecutionSource;
  if (filters.countryChecked) where.countryChecked = filters.countryChecked;
  if (filters.correlationId) where.correlationId = filters.correlationId;

  if (filters.reviewed === "true") {
    where.screeningFindings = { some: { status: "RESOLVED" } };
  } else if (filters.reviewed === "false") {
    where.screeningFindings = { none: { status: "RESOLVED" } };
  }

  if (filters.overridden === "true") {
    where.overrides = { some: {} };
  } else if (filters.overridden === "false") {
    where.overrides = { none: {} };
  }

  return where;
}
