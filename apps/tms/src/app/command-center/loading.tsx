export default function TmsCommandCenterLoading() {
  return (
    <div className="space-y-6 max-w-[1400px] mx-auto p-6 animate-pulse" aria-busy="true" aria-label="Loading TMS Command Center">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-56 bg-slate-200 rounded-lg mb-2" />
          <div className="h-4 w-80 bg-slate-100 rounded-md" />
        </div>
        <div className="h-10 w-36 bg-slate-200 rounded-xl" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
            <div className="h-4 w-28 bg-slate-200 rounded" />
            <div className="h-8 w-20 bg-slate-300 rounded" />
          </div>
        ))}
      </div>

      <div className="h-96 bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs">
        <div className="h-6 w-44 bg-slate-200 rounded mb-6" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 bg-slate-50 rounded-xl flex items-center justify-between px-4">
              <div className="h-4 w-48 bg-slate-200 rounded" />
              <div className="h-4 w-24 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
