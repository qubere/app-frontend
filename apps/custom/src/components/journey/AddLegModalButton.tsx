"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

interface AddLegModalButtonProps {
  shipmentId: string;
}

export function AddLegModalButton({ shipmentId }: AddLegModalButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAddLeg = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    try {
      const res = await fetch(`/api/shipments/${shipmentId}/legs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legType: formData.get("legType"),
          mode: formData.get("mode"),
          destinationName: formData.get("destinationName"),
          carrierName: formData.get("carrierName"),
          vesselName: formData.get("vesselName"),
          billOfLadingNumber: formData.get("billOfLadingNumber"),
        }),
      });

      if (res.ok) {
        setShowModal(false);
        if (typeof window !== "undefined") window.location.reload();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold bg-blue-600 text-white shadow-2xs hover:bg-blue-700 transition cursor-pointer"
        title="Add a transport leg to this shipment"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Add Leg</span>
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-200 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900">Add Transport Leg</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddLeg} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">Leg Type</label>
                <select name="legType" className="w-full mt-1 p-2 rounded-xl border border-slate-200 bg-white">
                  <option value="EXPORT_HAULAGE">EXPORT HAULAGE</option>
                  <option value="MAIN_CARRIAGE">MAIN CARRIAGE</option>
                  <option value="TRANSSHIPMENT">TRANSSHIPMENT</option>
                  <option value="IMPORT_HAULAGE">IMPORT HAULAGE</option>
                  <option value="ON_CARRIAGE">ON CARRIAGE</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700">Transport Mode</label>
                <select name="mode" className="w-full mt-1 p-2 rounded-xl border border-slate-200 bg-white">
                  <option value="OCEAN">OCEAN</option>
                  <option value="TRUCK">TRUCK</option>
                  <option value="AIR">AIR</option>
                  <option value="RAIL">RAIL</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700">Destination Name</label>
                <input name="destinationName" required placeholder="e.g. Busan Port / Long Beach Pier 400" className="w-full mt-1 p-2 rounded-xl border border-slate-200" />
              </div>

              <div>
                <label className="font-bold text-slate-700">Carrier Name</label>
                <input name="carrierName" placeholder="e.g. COSCO Shipping" className="w-full mt-1 p-2 rounded-xl border border-slate-200" />
              </div>

              <div>
                <label className="font-bold text-slate-700">Vessel / Conveyance Name</label>
                <input name="vesselName" placeholder="e.g. COSCO LIBRA" className="w-full mt-1 p-2 rounded-xl border border-slate-200" />
              </div>

              <div>
                <label className="font-bold text-slate-700">Bill of Lading Number</label>
                <input name="billOfLadingNumber" placeholder="e.g. COSU7223841650" className="w-full mt-1 p-2 rounded-xl border border-slate-200" />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-bold border border-slate-200 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? "Adding..." : "Add Leg"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
