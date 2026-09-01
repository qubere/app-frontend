import crypto from "crypto";
import { db } from "@/lib/db";
import type { AuditCheckResult } from "@/modules/agents/complianceAuditAgent";
import { recordComplianceExecution, linkScreeningFinding } from "./executionHistory";
import type { ComplianceExecutionType } from "@prisma/client";

/**
 * The six screening categories the Compliance workspace organizes findings
 * by. Restricted Party / Party Red Flag are deliberately absent -- those
 * already persist to RestrictedPartyScreeningResult/Match and are read from
 * there, never duplicated into this generic table.
 */
export type ScreeningBucket =
  | "COUNTRY_EMBARGO"
  | "PRIVATE_EMBARGO"
  | "UFLPA"
  | "END_USE_RESTRICTION"
  | "END_USER_RESTRICTION"
  | "ANTI_BOYCOTT"
  | "MILITARY_END_USE"
  | "MILITARY_END_USER";

const DIRECT_CATEGORY_MAP: Partial<Record<AuditCheckResult["category"], ScreeningBucket>> = {
  COUNTRY_EMBARGO: "COUNTRY_EMBARGO",
  PRIVATE_EMBARGO: "PRIVATE_EMBARGO",
  UFLPA: "UFLPA",
  END_USE_RESTRICTION: "END_USE_RESTRICTION",
  END_USER_RESTRICTION: "END_USER_RESTRICTION",
  ANTI_BOYCOTT: "ANTI_BOYCOTT",
  MILITARY_END_USE: "MILITARY_END_USE",
  MILITARY_END_USER: "MILITARY_END_USER",
};

/** SCREENING_GAP rows carry no category of their own -- infer one from the rule name so a gap still surfaces under the right sub-tab, not as an untraceable orphan. */
function bucketFromGapRuleName(ruleName: string): ScreeningBucket | null {
  const name = ruleName.toLowerCase();
  if (name.includes("restricted party") || name.includes("party red flag")) return null;
  if (name.includes("country embargo")) return "COUNTRY_EMBARGO";
  if (name.includes("uflpa") || name.includes("forced labor")) return "UFLPA";
  if (name.includes("end-user") || name.includes("end user")) return "END_USER_RESTRICTION";
  if (name.includes("end-use") || name.includes("end use")) return "END_USE_RESTRICTION";
  if (name.includes("anti-boycott") || name.includes("boycott")) return "ANTI_BOYCOTT";
  if (name.includes("military end-user") || name.includes("military end user")) return "MILITARY_END_USER";
  if (name.includes("military")) return "MILITARY_END_USE";
  return null;
}

function resolveBucket(result: AuditCheckResult): ScreeningBucket | null {
  const direct = DIRECT_CATEGORY_MAP[result.category];
  if (direct) return direct;
  if (result.category === "SCREENING_GAP") return bucketFromGapRuleName(result.ruleName);
  return null;
}

/**
 * Persists one ComplianceScreeningFinding row per failing AuditCheckResult
 * that belongs to one of the six Screening workspace categories. Passing
 * checks and non-screening categories (PGA, ADD/CVD, Valuation, HTS
 * Integrity, Data Missing) are not this table's concern.
 *
 * The Compliance Audit Agent step re-runs on every pipeline invocation
 * (upload, field edit, reconcile, retry), and an unresolved finding --
 * e.g. a still-missing embargo screening on the same line -- fails the exact
 * same check on every re-run. Idempotent by (accountId, shipmentId,
 * lineNumber, category, ruleId) among still-OPEN findings: a re-run that
 * turns up the same open finding reuses the existing row instead of piling
 * another one into the unfiltered Screening workspace list.
 *
 * Additive step: for each of the five "thin-finding" domains (prompt §2)
 * represented among the newly-created rows -- forced labor/UFLPA, end-use,
 * end-user, military end-use/end-user, anti-boycott -- also records one
 * ComplianceExecution envelope covering the whole screening invocation for
 * that domain on this shipment, then links every finding row of that
 * category back to it. Country Embargo / Private Embargo are deliberately
 * excluded here -- those already get their own ComplianceExecution row from
 * embargoAudit's caller (countryEmbargoScreening.ts), so recording them
 * again here would double-count the same invocation under two envelopes.
 * This bookkeeping never affects which findings get written or their
 * content -- it's best-effort and layered on top.
 */
const THIN_FINDING_EXECUTION_TYPE: Partial<Record<ScreeningBucket, ComplianceExecutionType>> = {
  UFLPA: "FORCED_LABOR_SCREENING",
  END_USE_RESTRICTION: "END_USE_SCREENING",
  END_USER_RESTRICTION: "END_USER_SCREENING",
  MILITARY_END_USE: "MILITARY_END_USE_SCREENING",
  MILITARY_END_USER: "MILITARY_END_USE_SCREENING",
  ANTI_BOYCOTT: "ANTI_BOYCOTT_SCREENING",
};

export async function persistComplianceScreeningFindings(
  accountId: string,
  shipmentId: string,
  auditResults: AuditCheckResult[]
): Promise<void> {
  const candidates = auditResults
    .filter((r) => !r.passed)
    .map((r) => {
      const category = resolveBucket(r);
      if (!category) return null;
      return { result: r, category };
    })
    .filter((r): r is { result: AuditCheckResult; category: ScreeningBucket } => r !== null);

  if (candidates.length === 0) return;

  // The pipeline re-runs this on every invocation (upload, edit, reconcile,
  // retry), and concurrent invocations for the same shipment (e.g. several
  // documents uploaded together) each read openFindings before any of them
  // commits its insert -- without serialization every one of them sees "no
  // existing row" and inserts its own, producing N duplicate OPEN findings
  // for the same (shipmentId, lineNumber, category, ruleId). Hold a
  // transaction-scoped Postgres advisory lock keyed on shipmentId so
  // concurrent calls for the same shipment run this read-then-write section
  // one at a time. Lock key namespace 0 is reserved for this dedup lock --
  // any future unrelated pg_advisory_xact_lock use in this codebase must
  // pick a different namespace to avoid colliding with it.
  const createdRows = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(0, hashtext(${shipmentId}))`;

    const openFindings = await tx.complianceScreeningFinding.findMany({
      where: { accountId, shipmentId, status: "OPEN" },
      select: { lineNumber: true, category: true, ruleId: true },
    });
    const openKey = (r: { lineNumber: number | null; category: string; ruleId: string }) =>
      `${r.lineNumber ?? "null"}::${r.category}::${r.ruleId}`;
    const openKeys = new Set(openFindings.map(openKey));

    const newCandidates = candidates.filter(
      ({ result: r, category }) =>
        !openKeys.has(openKey({ lineNumber: r.lineNumber ?? null, category, ruleId: r.ruleId }))
    );
    if (newCandidates.length === 0) return { rows: [], newCandidates };

    const createData = newCandidates.map(({ result: r, category }) => ({
      accountId,
      shipmentId,
      lineNumber: r.lineNumber ?? null,
      category,
      ruleId: r.ruleId,
      ruleName: r.ruleName,
      severity: r.severity,
      details: r.details,
    }));

    let rows: ({ id: string } | undefined)[];
    try {
      rows = await tx.complianceScreeningFinding.createManyAndReturn({ data: createData });
    } catch (err) {
      // Only fall back for createManyAndReturn's own "not supported on this
      // connector" failure (Prisma 5.13 and earlier) -- a real data error
      // (e.g. a constraint violation) must surface as-is instead of being
      // silently retried and re-thrown under a different, less specific error.
      if (!(err instanceof Error) || !err.message.includes("createManyAndReturn")) throw err;

      await tx.complianceScreeningFinding.createMany({ data: createData });
      // createMany doesn't return ids -- look the just-inserted rows back up
      // by their dedup key so execution-linking below still runs instead of
      // silently never firing on connectors without createManyAndReturn.
      const inserted = await tx.complianceScreeningFinding.findMany({
        where: {
          accountId,
          shipmentId,
          status: "OPEN",
          OR: newCandidates.map(({ result: r, category }) => ({
            lineNumber: r.lineNumber ?? null,
            category,
            ruleId: r.ruleId,
          })),
        },
        select: { id: true, lineNumber: true, category: true, ruleId: true },
      });
      const byKey = new Map(inserted.map((row) => [openKey(row), row]));
      // Keep this aligned index-for-index with newCandidates (even if a
      // lookup somehow misses) -- the forEach below pairs createdRowsList[i]
      // with newCandidates[i] by position, so filtering here would shift
      // every later row's category attribution.
      rows = newCandidates.map(({ result: r, category }) =>
        byKey.get(openKey({ lineNumber: r.lineNumber ?? null, category, ruleId: r.ruleId }))
      );
    }
    return { rows, newCandidates };
  });

  const { rows: createdRowsList, newCandidates } = createdRows;
  if (newCandidates.length === 0) return;

  // Group the created finding ids by category so exactly one
  // ComplianceExecution is recorded per thin-finding domain present in this
  // batch (not one per finding row).
  const idsByCategory = new Map<ScreeningBucket, string[]>();
  createdRowsList.forEach((row, i) => {
    const category = newCandidates[i]?.category;
    if (!category || !row) return;
    const list = idsByCategory.get(category) ?? [];
    list.push(row.id);
    idsByCategory.set(category, list);
  });

  for (const [category, findingIds] of idsByCategory) {
    const executionType = THIN_FINDING_EXECUTION_TYPE[category];
    if (!executionType) continue; // COUNTRY_EMBARGO / PRIVATE_EMBARGO -- recorded elsewhere.

    const executionId = await recordComplianceExecution({
      accountId,
      executionType,
      status: "COMPLETED",
      correlationId: crypto.randomUUID(),
      shipmentId,
      source: "SHIPMENT_PIPELINE",
      finalStatus: "FINDINGS_RECORDED",
      finalSummary: `${findingIds.length} finding(s) recorded for ${category}.`,
      resultRefType: "ComplianceScreeningFinding",
    });
    if (!executionId) continue;

    await Promise.all(findingIds.map((id) => linkScreeningFinding(id, executionId)));
  }
}
