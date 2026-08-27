export default function ComplianceLoading() {
  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-100" />
        <div className="space-y-2">
          <div className="h-6 w-48 bg-slate-200 rounded" />
          <div className="h-4 w-72 bg-slate-100 rounded" />
        </div>
      </div>

      <div className="flex space-x-2 pt-2 border-t border-slate-200">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 w-28 bg-slate-200 rounded-xl" />
        ))}
      </div>

      <div className="h-80 bg-white border border-slate-200 rounded-2xl p-6">
        <div className="h-6 w-36 bg-slate-200 rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-slate-50 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
