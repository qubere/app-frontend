"use client";

import { useEffect, useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { displayCurrency } from "@/lib/honest";
import { HEADER_BLOCK_IDS, LINE_BLOCK_IDS, type Block } from "@/modules/entrySummary/model";
import {
  EntrySummaryProvenancePopover,
  formatBlockId,
  type EntrySummaryProvenanceTarget,
} from "./EntrySummaryProvenancePopover";
import { EntrySummaryValidationPanel, type EntrySummaryFindingLike } from "./EntrySummaryValidationPanel";
import { FilerExportPanel } from "./FilerExportPanel";

// ---------------------------------------------------------------------------
// Client-safe mirrors of the JSON shapes returned by
// /api/shipments/[id]/entry-summary — the real EntrySummaryDraft/
// EntrySummaryField types (model.ts) carry Decimal + zod schema machinery
// that only makes sense server-side; over the wire every value is either a
// plain string, number, or (for the OtherFeeEntry array) a plain object.
// ---------------------------------------------------------------------------

interface FieldLike {
  blockId: string;
  value: unknown;
  provenance: EntrySummaryProvenanceTarget["provenance"];
}

interface DraftLineLike {
  lineNumber: number;
  sourceLineNumber: number | null;
  parentLineNumber: number | null;
  fields: Record<string, FieldLike>;
}

interface DraftLike {
  header: { fields: Record<string, FieldLike> };
  lines: DraftLineLike[];
  generatedAt: string;
}

interface DraftEnvelope {
  version: number;
  shipmentId: string;
  filingId: string | null;
  draftData: DraftLike;
  validationData: { findings: EntrySummaryFindingLike[]; blockingCount: number; warningCount: number; isExportable: boolean };
  isExportable: boolean;
  blockingCount: number;
  warningCount: number;
  approvedAt: string | null;
  approvedBy: string | null;
  supersededAt: string | null;
  createdAt: string;
}

const CURRENCY_BLOCKS = new Set<string>([
  "B35_TOTAL_ENTERED_VALUE",
  "B37_TOTAL_DUTY",
  "B38_TOTAL_TAX",
  "B40_TOTAL",
  "B32A_ENTERED_VALUE",
  "B32B_CHGS",
  "B34_DUTY_TAX",
]);

function errorFromResponse(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "error" in data) {
    const err = (data as { error?: { message?: string } | string }).error;
    if (typeof err === "string") return err;
    if (err && typeof err.message === "string") return err.message;
  }
  return fallback;
}

function FieldTile({ field, onOpen }: { field: FieldLike; onOpen: (f: FieldLike) => void }) {
  const isMissing = field.provenance.source === "MISSING";
  const isOtherFees = field.blockId === "B39_TOTAL_OTHER_FEES";
  const raw = field.value;
  const display = isMissing
    ? "—"
    : isOtherFees
    ? Array.isArray(raw) && raw.length > 0
      ? `${raw.length} fee${raw.length === 1 ? "" : "s"}`
      : "—"
    : CURRENCY_BLOCKS.has(field.blockId)
    ? displayCurrency(raw as string | number | null)
    : raw === null || raw === undefined || raw === ""
    ? "—"
    : String(raw);

  return (
    <button
      type="button"
      onClick={() => onOpen(field)}
      className={`rounded-xl border p-3 text-left space-y-1 cursor-pointer hover:shadow-sm transition-shadow ${
        isMissing ? "border-red-200 bg-red-50/60" : "border-border bg-surface-muted/60 hover:border-brand"
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[9px] font-bold uppercase tracking-wider text-ink-muted truncate">{formatBlockId(field.blockId)}</span>
        {isMissing && (
          <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[8px] font-extrabold uppercase bg-red-100 text-red-700 border border-red-200">
            No source
          </span>
        )}
      </div>
      <p className={`text-xs font-bold truncate ${isMissing ? "text-red-800" : "text-ink"}`}>{display}</p>
    </button>
  );
}

export function EntrySummaryReviewPanel({
  shipmentId,
  canGenerate,
  canApprove,
  canExport,
}: {
  shipmentId: string;
  canGenerate: boolean;
  canApprove: boolean;
  canExport: boolean;
}) {
  const [draft, setDraft] = useState<DraftEnvelope | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [regenerating, setRegenerating] = useState(false);
  const [staleBanner, setStaleBanner] = useState<{ shown: number; latest: number } | null>(null);

  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  const [selectedField, setSelectedField] = useState<FieldLike | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/entry-summary`);
      const data = await res.json().catch(() => null);
      if (res.status === 404) {
        setDraft(null);
        return;
      }
      if (!res.ok) throw new Error(errorFromResponse(data, "Failed to load the 7501 entry summary draft."));
      setDraft(data.draft);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipmentId]);

  async function handleGenerate(isRegenerate: boolean) {
    setRegenerating(true);
    setError(null);
    setStaleBanner(null);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/entry-summary`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorFromResponse(data, "Failed to generate the 7501 entry summary draft."));
      const newVersion: number = data.draft.version;
      if (isRegenerate && draft && newVersion !== draft.version) {
        setStaleBanner({ shown: draft.version, latest: newVersion });
      }
      setDraft(data.draft);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRegenerating(false);
    }
  }

  async function handleApprove() {
    if (!draft) return;
    setApproving(true);
    setApproveError(null);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/entry-summary/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: draft.version }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorFromResponse(data, "Approval failed."));
      setDraft((prev) => (prev ? { ...prev, approvedAt: data.draft.approvedAt, approvedBy: data.draft.approvedBy } : prev));
    } catch (err: unknown) {
      setApproveError(err instanceof Error ? err.message : String(err));
    } finally {
      setApproving(false);
    }
  }

  if (loading && !draft) {
    return <p className="text-xs text-ink-muted animate-pulse">Loading the validated 7501 draft…</p>;
  }

  if (error && !draft) {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </p>
        {canGenerate && (
          <Button variant="secondary" onClick={() => handleGenerate(false)} loading={regenerating}>
            <RefreshCw className="w-3.5 h-3.5" />
            Generate Draft
          </Button>
        )}
      </div>
    );
  }

  if (!draft) {
    return (
      <Card className="text-center py-10 space-y-3">
        <p className="text-xs text-ink-muted">No validated 7501 entry summary draft has been generated for this shipment yet.</p>
        {canGenerate ? (
          <Button onClick={() => handleGenerate(false)} loading={regenerating}>
            <RefreshCw className="w-3.5 h-3.5" />
            Generate Draft
          </Button>
        ) : (
          <p className="text-[11px] text-ink-muted">You do not have permission to generate a draft.</p>
        )}
      </Card>
    );
  }

  const headerFields = HEADER_BLOCK_IDS.map((id: Block) => draft.draftData.header.fields[id]).filter(Boolean);
  const lineBlockOrder = LINE_BLOCK_IDS as readonly string[];

  return (
    <div className="space-y-4">
      {staleBanner && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-900">
          Regenerated: showing v{staleBanner.latest} (previously v{staleBanner.shown}).
        </div>
      )}

      {/* Summary bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-border shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-extrabold text-ink">Validated 7501 Entry Summary Draft — v{draft.version}</h3>
            {draft.approvedAt ? (
              <Badge variant="success">Approved</Badge>
            ) : draft.isExportable ? (
              <Badge variant="warning">Pending Approval</Badge>
            ) : (
              <Badge variant="danger">Blocked</Badge>
            )}
            {draft.supersededAt && <Badge variant="neutral">Superseded</Badge>}
          </div>
          <p className="text-xs text-ink-muted">
            Generated {new Date(draft.draftData.generatedAt).toLocaleString()}
            {draft.approvedAt ? ` · Approved ${new Date(draft.approvedAt).toLocaleString()} by ${draft.approvedBy}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canGenerate && (
            <Button variant="secondary" size="sm" onClick={() => handleGenerate(true)} loading={regenerating}>
              <RefreshCw className="w-3.5 h-3.5" />
              Regenerate
            </Button>
          )}
          {canApprove && !draft.approvedAt && (
            <span
              title={
                draft.isExportable
                  ? "Approve this draft for export."
                  : `Cannot approve: ${draft.blockingCount} blocking finding${draft.blockingCount === 1 ? "" : "s"} must be resolved first.`
              }
            >
              <Button size="sm" onClick={handleApprove} loading={approving} disabled={!draft.isExportable}>
                <ShieldCheck className="w-3.5 h-3.5" />
                Approve Draft
              </Button>
            </span>
          )}
        </div>
      </div>

      {approveError && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {approveError}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {/* Validation panel */}
      <EntrySummaryValidationPanel
        findings={draft.validationData.findings}
        blockingCount={draft.blockingCount}
        warningCount={draft.warningCount}
        shipmentId={shipmentId}
      />

      {/* Header blocks */}
      <Card className="space-y-3">
        <h3 className="text-xs font-extrabold text-ink uppercase tracking-wider">Header Blocks</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {headerFields.map((field) => (
            <FieldTile key={field.blockId} field={field} onOpen={setSelectedField} />
          ))}
        </div>
      </Card>

      {/* Line items */}
      {draft.draftData.lines.length > 0 && (
        <Card className="space-y-4">
          <h3 className="text-xs font-extrabold text-ink uppercase tracking-wider">Line Items</h3>
          <div className="space-y-4">
            {draft.draftData.lines.map((line) => (
              <div key={line.lineNumber} className="space-y-2">
                <p className="text-xs font-bold text-ink">
                  Line {line.lineNumber}
                  {line.parentLineNumber != null && (
                    <span className="ml-1.5 text-[10px] font-bold uppercase text-ink-muted">(Ch. 99 child of line {line.parentLineNumber})</span>
                  )}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {lineBlockOrder
                    .map((id) => line.fields[id])
                    .filter(Boolean)
                    .map((field) => (
                      <FieldTile key={`${line.lineNumber}-${field.blockId}`} field={field} onOpen={setSelectedField} />
                    ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ABI filer export */}
      <FilerExportPanel
        shipmentId={shipmentId}
        isExportable={draft.isExportable}
        blockingCount={draft.blockingCount}
        warningCount={draft.warningCount}
        approvedAt={draft.approvedAt}
        canExport={canExport}
      />

      {selectedField && (
        <EntrySummaryProvenancePopover
          target={{ blockId: selectedField.blockId, value: selectedField.value, provenance: selectedField.provenance }}
          onClose={() => setSelectedField(null)}
        />
      )}
    </div>
  );
}
