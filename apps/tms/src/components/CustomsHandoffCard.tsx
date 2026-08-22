"use client";

import { useState } from "react";
import { Card, Button, Badge } from "@/components/ui";
import { ShieldCheck, Send, ExternalLink, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export interface CustomsHandoffCardProps {
  shipmentId: string;
  shipmentNumber: string;
  customsRequired: boolean;
  customsCaseId?: string | null;
  customsCaseNumber?: string | null;
  workspaceStatus?: string | null;
  filingStatus?: string | null;
  documentReadiness?: string | null;
  holdReleaseStatus?: string | null;
}

export function CustomsHandoffCard({
  shipmentId,
  shipmentNumber: _shipmentNumber,
  customsRequired,
  customsCaseId: initialCaseId,
  customsCaseNumber: initialCaseNumber,
  workspaceStatus: initialWorkspaceStatus,
  filingStatus: initialFilingStatus,
  documentReadiness: initialDocReadiness,
  holdReleaseStatus: initialHoldReleaseStatus,
}: CustomsHandoffCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string | null>(initialCaseId ?? null);
  const [caseNumber, setCaseNumber] = useState<string | null>(initialCaseNumber ?? null);
  const [workspaceStatus, setWorkspaceStatus] = useState<string | null>(
    initialWorkspaceStatus ?? (customsRequired ? "AVAILABLE_FROM_TMS" : null)
  );

  const isHandoffComplete = Boolean(caseId || workspaceStatus === "ACTIVE");

  const handleSendToCustoms = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/shipments/${shipmentId}/send-to-customs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send shipment to Customs");
      }

      setCaseId(data.customsCaseId);
      setCaseNumber(data.customsCaseId ? `CC-2026-${data.customsCaseId.slice(-6).toUpperCase()}` : "Active Case");
      setWorkspaceStatus("ACTIVE");
      setSuccess(`Shipment successfully handed off to Customs! (Case ID: ${data.customsCaseId})`);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during handoff.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-5 space-y-4 border border-border bg-surface shadow-xs rounded-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink">Customs Workspace & Handoff</h3>
            <p className="text-xs text-ink-muted">Shared shipment identity & customs broker workspace</p>
          </div>
        </div>

        <Badge variant={isHandoffComplete ? "success" : customsRequired ? "warning" : "neutral"}>
          {isHandoffComplete ? "Customs Active" : customsRequired ? "Customs Required" : "No Handoff"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-2 text-xs border-y border-border-subtle">
        <div>
          <span className="text-ink-muted block text-[10px] uppercase tracking-wider font-semibold">Customs Required</span>
          <span className="font-semibold text-ink">{customsRequired ? "Yes" : "No"}</span>
        </div>
        <div>
          <span className="text-ink-muted block text-[10px] uppercase tracking-wider font-semibold">Workspace Status</span>
          <span className="font-semibold text-ink">{workspaceStatus || "Not Started"}</span>
        </div>
        <div>
          <span className="text-ink-muted block text-[10px] uppercase tracking-wider font-semibold">Customs Case</span>
          <span className="font-semibold text-ink">{caseNumber || caseId || "None"}</span>
        </div>
        <div>
          <span className="text-ink-muted block text-[10px] uppercase tracking-wider font-semibold">Filing / Release</span>
          <span className="font-semibold text-ink">{initialFilingStatus || initialHoldReleaseStatus || "Draft"}</span>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        {!isHandoffComplete ? (
          <Button
            variant="primary"
            size="sm"
            onClick={handleSendToCustoms}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {loading ? "Sending to Customs..." : "Send to Customs"}
          </Button>
        ) : (
          <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Workspace Active in Customs
          </span>
        )}

        {isHandoffComplete && (
          <a
            href={`/customs/shipments/${shipmentId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-brand font-semibold hover:underline"
          >
            Open in Customs <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </Card>
  );
}
