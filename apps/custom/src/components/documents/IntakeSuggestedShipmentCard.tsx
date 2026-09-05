"use client";

import { useState } from "react";
import { Check, Sparkles, Link2, AlertCircle } from "lucide-react";

export interface ShipmentCandidateSuggestion {
  id: string;
  confidenceScore: number;
  matchedIdentifierType?: string | null;
  matchedValue?: string | null;
  matchMethod?: string | null;
  autoSelected?: boolean | null;
  matchReasons?: string[];
  shipment: {
    id: string;
    shipmentNumber: string;
    portOfEntry?: string | null;
  };
}

export function IntakeSuggestedShipmentCard({
  documentId,
  candidates,
  onAttach,
}: {
  documentId: string;
  candidates: ShipmentCandidateSuggestion[];
  onAttach: (shipmentId: string) => Promise<void>;
}) {
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!candidates || candidates.length === 0) {
    return null;
  }

  const topCandidate = candidates[0];
  const pct = Math.round((topCandidate.confidenceScore <= 1.0 ? topCandidate.confidenceScore * 100 : topCandidate.confidenceScore));

  const handleAttachClick = async (shipmentId: string) => {
    setAttachingId(shipmentId);
    setErrorMsg(null);
    try {
      await onAttach(shipmentId);
    } catch (err) {
      setErrorMsg("Failed to attach document to shipment.");
    } finally {
      setAttachingId(null);
    }
  };

  return (
    <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5 font-bold text-blue-900">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Suggested Shipment Match</span>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300">
          {pct}% Match Confidence
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="font-mono font-black text-slate-900">{topCandidate.shipment.shipmentNumber}</span>
          {topCandidate.matchedIdentifierType && topCandidate.matchedValue && (
            <span className="ml-2 text-[11px] text-slate-600">
              ({topCandidate.matchedIdentifierType}: {topCandidate.matchedValue})
            </span>
          )}
          {topCandidate.matchReasons && topCandidate.matchReasons.length > 0 && (
            <p className="text-[10px] text-slate-500 mt-0.5">{topCandidate.matchReasons.join("; ")}</p>
          )}
        </div>

        <button
          type="button"
          disabled={attachingId === topCandidate.shipment.id}
          onClick={() => handleAttachClick(topCandidate.shipment.id)}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1 shrink-0 disabled:opacity-50"
        >
          <Link2 className="w-3 h-3" />
          <span>{attachingId === topCandidate.shipment.id ? "Attaching..." : "Attach"}</span>
        </button>
      </div>

      {errorMsg && (
        <div className="flex items-center space-x-1 text-red-600 text-[10px]">
          <AlertCircle className="w-3 h-3" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
