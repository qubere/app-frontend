"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";

export function AddTransportLegButton({ shipmentId }: { shipmentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addLeg = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/legs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legType: fd.get("legType"),
          mode: fd.get("mode"),
          destinationName: fd.get("destinationName"),
          destinationUnlocode: fd.get("destinationUnlocode") || undefined,
          carrierName: fd.get("carrierName") || undefined,
          vesselName: fd.get("vesselName") || undefined,
          billOfLadingNumber: fd.get("billOfLadingNumber") || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Request failed (${res.status})`);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" /> Add leg
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 text-left font-sans">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900">Add transport leg</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <form onSubmit={addLeg} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Leg Type</label>
                <select name="legType" defaultValue="MAIN_CARRIAGE" className="w-full rounded-xl border border-slate-200 p-2 text-xs font-medium">
                  <option value="PRE_CARRIAGE">Pre-carriage</option>
                  <option value="MAIN_CARRIAGE">Main carriage</option>
                  <option value="ON_CARRIAGE">On-carriage</option>
                  <option value="TRANSSHIPMENT">Transshipment</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Transport Mode</label>
                <select name="mode" defaultValue="OCEAN" className="w-full rounded-xl border border-slate-200 p-2 text-xs font-medium">
                  <option value="OCEAN">Ocean</option>
                  <option value="AIR">Air</option>
                  <option value="TRUCK">Truck</option>
                  <option value="RAIL">Rail</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Destination Name *</label>
                <input
                  name="destinationName"
                  required
                  placeholder="e.g. Port of Los Angeles"
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">UN/LOCODE</label>
                  <input name="destinationUnlocode" placeholder="e.g. USLAX" className="w-full rounded-xl border border-slate-200 p-2 text-xs font-medium" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Carrier Name</label>
                  <input name="carrierName" placeholder="e.g. Maersk" className="w-full rounded-xl border border-slate-200 p-2 text-xs font-medium" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Vessel / Flight</label>
                  <input name="vesselName" placeholder="e.g. MSC ISABELLA" className="w-full rounded-xl border border-slate-200 p-2 text-xs font-medium" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">B/L or Waybill #</label>
                  <input name="billOfLadingNumber" placeholder="e.g. MAEU1234567" className="w-full rounded-xl border border-slate-200 p-2 text-xs font-medium" />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50"
                >
                  {busy ? "Saving..." : "Add Leg"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
