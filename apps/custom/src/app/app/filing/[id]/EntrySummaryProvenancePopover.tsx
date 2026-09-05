"use client";

import { FileText, UserCheck, Sparkles, Database, Calculator, Building2, HelpCircle } from "lucide-react";
import { Modal, ModalBody, ModalHeader } from "@/components/ui/Modal";
import type { ProvenanceSource } from "@/modules/entrySummary/provenance";

/**
 * Client-safe mirror of `FieldProvenance` (provenance.ts) — the draft arrives
 * over JSON, so this is a plain-data shape, not the server type itself.
 */
export interface EntrySummaryFieldProvenanceLike {
  source: ProvenanceSource;
  documentId?: string;
  documentPage?: number;
  factId?: string;
  agentDecisionId?: string;
  fieldApprovalId?: string;
  masterRecord?: { model: string; id: string };
  computedFrom?: string[];
  confidence?: number;
  asOf: string;
}

const SOURCE_ICON: Record<ProvenanceSource, typeof FileText> = {
  DOCUMENT: FileText,
  USER: UserCheck,
  AGENT: Sparkles,
  MASTER_DATA: Database,
  COMPUTED: Calculator,
  FILER_PROFILE: Building2,
  MISSING: HelpCircle,
};

const SOURCE_LABEL: Record<ProvenanceSource, string> = {
  DOCUMENT: "Sourced from a document",
  USER: "Entered by a user",
  AGENT: "Proposed by an agent",
  MASTER_DATA: "From master data",
  COMPUTED: "Computed from other blocks",
  FILER_PROFILE: "From the filer profile",
  MISSING: "No source — field is empty",
};

const SOURCE_STYLE: Record<ProvenanceSource, string> = {
  DOCUMENT: "border-blue-200 bg-blue-50 text-blue-900",
  USER: "border-brand/30 bg-blue-50 text-brand",
  AGENT: "border-violet-200 bg-violet-50 text-violet-900",
  MASTER_DATA: "border-emerald-200 bg-emerald-50 text-emerald-900",
  COMPUTED: "border-slate-200 bg-slate-50 text-slate-900",
  FILER_PROFILE: "border-amber-200 bg-amber-50 text-amber-900",
  MISSING: "border-red-200 bg-red-50 text-red-800",
};

function formatBlockId(blockId: string): string {
  const m = blockId.match(/^B(\d{2}[A-Z]?)_?(.*)$/);
  if (!m) return blockId;
  const [, num, rest] = m;
  if (!rest) return `B${num}`;
  const ACRONYMS = new Set(["HTSUS", "ADCVD", "IRC", "BL", "AWB", "IT", "ID", "US", "MPF", "HMF"]);
  const label = rest
    .split("_")
    .filter(Boolean)
    .map((w) => (ACRONYMS.has(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(" ");
  return `B${num} · ${label}`;
}

export interface EntrySummaryProvenanceTarget {
  blockId: string;
  value: unknown;
  provenance: EntrySummaryFieldProvenanceLike;
}

export function EntrySummaryProvenancePopover({
  target,
  onClose,
}: {
  target: EntrySummaryProvenanceTarget;
  onClose: () => void;
}) {
  const { provenance } = target;
  const Icon = SOURCE_ICON[provenance.source];
  const titleId = "entry-summary-provenance-title";

  return (
    <Modal isOpen onClose={onClose} titleId={titleId} className="max-w-md">
      <ModalHeader
        titleId={titleId}
        title="Field Provenance"
        subtitle={formatBlockId(target.blockId)}
        icon={<Icon className="w-4 h-4" />}
        onClose={onClose}
      />
      <ModalBody className="space-y-3">
        <div className={`rounded-xl border p-3 flex items-start gap-2.5 ${SOURCE_STYLE[provenance.source]}`}>
          <Icon className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-xs font-extrabold uppercase tracking-wider">{provenance.source}</p>
            <p className="text-xs">{SOURCE_LABEL[provenance.source]}</p>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">Current value</span>
            <span className="font-mono font-bold text-ink">
              {target.value === null || target.value === undefined || target.value === "" ? "—" : String(target.value)}
            </span>
          </div>

          {provenance.source === "MISSING" && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-red-800">
              No source — nothing has been fabricated in its place. Provide this on the shipment workspace, or via a
              document upload, to populate this block.
            </p>
          )}

          {provenance.documentId && (
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Document</span>
              <span className="font-mono text-ink">
                {provenance.documentId}
                {provenance.documentPage != null ? ` · page ${provenance.documentPage}` : ""}
              </span>
            </div>
          )}

          {provenance.masterRecord && (
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Master record</span>
              <span className="font-mono text-ink">
                {provenance.masterRecord.model} · {provenance.masterRecord.id}
              </span>
            </div>
          )}

          {provenance.agentDecisionId && (
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Agent decision</span>
              <span className="font-mono text-ink">{provenance.agentDecisionId}</span>
            </div>
          )}

          {provenance.computedFrom && provenance.computedFrom.length > 0 && (
            <div className="space-y-1">
              <span className="text-ink-muted">Computed from</span>
              <div className="flex flex-wrap gap-1.5">
                {provenance.computedFrom.map((b) => (
                  <span key={b} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-muted border border-border text-ink">
                    {formatBlockId(b)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {provenance.confidence != null && (
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Confidence</span>
              <span className="font-bold text-ink">{Math.round(provenance.confidence * 100)}%</span>
            </div>
          )}

          {provenance.fieldApprovalId && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-emerald-800 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Confirmed by human review ({provenance.fieldApprovalId})</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-ink-muted">As of</span>
            <span className="text-ink">{new Date(provenance.asOf).toLocaleString()}</span>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}

export { formatBlockId };
