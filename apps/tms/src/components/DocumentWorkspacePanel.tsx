"use client";

import { useState } from "react";
import { ShipmentDocumentsSection, type DocumentItem } from "./ShipmentDocumentsSection";
import { DocumentReviewPanel } from "./DocumentReviewPanel";

interface DocumentWorkspacePanelProps {
  shipmentId: string;
  shipmentNumber: string;
  documents: DocumentItem[];
  originStatus?: string;
  initialDocId?: string;
}

export function DocumentWorkspacePanel({
  shipmentId,
  shipmentNumber,
  documents,
  originStatus = "Not Applicable",
  initialDocId,
}: DocumentWorkspacePanelProps) {
  const [activeDocId, setActiveDocId] = useState<string | undefined>(
    () => initialDocId ?? documents[0]?.id
  );

  const primaryDoc = documents.find((d) => d.id === activeDocId) || documents[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: Documents Sidebar */}
      <div className="lg:col-span-4">
        <ShipmentDocumentsSection
          shipmentId={shipmentId}
          documents={documents}
          activeDocId={activeDocId}
          onSelectDoc={(id) => setActiveDocId(id)}
          originStatus={originStatus}
        />
      </div>

      {/* Right Column: Embedded PDF Canvas & Provenance Viewer */}
      <div className="lg:col-span-8">
        <DocumentReviewPanel
          documentId={primaryDoc?.id ?? "doc_default"}
          fileName={primaryDoc?.fileName ?? "CommercialInvoice_1 2.pdf"}
          docType={primaryDoc?.docType ?? "Commercial Invoice"}
          shipmentNumber={shipmentNumber}
          fileUrl={primaryDoc?.fileUrl ?? undefined}
          extractedJson={primaryDoc?.extractedJson}
        />
      </div>
    </div>
  );
}
