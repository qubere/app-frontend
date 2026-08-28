"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ShipmentIcon, DocumentIcon, BellIcon } from "./icons";

interface ActionItem {
  id: string;
  type: string;
  title: string;
  description: string;
  status: string;
  dueAt?: string;
  shipmentId?: string;
  shipmentNumber?: string;
  estimatedArrival?: string;
  domain: string;
  targetUrl?: string;
}

interface ActiveShipment {
  id: string;
  shipmentNumber: string;
  poReference?: string;
  origin: string;
  destination: string;
  estimatedArrival?: string;
  transportationStatus: string;
  customsStatus: string;
  actionRequiredCount: number;
}

interface RecentFile {
  id: string;
  fileName: string;
  docType: string;
  createdAt: string;
  shipmentId?: string;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [activeShipments, setActiveShipments] = useState<ActiveShipment[]>([]);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((data) => {
        if (data.actionItems) setActionItems(data.actionItems);
        if (data.activeShipments) setActiveShipments(data.activeShipments);
        if (data.recentFiles) setRecentFiles(data.recentFiles);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-10">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#1D1D1F] tracking-tight">Customer Dashboard</h1>
          <p className="text-[#86868B] text-sm mt-1">
            Action-first overview of your ongoing imports, customs clearance, and pending actions.
          </p>
        </div>

        <Link
          href="/documents"
          className="qubere-btn-primary px-5 py-2.5 text-sm flex items-center space-x-2 shadow-sm"
        >
          <DocumentIcon className="w-4 h-4" />
          <span>Upload Document</span>
        </Link>
      </div>

      {/* QUESTION 1: What do you need from me? */}
      <section className="space-y-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-500/20">
            <BellIcon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1D1D1F]">Needs Your Attention</h2>
            <p className="text-xs text-[#86868B]">Broker questions, document requests, and approval items</p>
          </div>
        </div>

        {loading ? (
          <div className="qubere-card p-6 text-center text-[#86868B] text-sm animate-pulse">Loading items...</div>
        ) : actionItems.length === 0 ? (
          <div className="qubere-card p-8 text-center rounded-2xl">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto mb-3 border border-emerald-500/20">
              ✓
            </div>
            <h3 className="text-base font-semibold text-[#1D1D1F]">Nothing needed from you right now</h3>
            <p className="text-[#86868B] text-xs mt-1">All your active shipments and filings are moving smoothly.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {actionItems.map((item) => (
              <div key={item.id} className="qubere-card qubere-card-hover p-6 rounded-2xl border-l-4 border-l-amber-500">
                <div className="flex justify-between items-start">
                  <span className="text-[11px] font-bold uppercase px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                    {item.type === "DOCUMENT" ? "Document Required" : item.type === "QUESTION" ? "Field Update" : "Confirmation"}
                  </span>
                  {item.shipmentNumber && (
                    <span className="text-xs font-mono font-bold text-[#0071E3] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                      {item.shipmentNumber}
                    </span>
                  )}
                </div>

                <h3 className="text-base font-bold text-[#1D1D1F] mt-3">{item.title}</h3>
                {item.description && <p className="text-xs text-[#86868B] mt-1 line-clamp-2">{item.description}</p>}

                <div className="mt-4 pt-3 border-t border-[#E5E5EA] flex flex-wrap justify-between items-center text-xs text-[#86868B] gap-2">
                  <div className="space-x-3">
                    <span>Due: <strong className="text-amber-700 font-semibold">{item.dueAt ? new Date(item.dueAt).toLocaleDateString() : "ASAP"}</strong></span>
                    {item.estimatedArrival && (
                      <span>&bull; ETA: <strong className="text-[#0071E3] font-semibold">{new Date(item.estimatedArrival).toLocaleDateString()}</strong></span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Link
                      href={`/requests/${item.id}`}
                      className="qubere-btn-secondary px-3 py-1.5 text-xs"
                    >
                      Respond
                    </Link>
                    {item.shipmentId && (
                      <Link
                        href={`/shipments/${item.shipmentId}`}
                        className="qubere-btn-primary px-3.5 py-1.5 text-xs inline-flex items-center space-x-1"
                      >
                        <span>Open Shipment &rarr;</span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* QUESTION 2: What is the status of my shipments? */}
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center border border-[#0071E3]/20">
              <ShipmentIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1D1D1F]">Active Shipments</h2>
              <p className="text-xs text-[#86868B]">Current ocean/air imports and customs entry clearance status</p>
            </div>
          </div>
          <Link href="/shipments" className="text-xs font-semibold text-[#0071E3] hover:underline">
            View All Shipments &rarr;
          </Link>
        </div>

        {loading ? (
          <div className="qubere-card p-6 text-center text-[#86868B] text-sm animate-pulse">Loading shipments...</div>
        ) : activeShipments.length === 0 ? (
          <div className="qubere-card p-8 text-center rounded-2xl">
            <p className="text-[#86868B] text-sm">No active shipments in progress.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeShipments.map((shp) => (
              <div key={shp.id} className="qubere-card qubere-card-hover p-6 rounded-2xl flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-mono text-sm font-bold text-[#0071E3]">{shp.shipmentNumber}</span>
                    {shp.poReference && (
                      <span className="text-xs text-[#86868B] bg-[#F5F5F7] px-2.5 py-0.5 rounded-lg border border-[#E5E5EA]">
                        PO: {shp.poReference}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-[#1D1D1F] space-y-1.5 mb-4">
                    <div className="flex justify-between">
                      <span className="text-[#86868B]">Route:</span>
                      <span className="font-medium text-[#1D1D1F]">{shp.origin} &rarr; {shp.destination}</span>
                    </div>
                    {shp.estimatedArrival && (
                      <div className="flex justify-between">
                        <span className="text-[#86868B]">ETA:</span>
                        <span className="font-medium text-[#1D1D1F]">{new Date(shp.estimatedArrival).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-[#E5E5EA]">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#86868B]">Transport:</span>
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/20">
                      {shp.transportationStatus}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#86868B]">Customs:</span>
                    <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold border ${
                      shp.customsStatus === "Released"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : shp.customsStatus === "Documents needed"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-gray-100 text-gray-700 border-gray-200"
                    }`}>
                      {shp.customsStatus}
                    </span>
                  </div>
                  <Link
                    href={`/shipments/${shp.id}`}
                    className="block text-center mt-4 qubere-btn-secondary py-2 text-xs"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* QUESTION 3: What can I download? */}
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center border border-teal-500/20">
              <DocumentIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1D1D1F]">Recent Files & Downloads</h2>
              <p className="text-xs text-[#86868B]">Recently published entry summaries (7501), customer documents, and issued invoices</p>
            </div>
          </div>
          <Link href="/documents" className="text-xs font-semibold text-teal-600 hover:underline">
            View All Documents &rarr;
          </Link>
        </div>

        {recentFiles.length === 0 ? (
          <div className="qubere-card p-6 text-center text-[#86868B] text-sm">No recent documents available for download.</div>
        ) : (
          <div className="qubere-card rounded-2xl overflow-hidden">
            <div className="divide-y divide-[#E5E5EA]">
              {recentFiles.map((file) => (
                <div key={file.id} className="p-4 flex items-center justify-between hover:bg-[#F5F5F7] transition">
                  <div className="flex items-center space-x-3.5">
                    <DocumentIcon className="w-5 h-5 text-teal-600" />
                    <div>
                      <h4 className="text-sm font-semibold text-[#1D1D1F]">{file.fileName}</h4>
                      <span className="text-xs text-[#86868B]">{file.docType} &bull; Uploaded {new Date(file.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <a
                    href={`/api/documents/${file.id}/download`}
                    className="qubere-btn-secondary px-3.5 py-1.5 text-xs"
                  >
                    Download
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
