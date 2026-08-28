"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ShipmentIcon, DocumentIcon, InvoiceIcon, BellIcon } from "../../icons";

interface ShipmentData {
  overview: {
    id: string;
    shipmentNumber: string;
    poReference?: string;
    importerName: string;
    origin: string;
    destination: string;
    transportMode: string;
    carrierName?: string;
    estimatedArrival?: string;
    transportationStatus: string;
    customsStatus: string;
  };
  requests: Array<{
    id: string;
    type: string;
    title: string;
    description?: string;
    status: string;
    dueAt?: string;
    messages: Array<{ id: string; authorType: string; body: string; createdAt: string }>;
  }>;
  documents: Array<{
    id: string;
    fileName: string;
    docType: string;
    status: string;
    createdAt: string;
  }>;
  entries: Array<{
    id: string;
    entryNumber: string;
    status: string;
    dutyTotal?: number;
    publishedAt: string;
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    issueDate: string;
    totalAmount: number;
    status: string;
  }>;
}

export default function ShipmentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<ShipmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "requests" | "documents" | "entries" | "invoices">("overview");

  useEffect(() => {
    fetch(`/api/shipments/${id}`)
      .then((res) => res.json())
      .then((resData) => {
        if (resData.overview) setData(resData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="qubere-card p-12 text-center text-[#86868B] text-sm animate-pulse">Loading shipment details...</div>;
  }

  if (!data) {
    return (
      <div className="qubere-card p-12 text-center rounded-2xl">
        <h2 className="text-xl font-bold text-[#1D1D1F]">Shipment Not Found</h2>
        <p className="text-[#86868B] text-xs mt-2">The requested shipment does not exist or you lack permission to view it.</p>
        <Link href="/shipments" className="inline-block mt-4 text-xs text-[#0071E3] hover:underline font-medium">
          &larr; Back to Shipments
        </Link>
      </div>
    );
  }

  const { overview, requests, documents, entries, invoices } = data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#E5E5EA] pb-6">
        <div>
          <div className="flex items-center space-x-3">
            <Link href="/shipments" className="text-[#86868B] hover:text-[#1D1D1F] text-xs font-medium">
              &larr; Shipments
            </Link>
            <span className="text-[#E5E5EA]">/</span>
            <span className="font-mono text-sm font-bold text-[#0071E3]">{overview.shipmentNumber}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#1D1D1F] tracking-tight mt-1">
            {overview.importerName}
          </h1>
          <p className="text-xs text-[#86868B] mt-1">
            PO: {overview.poReference || "N/A"} &bull; Route: {overview.origin} &rarr; {overview.destination}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#0071E3] border border-blue-100">
            Transport: {overview.transportationStatus}
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
            overview.customsStatus === "Released"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-amber-50 text-amber-700 border-amber-200"
          }`}>
            Customs: {overview.customsStatus}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-[#E5E5EA] pb-3">
        {(["overview", "requests", "documents", "entries", "invoices"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize transition ${
              activeTab === tab
                ? "bg-[#0071E3] text-white shadow-md shadow-[#0071E3]/20"
                : "text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#F5F5F7]"
            }`}
          >
            {tab} {tab === "requests" && requests.length > 0 && `(${requests.length})`}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="qubere-card p-6 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-[#1D1D1F] uppercase tracking-wider">Transportation Details</h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-[#E5E5EA]">
                <span className="text-[#86868B]">Mode</span>
                <span className="text-[#1D1D1F] font-semibold">{overview.transportMode}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E5E5EA]">
                <span className="text-[#86868B]">Carrier</span>
                <span className="text-[#1D1D1F] font-semibold">{overview.carrierName || "Pending Assignee"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E5E5EA]">
                <span className="text-[#86868B]">ETA</span>
                <span className="text-[#1D1D1F] font-semibold">
                  {overview.estimatedArrival ? new Date(overview.estimatedArrival).toLocaleDateString() : "TBD"}
                </span>
              </div>
            </div>
          </div>

          <div className="qubere-card p-6 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-[#1D1D1F] uppercase tracking-wider">Customs Status</h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-[#E5E5EA]">
                <span className="text-[#86868B]">Customs Clearance</span>
                <span className="text-emerald-700 font-semibold">{overview.customsStatus}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E5E5EA]">
                <span className="text-[#86868B]">Published Entry Summaries</span>
                <span className="text-[#1D1D1F] font-semibold">{entries.length} available</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "requests" && (
        <div className="space-y-4">
          {requests.length === 0 ? (
            <div className="qubere-card p-8 text-center text-[#86868B] text-sm">No requests for this shipment.</div>
          ) : (
            requests.map((r) => (
              <div key={r.id} className="qubere-card p-6 rounded-2xl space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-semibold uppercase px-2.5 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200">
                      {r.type}
                    </span>
                    <h3 className="text-base font-bold text-[#1D1D1F] mt-2">{r.title}</h3>
                  </div>
                  <Link
                    href={`/requests/${r.id}`}
                    className="qubere-btn-primary px-4 py-2 text-xs"
                  >
                    Open Thread &rarr;
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "documents" && (
        <div className="qubere-card rounded-2xl overflow-hidden divide-y divide-[#E5E5EA]">
          {documents.map((d) => (
            <div key={d.id} className="p-4 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-[#1D1D1F]">{d.fileName}</h4>
                <span className="text-xs text-[#86868B]">{d.docType}</span>
              </div>
              <a
                href={`/api/documents/${d.id}/download`}
                className="qubere-btn-secondary px-3.5 py-1.5 text-xs"
              >
                Download PDF
              </a>
            </div>
          ))}
        </div>
      )}

      {activeTab === "entries" && (
        <div className="qubere-card rounded-2xl overflow-hidden divide-y divide-[#E5E5EA]">
          {entries.map((e) => (
            <div key={e.id} className="p-4 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold font-mono text-[#0071E3]">Entry Summary: {e.entryNumber}</h4>
                <span className="text-xs text-[#86868B]">Published {new Date(e.publishedAt).toLocaleDateString()}</span>
              </div>
              <a
                href={`/api/entries/${e.id}/download`}
                className="qubere-btn-primary px-4 py-2 text-xs"
              >
                Download 7501 PDF
              </a>
            </div>
          ))}
        </div>
      )}

      {activeTab === "invoices" && (
        <div className="qubere-card rounded-2xl overflow-hidden divide-y divide-[#E5E5EA]">
          {invoices.map((inv) => (
            <div key={inv.id} className="p-4 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold font-mono text-[#1D1D1F]">Invoice: {inv.invoiceNumber}</h4>
                <span className="text-xs text-[#86868B]">Amount: ${inv.totalAmount.toLocaleString()}</span>
              </div>
              <a
                href={`/api/invoices/${inv.id}/download`}
                className="qubere-btn-secondary px-3.5 py-1.5 text-xs"
              >
                Download PDF
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
