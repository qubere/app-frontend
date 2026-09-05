import React from "react";
import Link from "next/link";
import { getAccountContext, hasPermission } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getDisbursementAccount, calculateDaysOfCoverAndExposure } from "@/modules/billing/funds/accountService";
import { getAccountLedger } from "@/modules/billing/funds/ledgerService";
import { db as prisma } from "@qubere/db";
import { AccountDetailTabs } from "./AccountDetailTabs";
import { ArrowLeft } from "lucide-react";

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAccountContext();
  if (!ctx) redirect("/sign-in");

  const canView = (await hasPermission("billing.funds.view")) || (await hasPermission("billing.view"));
  if (!canView) redirect("/app/billing");

  const { id } = await params;

  let account;
  try {
    account = await getDisbursementAccount(ctx.accountId, id);
  } catch {
    redirect("/app/billing/funds");
  }

  const metrics = await calculateDaysOfCoverAndExposure(ctx.accountId, id);
  const { entries: ledgerEntries } = await getAccountLedger(ctx.accountId, id, { limit: 100 });

  const disbursements = await prisma.dutyDisbursement.findMany({
    where: { disbursementAccountId: id },
    include: { feeLines: true },
    orderBy: { createdAt: "desc" },
  });

  const replenishments = await prisma.replenishmentRequest.findMany({
    where: { disbursementAccountId: id },
    orderBy: { createdAt: "desc" },
  });

  const reconciliations = await prisma.statementReconciliation.findMany({
    where: { accountId: ctx.accountId },
    include: { statementRecord: true, lines: true },
    orderBy: { startedAt: "desc" },
  });

  const permissions = {
    canDeposit: await hasPermission("billing.funds.deposit"),
    canRefund: await hasPermission("billing.funds.refund"),
    canAdjust: await hasPermission("billing.funds.adjust"),
    canDisburse: await hasPermission("billing.funds.disburse"),
    canReconcile: await hasPermission("billing.funds.reconcile"),
    canManage: await hasPermission("billing.funds.manage"),
  };

  return (
    <div className="space-y-6">
      {/* Header breadcrumb & info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/app/billing/funds" className="p-1.5 rounded-lg border border-border bg-white text-ink-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-ink">{account.client.name}</h1>
            <p className="text-xs text-ink-muted">
              Duty Disbursement Account {account.importer ? `(Importer: ${account.importer.name})` : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-white space-y-1">
          <span className="text-xs font-semibold text-ink-muted">Current Balance</span>
          <p className={`text-2xl font-mono font-bold ${Number(account.currentBalance) < 0 ? "text-rose-600" : "text-ink"}`}>
            ${Number(account.currentBalance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-white space-y-1">
          <span className="text-xs font-semibold text-ink-muted">Min / Target Threshold</span>
          <p className="text-2xl font-mono font-bold text-ink">
            ${Number(account.minimumBalance).toLocaleString("en-US")} / ${Number(account.targetBalance).toLocaleString("en-US")}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-white space-y-1">
          <span className="text-xs font-semibold text-ink-muted">Days of Cover</span>
          <p className="text-2xl font-mono font-bold text-ink">
            {metrics.daysOfCover >= 999 ? "∞" : `${metrics.daysOfCover} days`}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-white space-y-1">
          <span className="text-xs font-semibold text-ink-muted">Open Exposure</span>
          <p className="text-2xl font-mono font-bold text-blue-700">
            ${metrics.openExposure.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Interactive Tabs Component */}
      <AccountDetailTabs
        account={{
          id: account.id,
          currentBalance: Number(account.currentBalance),
          minimumBalance: Number(account.minimumBalance),
          targetBalance: Number(account.targetBalance),
          currency: account.currency,
        }}
        ledgerEntries={ledgerEntries.map((e: any) => ({
          id: e.id,
          type: e.type,
          description: e.description,
          amount: Number(e.amount),
          runningBalance: Number(e.runningBalance),
          effectiveAt: e.effectiveAt.toISOString(),
          currency: e.currency,
        }))}
        disbursements={disbursements.map((d: any) => ({
          id: d.id,
          entryNumber: d.entryNumber,
          status: d.status,
          estimatedAmount: Number(d.estimatedAmount),
          actualAmount: d.actualAmount ? Number(d.actualAmount) : null,
          paidAt: d.paidAt ? d.paidAt.toISOString() : null,
          varianceAmount: d.varianceAmount ? Number(d.varianceAmount) : null,
        }))}
        replenishments={replenishments.map((r: any) => ({
          id: r.id,
          amount: Number(r.amount),
          state: r.state,
          dueDate: r.dueDate ? r.dueDate.toISOString() : null,
          requestedAt: r.requestedAt.toISOString(),
        }))}
        reconciliations={reconciliations.map((rec: any) => ({
          id: rec.id,
          statementNumber: rec.statementRecord.statementNumber,
          status: rec.status,
          matchedCount: rec.matchedCount,
          varianceCount: rec.varianceCount,
          totalVarianceAmount: Number(rec.totalVarianceAmount),
          lines: rec.lines.map((l: any) => ({
            id: l.id,
            accountingClassCode: l.accountingClassCode,
            statementAmount: l.statementAmount ? Number(l.statementAmount) : 0,
            qubereAmount: l.qubereAmount ? Number(l.qubereAmount) : 0,
            varianceAmount: l.varianceAmount ? Number(l.varianceAmount) : 0,
            matchStatus: l.matchStatus,
            resolution: l.resolution,
          })),
        }))}
        permissions={permissions}
      />
    </div>
  );
}
