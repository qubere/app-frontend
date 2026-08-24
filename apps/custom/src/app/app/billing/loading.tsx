export default function BillingLoading() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading billing workspace">
      <div className="h-8 w-72 animate-pulse rounded-lg bg-slate-200" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-slate-100 border border-slate-200" />)}
      </div>
      <div className="h-80 animate-pulse rounded-2xl bg-slate-100 border border-slate-200" />
      <span className="sr-only">Loading billing data…</span>
    </div>
  );
}
