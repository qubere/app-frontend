export default function TmsTendersLoading() {
  return (
    <div className="space-y-6 p-6 animate-pulse" aria-busy="true" aria-label="Loading Tenders">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-44 bg-slate-200 rounded-lg mb-2" />
          <div className="h-4 w-64 bg-slate-100 rounded-md" />
        </div>
      </div>
      <div className="h-72 bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs">
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-slate-50 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
