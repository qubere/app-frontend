"use client";

import { useEffect } from "react";

export default function BillingError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("Billing workspace render failed", error);
  }, [error]);

  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900" role="alert">
      <h2 className="text-base font-bold">Billing data could not be loaded</h2>
      <p className="mt-1 text-sm">No financial data was changed. Retry the request, or contact support with reference {error.digest ?? "unavailable"}.</p>
      <button onClick={() => retry()} className="mt-4 rounded-lg bg-rose-700 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-800">
        Try again
      </button>
    </div>
  );
}
