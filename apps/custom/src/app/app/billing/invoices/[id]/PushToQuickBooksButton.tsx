"use client";

import { useState, useTransition } from "react";
import { pushInvoiceToQuickBooksAction } from "./actions";

interface PushResult {
  success: boolean;
  providerId: string;
  docNumber: string;
  deepLink: string;
  reused: boolean;
  totalsReconcile: boolean;
}

export function PushToQuickBooksButton({
  invoiceId,
  pushable,
}: {
  invoiceId: string;
  pushable: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<PushResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const res = (await pushInvoiceToQuickBooksAction(invoiceId)) as PushResult;
        setResult(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to push to QuickBooks");
      }
    });
  };

  if (result) {
    return (
      <a
        href={result.deepLink}
        target="_blank"
        rel="noopener noreferrer"
        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
        title={
          result.reused
            ? "Already synced — opens the existing QuickBooks invoice"
            : result.totalsReconcile
              ? "Synced to QuickBooks"
              : "Synced, but line totals did not reconcile — review in QuickBooks"
        }
      >
        {result.reused ? "View in QuickBooks" : "Synced ✓ — View in QuickBooks"}
      </a>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={!pushable || isPending}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#2CA01C] text-white hover:bg-[#268a18] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title={pushable ? undefined : "Approve or send this invoice before pushing to QuickBooks"}
      >
        {isPending ? "Pushing…" : "Push to QuickBooks"}
      </button>
      {error && <span className="text-[11px] text-rose-600 max-w-xs text-right">{error}</span>}
    </div>
  );
}
