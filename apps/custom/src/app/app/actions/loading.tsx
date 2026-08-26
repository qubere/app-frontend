export default function ActionsLoading() {
  return (
    <div className="space-y-5 max-w-[1600px] mx-auto pb-12" role="status" aria-label="Loading actions">
      {/* Header toolbar skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-border shadow-2xs">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-100 animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-5 w-24 rounded bg-slate-200 animate-pulse" />
            <div className="h-3 w-40 rounded bg-slate-100 animate-pulse" />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="h-9 w-48 rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-9 w-40 rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-9 w-32 rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-9 w-32 rounded-xl bg-slate-100 animate-pulse" />
        </div>
      </div>

      {/* Shipment group cards skeleton */}
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="h-40 animate-pulse rounded-2xl bg-slate-100 border border-slate-200" />
      ))}

      <span className="sr-only">Loading actions…</span>
    </div>
  );
}
