export default function PortalShipmentsLoading() {
  return (
    <div className="space-y-6 p-6 animate-pulse" aria-busy="true" aria-label="Loading Portal Shipments">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 bg-slate-200 rounded-lg mb-2" />
          <div className="h-4 w-72 bg-slate-100 rounded-md" />
        </div>
      </div>
      <div className="h-80 bg-white border border-[#E5E5EA] rounded-2xl p-6 shadow-2xs">
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-slate-50 rounded-lg flex items-center justify-between px-4">
              <div className="h-4 w-40 bg-slate-200 rounded" />
              <div className="h-4 w-28 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
