"use client";

import React, { useEffect, useState } from "react";
import { DocumentIcon } from "../icons";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface DocItem {
  id: string;
  fileName: string;
  docType: string;
  byteSize?: number;
  status: string;
  shipmentNumber?: string;
  createdAt: string;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/documents")
      .then((res) => res.json())
      .then((data) => {
        if (data.items) setDocuments(data.items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1D1D1F] tracking-tight">Customer Documents</h1>
          <p className="text-[#86868B] text-xs mt-1">
            Customer-uploaded files, packing lists, commercial invoices, and broker-published records.
          </p>
        </div>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-[#86868B] text-sm animate-pulse">Loading documents...</Card>
      ) : documents.length === 0 ? (
        <Card className="p-12 text-center rounded-2xl">
          <DocumentIcon className="w-10 h-10 text-[#86868B] mx-auto mb-3" />
          <h3 className="text-base font-semibold text-[#1D1D1F]">No documents available</h3>
          <p className="text-[#86868B] text-xs mt-1">Uploaded files and published entry documents will appear here.</p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="divide-y divide-[#E5E5EA]">
            {documents.map((doc) => (
              <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-[#F5F5F7]/80 transition">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center border border-[#0071E3]/20">
                    <DocumentIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#1D1D1F]">{doc.fileName}</h4>
                    <div className="flex items-center space-x-3 text-xs text-[#86868B] mt-0.5">
                      <span>{doc.docType}</span>
                      <span>&bull;</span>
                      <span>Uploaded {new Date(doc.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <a href={`/api/documents/${doc.id}/download`}>
                  <Button variant="secondary" size="sm">
                    Download
                  </Button>
                </a>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
