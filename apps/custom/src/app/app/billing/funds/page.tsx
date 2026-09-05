import React from "react";
import { getAccountContext, hasPermission } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listDisbursementAccounts, calculateDaysOfCoverAndExposure } from "@/modules/billing/funds/accountService";
import { Wallet, ShieldAlert, ArrowUpRight, AlertTriangle } from "lucide-react";
import { ClientFundsTable } from "./ClientFundsTable";

export default async function ClientFundsPage() {
  const ctx = await getAccountContext();
  if (!ctx) redirect("/sign-in");

  const canView = (await hasPermission("billing.funds.view")) || (await hasPermission("billing.view"));
  if (!canView) redirect("/app/billing");

  const canManage = await hasPermission("billing.funds.manage");

  const accounts = await listDisbursementAccounts(ctx.accountId);

  // Compute metrics for each account
  const accountsWithMetrics = await Promise.all(
    accounts.map(async (acc) => {
      const metrics = await calculateDaysOfCoverAndExposure(ctx.accountId, acc.id);
      return {
        ...acc,
        metrics,
      };
    })
  );

  const totalBalance = accountsWithMetrics.reduce((sum, a) => sum + a.metrics.currentBalance, 0);
  const totalExposure = accountsWithMetrics.reduce((sum, a) => sum + a.metrics.openExposure, 0);
  const belowMinCount = accountsWithMetrics.filter((a) => a.metrics.currentBalance < a.metrics.minimumBalance).length;
  const negativeCount = accountsWithMetrics.filter((a) => a.metrics.currentBalance < 0).length;

  return (
    <div className="space-y-6">
      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-white shadow-sm space-y-1">
          <div className="flex items-center justify-between text-ink-muted text-xs font-medium">
            <span>Total Trust Balance</span>
            <Wallet className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-ink">${totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="text-[11px] text-ink-muted">{accountsWithMetrics.length} active client accounts</p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-white shadow-sm space-y-1">
          <div className="flex items-center justify-between text-ink-muted text-xs font-medium">
            <span>Open Duty Exposure</span>
            <ArrowUpRight className="h-4 w-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-ink">${totalExposure.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="text-[11px] text-ink-muted">Fronted to CBP, unrecovered</p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-white shadow-sm space-y-1">
          <div className="flex items-center justify-between text-ink-muted text-xs font-medium">
            <span>Below Minimum</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600">{belowMinCount}</p>
          <p className="text-[11px] text-ink-muted">Accounts requiring top-up</p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-white shadow-sm space-y-1">
          <div className="flex items-center justify-between text-ink-muted text-xs font-medium">
            <span>Negative Balances</span>
            <ShieldAlert className="h-4 w-4 text-rose-600" />
          </div>
          <p className="text-2xl font-bold text-rose-600">{negativeCount}</p>
          <p className="text-[11px] text-ink-muted">Broker capital at risk</p>
        </div>
      </div>

      {/* Main Account Ledger Table */}
      <ClientFundsTable accounts={accountsWithMetrics} canManage={canManage} />
    </div>
  );
}
