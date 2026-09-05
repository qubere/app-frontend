import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { evaluateReasonableCare } from "@/modules/compliance/reasonableCare";

export const GET = withAuthenticatedRoute(async ({ ctx }) => {
  const [filings, findings, suppliers, brokers, shipments] = await Promise.all([
    db.customsFiling.findMany({ where: { accountId: ctx.accountId } }),
    db.complianceFinding.findMany({ where: { accountId: ctx.accountId } }),
    db.supplierRiskScore.findMany({ where: { accountId: ctx.accountId } }),
    db.brokerMetrics.findMany({ where: { accountId: ctx.accountId } }),
    db.shipment.findMany({
      where: { accountId: ctx.accountId },
      include: { lineItems: true, documents: true },
    }),
  ]);

  const openFindings = findings.filter((f) => f.status === "Open" || f.status === "Investigating");
  const criticalFindings = openFindings.filter((f) => f.severity === "Critical" || f.severity === "High");

  const totalSuppliers = suppliers.length || 1;
  const avgSupplierRisk = Math.round(suppliers.reduce((acc, s) => acc + Number(s.score), 0) / totalSuppliers);
  // Null (not a fabricated figure) when no broker has ever been measured --
  // callers must render an explicit "no data yet" state instead of a fake accuracy.
  const avgBrokerAccuracy =
    brokers.length > 0
      ? parseFloat((brokers.reduce((acc, b) => acc + Number(b.accuracyPct), 0) / brokers.length).toFixed(1))
      : null;

  let overallReasonableCareScore = 100;
  if (shipments.length > 0) {
    // One grouped query for every shipment's recordkeeping-trail count instead
    // of a COUNT per shipment in a loop.
    const auditCounts = await db.auditLog.groupBy({
      by: ["entityId"],
      where: { accountId: ctx.accountId, entityId: { in: shipments.map((s) => s.id) } },
      _count: { _all: true },
    });
    const auditCountByEntity = new Map(auditCounts.map((r) => [r.entityId, r._count._all]));

    let totalScore = 0;
    for (const s of shipments) {
      const totalVal = s.lineItems.reduce((sum, item) => sum + Number(item.totalValue), 0);
      const evalResult = evaluateReasonableCare({
        lineItems: s.lineItems.map((l) => ({ htsCode: l.htsCode, countryOfOrigin: l.countryOfOrigin })),
        documents: s.documents.map((d) => ({ status: d.status })),
        totalValue: totalVal > 0 ? totalVal : null,
        auditLogCount: auditCountByEntity.get(s.id) ?? 0,
      });
      totalScore += Math.max(0, 100 - evalResult.riskScore);
    }
    overallReasonableCareScore = Math.round(totalScore / shipments.length);
  }

  const careGrade = overallReasonableCareScore >= 90 ? "Excellent" : overallReasonableCareScore >= 75 ? "Acceptable" : overallReasonableCareScore >= 60 ? "Needs Improvement" : "High Risk";

  return NextResponse.json({
    dashboard: {
      entriesMonitored: filings.length,
      openFindingsCount: openFindings.length,
      criticalFindingsCount: criticalFindings.length,
      avgSupplierRiskScore: avgSupplierRisk,
      avgBrokerAccuracyPct: avgBrokerAccuracy,
      reasonableCareScore: overallReasonableCareScore,
      reasonableCareGrade: careGrade,
      recentAlerts: openFindings.slice(0, 5),
    },
  });
});
