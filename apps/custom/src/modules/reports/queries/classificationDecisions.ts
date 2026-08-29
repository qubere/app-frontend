import { db } from "@/lib/db";
import { parseDateRange, stringFilter, type ReportRowsResult } from "../queryHelpers";

/** Classification Decisions report -- sourced from ClassificationDecision, scoped via its parent ClassificationCase.accountId. */
export async function queryClassificationDecisions(
  accountId: string,
  filters: Record<string, unknown>,
  limit: number
): Promise<ReportRowsResult> {
  const dateRange = parseDateRange(filters);
  const decisionStatus = stringFilter(filters, "decisionStatus");
  const caseId = stringFilter(filters, "caseId");

  const where = {
    case: { accountId },
    ...(Object.keys(dateRange).length ? { attestedAt: dateRange } : {}),
    ...(decisionStatus ? { decisionStatus } : {}),
    ...(caseId ? { caseId } : {}),
  };

  const [totalCount, decisions] = await Promise.all([
    db.classificationDecision.count({ where }),
    db.classificationDecision.findMany({
      where,
      include: {
        case: { select: { id: true, externalReference: true } },
        approvedNode: { select: { htsNumberDisplay: true, description: true } },
      },
      orderBy: { attestedAt: "desc" },
      take: Math.min(limit, 50_000),
    }),
  ]);

  const rows = decisions.map((d) => ({
    date: d.attestedAt.toISOString(),
    case: d.case.externalReference ?? d.case.id,
    htsCode: d.approvedNode.htsNumberDisplay,
    description: d.approvedNode.description,
    decisionStatus: d.decisionStatus,
    reviewer: d.reviewerUserId,
    rationale: d.rationale,
    overrideReason: d.overrideReason ?? "",
    effectiveFrom: d.effectiveFrom.toISOString(),
    correlationId: d.id,
  }));

  return { rows, totalCount };
}
