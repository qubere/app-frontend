"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ShipmentIcon } from "../icons";

interface ShipmentItem {
  id: string;
  shipmentNumber: string;
  poReference?: string;
  origin: string;
  destination: string;
  mode: string;
  estimatedArrival?: string;
  transportationStatus: string;
  customsStatus: string;
  hasCustomerActionRequired: boolean;
  actionRequiredCount: number;
}

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<ShipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch(`/api/shipments?query=${encodeURIComponent(searchQuery)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.items) setShipments(data.items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1D1D1F] tracking-tight">Customs Shipments</h1>
          <p className="text-[#86868B] text-xs mt-1">
            Track ocean and air shipments, customs clearance status, and entry documents.
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

      {loading ? (
        <div className="qubere-card p-8 text-center text-[#86868B] text-sm animate-pulse">Loading shipments...</div>
      ) : shipments.length === 0 ? (
        <div className="qubere-card p-12 text-center rounded-2xl">
          <ShipmentIcon className="w-10 h-10 text-[#86868B] mx-auto mb-3" />
          <h3 className="text-base font-semibold text-[#1D1D1F]">No shipments found</h3>
          <p className="text-[#86868B] text-xs mt-1">Try adjusting your search criteria or check back later.</p>
        </div>
      ) : (
        <div className="qubere-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F5F7] text-[#86868B] font-semibold border-b border-[#E5E5EA] uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Shipment #</th>
                  <th className="px-6 py-4">PO Reference</th>
                  <th className="px-6 py-4">Route</th>
                  <th className="px-6 py-4">ETA</th>
                  <th className="px-6 py-4">Transport Status</th>
                  <th className="px-6 py-4">Customs Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5EA]">
                {shipments.map((shp) => (
                  <tr key={shp.id} className="hover:bg-[#F5F5F7]/80 transition">
                    <td className="px-6 py-4 font-mono font-bold text-[#0071E3]">{shp.shipmentNumber}</td>
                    <td className="px-6 py-4 text-[#1D1D1F]">{shp.poReference || "—"}</td>
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
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${
                        shp.customsStatus === "Released"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : shp.customsStatus === "Documents needed"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-gray-100 text-gray-700 border-gray-200"
                      }`}>
                        {shp.customsStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/shipments/${shp.id}`}
                        className="qubere-btn-secondary px-3 py-1.5 text-xs"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
