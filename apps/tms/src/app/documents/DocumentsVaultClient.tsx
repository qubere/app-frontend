"use client";

import { useState } from "react";
import { FileText, Search, Upload, Eye, CheckCircle2 } from "lucide-react";
import { TmsSidebar } from "@/components/TmsSidebar";
import { TmsHeader } from "@/components/TmsHeader";
import { Card, Button } from "@/components/ui";
import { DocumentUploadModal } from "@/components/DocumentUploadModal";
import { DocumentReviewPanel } from "@/components/DocumentReviewPanel";

export interface VaultDocItem {
  id: string;
  docType: string;
  fileName: string;
  shipmentNumber: string;
  createdAt: string;
  status: string;
  confidence: number;
}

export function DocumentsVaultClient({ initialDocuments }: { initialDocuments: VaultDocItem[] }) {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<VaultDocItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const docs = initialDocuments;

  const filtered = docs.filter(
    (d) =>
      d.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.docType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.shipmentNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-surface-muted text-ink flex w-full">
      <TmsSidebar accountName="Enterprise Freight" />

      <div className="flex-1 flex flex-col min-w-0">
        <TmsHeader tenantName="Enterprise Freight" userName="Operations Lead" />

        <main className="flex-1 p-8 overflow-y-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-brand" />
                <h1 className="text-2xl font-extrabold text-ink tracking-tight">Trade & Logistics Document Vault</h1>
              </div>
              <p className="text-xs text-ink-muted mt-1 font-medium">
                Centralized repository of bills of lading, commercial invoices, packing lists, PODs, and customs entries with AI bounding box provenance.
              </p>
            </div>

            <Button onClick={() => setIsUploadOpen(true)} className="flex items-center space-x-2 shadow-xs cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>Upload & Parse Document</span>
            </Button>
          </div>

          {/* Filter Bar */}
          <Card className="p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents by name, type, shipment #..."
                className="pl-8 pr-4 py-2 text-xs bg-surface-muted border border-border rounded-xl focus:outline-none focus:border-brand focus:bg-white text-ink w-80 transition-all font-medium"
              />
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-ink-muted font-semibold">Total Documents:</span>
              <span className="text-xs font-bold text-ink bg-surface-muted px-2.5 py-1 rounded-lg border border-border">
                {filtered.length}
              </span>
            </div>
          </Card>

          {/* Documents Table */}
          <Card className="p-6">
            {filtered.length === 0 ? (
              <div className="p-12 text-center text-xs text-ink-muted font-medium bg-surface-muted rounded-xl border border-dashed border-border space-y-2">
                <p className="font-bold text-ink">No documents matching filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-ink-muted font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Document Category</th>
                      <th className="py-3 px-4">File Name</th>
                      <th className="py-3 px-4">Shipment #</th>
                      <th className="py-3 px-4">Uploaded</th>
                      <th className="py-3 px-4">AI Agent Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-medium text-ink">
                    {filtered.map((doc) => (
                      <tr key={doc.id} className="hover:bg-surface-muted/50 transition-colors group">
                        <td className="py-3.5 px-4 font-bold text-brand">{doc.docType}</td>
                        <td className="py-3.5 px-4 font-semibold">{doc.fileName}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-ink">{doc.shipmentNumber}</td>
                        <td className="py-3.5 px-4 text-ink-muted">{doc.createdAt}</td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>PARSED ({doc.confidence}%)</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Button onClick={() => setSelectedDoc(doc)} variant="secondary" size="sm" className="cursor-pointer">
                            <Eye className="w-3.5 h-3.5 text-brand" />
                            <span>Doc View Modal</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Doc View Modal Slide-over */}
          {selectedDoc && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-6">
              <div className="w-full h-full max-w-6xl max-h-[90vh]">
                <DocumentReviewPanel
                  documentId={selectedDoc.id}
                  fileName={selectedDoc.fileName}
                  docType={selectedDoc.docType}
                  shipmentNumber={selectedDoc.shipmentNumber}
                  onClose={() => setSelectedDoc(null)}
                />
              </div>
            </div>
          )}

          {/* Upload Modal */}
          <DocumentUploadModal
            isOpen={isUploadOpen}
            onClose={() => setIsUploadOpen(false)}
          />
        </main>
      </div>
    </div>
  );
}
