"use client";

import { portalResponseError } from "@/lib/portal-response-error";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Package, Truck } from "lucide-react";

interface ShipmentItem {
  id: string;
  shipmentNumber: string;
  poReference?: string;
  origin: string;
  destination: string;
  mode: string;
  carrierName?: string;
  estimatedArrival?: string;
  transportationStatus: string;
  customsStatus: string;
  hasCustomerActionRequired: boolean;
  actionRequiredCount: number;
}

export function ShipmentList({ freight = false }: { freight?: boolean }) {
  const [shipments, setShipments] = useState<ShipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const ShipmentIcon = freight ? Truck : Package;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      const query = new URLSearchParams({ query: searchQuery });
      if (freight) query.set("workspace", "TMS");
      fetch(`/api/shipments?${query}`, { signal: controller.signal, cache: "no-store" })
        .then(async res => {
          if (!res.ok) throw new Error(await portalResponseError(res, "Could not load shipments. Please try again."));
          const data = await res.json();
          if (!Array.isArray(data.items)) throw new Error("Could not load shipments. Please try again.");
          return data.items;
        })
        .then(items => { if (!controller.signal.aborted) setShipments(items); })
        .catch(e => { if (!controller.signal.aborted) setError(e.message); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [searchQuery, freight, retry]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1D1D1F] tracking-tight">{freight ? "Freight & Transport" : "Customs Shipments"}</h1>
          <p className="text-[#86868B] text-xs mt-1">
            {freight ? "Track your freight shipments, carrier updates, and delivery documents." : "Track ocean and air shipments, customs clearance status, and entry documents."}
          </p>
        </div>

        <input
          type="text"
          placeholder="Search by shipment #, PO reference..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-white border border-[#E5E5EA] text-[#1D1D1F] text-xs rounded-xl px-4 py-2.5 w-full md:w-72 focus:ring-2 focus:ring-[#0071E3] focus:outline-none shadow-2xs"
        />
      </div>

      {error ? (
        <div role="alert" className="qubere-card rounded-2xl p-8 text-sm text-red-700">
          <p>{error}</p><button onClick={() => setRetry(n => n + 1)} className="mt-3 underline">Try again</button>
        </div>
      ) : loading ? (
        <div className="qubere-card p-8 text-center text-[#86868B] text-sm animate-pulse">Loading shipments...</div>
      ) : shipments.length === 0 ? (
        <div className="qubere-card p-12 text-center rounded-2xl">
          <ShipmentIcon className="w-10 h-10 text-[#86868B] mx-auto mb-3" />
          <h3 className="text-base font-semibold text-[#1D1D1F]">{freight ? "No freight shipments found" : "No shipments found"}</h3>
          <p className="text-[#86868B] text-xs mt-1">{searchQuery ? "Try another shipment number or PO reference." : "Your service provider’s assigned shipments will appear here when available."}</p>
        </div>
      ) : (
        <ShipmentTable shipments={shipments} freight={freight} />
      )}
    </div>
  );
}

export function ShipmentTable({ shipments, freight = false }: { shipments: ShipmentItem[]; freight?: boolean }) {
  return (
        <div className="qubere-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F5F7] text-[#86868B] font-semibold border-b border-[#E5E5EA] uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Shipment #</th>
                  <th className="px-6 py-4">{freight ? "Carrier" : "PO Reference"}</th>
                  <th className="px-6 py-4">Route</th>
                  <th className="px-6 py-4">{freight ? "Est. Delivery" : "ETA"}</th>
                  <th className="px-6 py-4">{freight ? "Freight Status" : "Transport Status"}</th>
                  {!freight && <th className="px-6 py-4">Customs Status</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5EA]">
                {shipments.map((shp) => (
                  <tr key={shp.id} className="hover:bg-[#F5F5F7]/80 transition">
                    <td className="px-6 py-4">
                      <Link href={`/shipments/${shp.id}`} className="font-mono font-bold text-[#0071E3] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4">
                        {shp.shipmentNumber}
                      </Link>
                      {shp.actionRequiredCount > 0 && <span className="block mt-1 text-amber-700">{shp.actionRequiredCount} open {shp.actionRequiredCount === 1 ? "request" : "requests"}</span>}
                    </td>
                    <td className="px-6 py-4 text-[#1D1D1F]">{(freight ? shp.carrierName : shp.poReference) || "—"}</td>
                    <td className="px-6 py-4 text-[#1D1D1F]">
                      {shp.origin} &rarr; {shp.destination}
                    </td>
                    <td className="px-6 py-4 text-[#1D1D1F]">
                      {shp.estimatedArrival ? new Date(shp.estimatedArrival).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-[#0071E3] border border-blue-100">
                        {shp.transportationStatus}
                      </span>
                    </td>
                    {!freight && <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${
                        shp.customsStatus === "Released"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : shp.customsStatus === "Documents needed"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-gray-100 text-gray-700 border-gray-200"
                      }`}>
                        {shp.customsStatus}
                      </span>
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
  );
}
