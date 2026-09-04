// Private Embargo Screening -- tenant-scoped rule management (CRUD +
// conflict detection). Distinct from embargoRepository.ts, which is
// read-only reference-data access consumed by the matcher chain at
// screening time; this file backs the account-admin rule-management API.
import { db } from "@/lib/db";
import type { PrivateEmbargoRule } from "@prisma/client";

export interface PrivateEmbargoRuleInput {
  fromCountryCode: string | null;
  appliesToAllFromCountries: boolean;
  toCountryCode: string;
  embargoed: boolean;
  effectiveDate: Date;
  expirationDate: Date | null;
  reason: string | null;
  reference: string | null;
}

/**
 * Finds an existing ACTIVE rule for the same account/destination/from-scope
 * whose effective/expiration window overlaps the candidate window. Two
 * date ranges [aStart, aEnd] / [bStart, bEnd] (null end = open-ended) overlap
 * when aStart <= bEnd (or bEnd is null) AND bStart <= aEnd (or aEnd is null).
 * Used to reject ambiguous overlapping rules at create/update time (section
 * 11 -- duplicate/overlapping rule protection) rather than via an unsafe
 * unique constraint that would ignore date semantics.
 */
export async function findOverlappingActivePrivateEmbargoRule(
  accountId: string,
  input: PrivateEmbargoRuleInput,
  excludeRuleId?: string
): Promise<PrivateEmbargoRule | null> {
  const candidates = await db.privateEmbargoRule.findMany({
    where: {
      accountId,
      status: "ACTIVE",
      toCountryCode: { equals: input.toCountryCode, mode: "insensitive" },
      appliesToAllFromCountries: input.appliesToAllFromCountries,
      ...(input.appliesToAllFromCountries
        ? {}
        : { fromCountryCode: { equals: input.fromCountryCode ?? undefined, mode: "insensitive" } }),
      ...(excludeRuleId ? { id: { not: excludeRuleId } } : {}),
    },
  });

  return (
    candidates.find((existing) => {
      const existingStart = existing.effectiveDate;
      const existingEnd = existing.expirationDate;
      const candidateStart = input.effectiveDate;
      const candidateEnd = input.expirationDate;

      const startsBeforeExistingEnds = existingEnd === null || candidateStart <= existingEnd;
      const existingStartsBeforeCandidateEnds = candidateEnd === null || existingStart <= candidateEnd;

      return startsBeforeExistingEnds && existingStartsBeforeCandidateEnds;
    }) ?? null
  );
}

export function listPrivateEmbargoRules(accountId: string): Promise<PrivateEmbargoRule[]> {
  return db.privateEmbargoRule.findMany({
    where: { accountId },
    orderBy: [{ status: "asc" }, { toCountryCode: "asc" }, { createdAt: "desc" }],
  });
}

export function createPrivateEmbargoRule(
  accountId: string,
  userId: string,
  input: PrivateEmbargoRuleInput
): Promise<PrivateEmbargoRule> {
  return db.privateEmbargoRule.create({
    data: {
      accountId,
      fromCountryCode: input.appliesToAllFromCountries ? null : input.fromCountryCode,
      appliesToAllFromCountries: input.appliesToAllFromCountries,
      toCountryCode: input.toCountryCode.toUpperCase(),
      embargoed: input.embargoed,
      effectiveDate: input.effectiveDate,
      expirationDate: input.expirationDate,
      reason: input.reason,
      reference: input.reference,
      createdByUserId: userId,
      updatedByUserId: userId,
    },
  });
}

export function updatePrivateEmbargoRule(
  ruleId: string,
  accountId: string,
  userId: string,
  input: PrivateEmbargoRuleInput
): Promise<PrivateEmbargoRule> {
  return db.privateEmbargoRule.update({
    where: { id: ruleId, accountId },
    data: {
      fromCountryCode: input.appliesToAllFromCountries ? null : input.fromCountryCode,
      appliesToAllFromCountries: input.appliesToAllFromCountries,
      toCountryCode: input.toCountryCode.toUpperCase(),
      embargoed: input.embargoed,
      effectiveDate: input.effectiveDate,
      expirationDate: input.expirationDate,
      reason: input.reason,
      reference: input.reference,
      updatedByUserId: userId,
    },
  });
}

/** Soft-disable only -- historical configuration is retained for audit (section 31), never physically erased. */
export function disablePrivateEmbargoRule(ruleId: string, accountId: string, userId: string): Promise<PrivateEmbargoRule> {
  return db.privateEmbargoRule.update({
    where: { id: ruleId, accountId },
    data: { status: "DISABLED", updatedByUserId: userId },
  });
}
