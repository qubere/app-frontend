"use client";

// Bulk Compliance Screening -- batch detail: summary counters, action bar
// (cancel/retry/rescreen/download), and a paginated records table.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { displayDate } from "@/lib/honest";

interface BatchDetail {
  id: string;
  batchType: string;
  processingStatus: string;
  complianceStatus: string;
  originalFileName: string;
  totalRecords: number;
  validRecords: number;
  processedRecords: number;
  passedRecords: number;
  failedRecords: number;
  reviewRecords: number;
  incompleteRecords: number;
  errorRecords: number;
  createdAt: string;
  completedAt: string | null;
}

interface RecordRow {
  id: string;
  recordNumber: number;
  transactionId: string | null;
  processingStatus: string;
  complianceStatus: string;
  errorCode: string | null;
  errorMessage: string | null;
  rpsResultId: string | null;
  licenseDeterminationResultId: string | null;
  embargoStatus: string | null;
  classificationStatus: string | null;
  classificationHtsCode: string | null;
  normalizedInput: unknown;
  startedAt: string | null;
  completedAt: string | null;
}

interface ArtifactRow {
  id: string;
  artifactType: string;
  originalFileName: string | null;
}

interface BulkScreeningDetailClientProps {
  batchId: string;
  initialBatch: BatchDetail;
  initialRecords: RecordRow[];
  initialTotal: number;
  initialPage: number;
  initialPageSize: number;
  mayCancel: boolean;
  mayRetry: boolean;
  mayRescreen: boolean;
  mayDownload: boolean;
  artifacts: ArtifactRow[];
}

function processingBadgeVariant(status: string): BadgeProps["variant"] {
  if (status === "COMPLETED") return "success";
  if (status === "FAILED" || status === "VALIDATION_FAILED" || status === "CANCELLED" || status === "ERROR") return "danger";
  if (status === "PROCESSING" || status === "READY" || status === "QUEUED" || status === "VALIDATING" || status === "PENDING") return "warning";
  return "neutral";
}

function complianceBadgeVariant(status: string): BadgeProps["variant"] {
  if (status === "PASSED") return "success";
  if (status === "FAILED" || status === "COMPLETED_WITH_ERRORS" || status === "ERROR") return "danger";
  if (status === "REVIEW_REQUIRED" || status === "INCOMPLETE" || status === "COMPLETED_WITH_FINDINGS") return "warning";
  return "neutral";
}

const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "CANCELLED", "EXPIRED"]);

export function BulkScreeningDetailClient({
  batchId,
  initialBatch,
  initialRecords,
  initialTotal,
  initialPage,
  initialPageSize,
  mayCancel,
  mayRetry,
  mayRescreen,
  mayDownload,
  artifacts,
}: BulkScreeningDetailClientProps) {
  const [batch, setBatch] = useState(initialBatch);
  const [records, setRecords] = useState(initialRecords);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<RecordRow | null>(null);

  const refresh = useCallback(async () => {
    const [batchRes, recordsRes] = await Promise.all([
      fetch(`/api/compliance/batches/${batchId}`),
      fetch(`/api/compliance/batches/${batchId}/records?page=${page}&pageSize=${initialPageSize}`),
    ]);
    if (batchRes.ok) {
      const body = await batchRes.json();
      setBatch((current) => ({
        ...current,
        ...body.batch,
        createdAt: body.batch.createdAt,
        completedAt: body.batch.completedAt,
      }));
    }
    if (recordsRes.ok) {
      const body = await recordsRes.json();
      setRecords(body.records ?? []);
      setTotal(body.total ?? 0);
    }
  }, [batchId, page, initialPageSize]);

  // Pagination buttons only update `page`; this effect performs the actual
  // records re-fetch whenever the page changes (skips the very first render,
  // which is already server-rendered via initialRecords).
  const [hasMountedPageEffect, setHasMountedPageEffect] = useState(false);
  useEffect(() => {
    if (!hasMountedPageEffect) {
      setHasMountedPageEffect(true);
      return;
    }
    (async () => {
      const res = await fetch(`/api/compliance/batches/${batchId}/records?page=${page}&pageSize=${initialPageSize}`);
      if (res.ok) {
        const body = await res.json();
        setRecords(body.records ?? []);
        setTotal(body.total ?? 0);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function runAction(action: "cancel" | "retry" | "rescreen") {
    setActionPending(action);
    setActionError(null);
    try {
      const res = await fetch(`/api/compliance/batches/${batchId}/${action}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setActionError(body.error?.message ?? `Failed to ${action} batch.`);
        return;
      }
      await refresh();
    } finally {
      setActionPending(null);
    }
  }

  async function onDownload(artifactId: string) {
    const res = await fetch(`/api/compliance/batches/${batchId}/artifacts/${artifactId}/download`);
    if (!res.ok) return;
    const body = await res.json();
    window.open(body.downloadUrl, "_blank", "noopener,noreferrer");
  }

  const totalPages = Math.max(1, Math.ceil(total / initialPageSize));
  const isTerminal = TERMINAL_STATUSES.has(batch.processingStatus);

  return (
    <>
      <div>
        <Link href="/app/compliance/bulk-screening" className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Bulk Compliance Screening
        </Link>
        <div className="flex items-center justify-between gap-3 mt-1 flex-wrap">
          <h1 className="text-2xl font-extrabold text-ink tracking-tight">{batch.originalFileName}</h1>
          <div className="flex items-center gap-2">
            {mayCancel && !isTerminal && (
              <Button variant="secondary" disabled={actionPending !== null} onClick={() => runAction("cancel")}>
                {actionPending === "cancel" ? "Cancelling..." : "Cancel"}
              </Button>
            )}
            {mayRetry && batch.errorRecords > 0 && (batch.processingStatus === "COMPLETED" || batch.processingStatus === "FAILED") && (
              <Button variant="secondary" disabled={actionPending !== null} onClick={() => runAction("retry")}>
                {actionPending === "retry" ? "Retrying..." : "Retry errors"}
              </Button>
            )}
            {mayRescreen && (batch.processingStatus === "COMPLETED" || batch.processingStatus === "FAILED") && (
              <Button disabled={actionPending !== null} onClick={() => runAction("rescreen")}>
                {actionPending === "rescreen" ? "Rescreening..." : "Rescreen all"}
              </Button>
            )}
          </div>
        </div>
        {actionError && <p className="text-sm text-red-600 mt-2">{actionError}</p>}
      </div>

      {mayDownload && artifacts.length > 0 && (
        <Card className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-muted mr-1">Downloads:</span>
          {artifacts.map((a) => (
            <Button key={a.id} variant="secondary" onClick={() => onDownload(a.id)}>
              <Download className="w-3.5 h-3.5 mr-1.5" /> {a.artifactType.replace(/_/g, " ").toLowerCase()}
            </Button>
          ))}
        </Card>
      )}

      <Card className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">Status</div>
          <Badge variant={processingBadgeVariant(batch.processingStatus)}>{batch.processingStatus}</Badge>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">Compliance</div>
          <Badge variant={complianceBadgeVariant(batch.complianceStatus)}>{batch.complianceStatus}</Badge>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">Records</div>
          <div className="text-sm font-semibold text-ink">
            {batch.processedRecords}/{batch.validRecords} processed
          </div>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">Created</div>
          <div className="text-sm text-ink">{displayDate(batch.createdAt)}</div>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">Passed</div>
          <div className="text-sm font-semibold text-emerald-700">{batch.passedRecords}</div>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">Failed</div>
          <div className="text-sm font-semibold text-red-600">{batch.failedRecords}</div>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">Review</div>
          <div className="text-sm font-semibold text-amber-700">{batch.reviewRecords}</div>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">Errors</div>
          <div className="text-sm font-semibold text-red-600">{batch.errorRecords}</div>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-bold uppercase tracking-wider text-ink-muted border-b border-border">
              <th className="py-2 pr-4">#</th>
              <th className="py-2 pr-4">Transaction ID</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Compliance</th>
              <th className="py-2 pr-4">Error</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr
                key={r.id}
                className="border-b border-border last:border-0 cursor-pointer hover:bg-surface-muted/50"
                onClick={() => setSelectedRecord(r)}
              >
                <td className="py-2 pr-4">{r.recordNumber}</td>
                <td className="py-2 pr-4 font-mono text-xs">{r.transactionId ?? "—"}</td>
                <td className="py-2 pr-4">
                  <Badge variant={processingBadgeVariant(r.processingStatus)}>{r.processingStatus}</Badge>
                </td>
                <td className="py-2 pr-4">
                  <Badge variant={complianceBadgeVariant(r.complianceStatus)}>{r.complianceStatus}</Badge>
                </td>
                <td className="py-2 pr-4 text-xs text-red-600">{r.errorMessage ?? ""}</td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-ink-muted">
                  No records.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-ink-muted">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <span>
            Page {page} of {totalPages}
          </span>
          <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      <Modal isOpen={selectedRecord !== null} onClose={() => setSelectedRecord(null)}>
        {selectedRecord && (
          <>
            <ModalHeader>Record #{selectedRecord.recordNumber}</ModalHeader>
            <ModalBody className="space-y-3 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">Transaction ID</div>
                  <div className="font-mono text-xs">{selectedRecord.transactionId ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">Processing status</div>
                  <Badge variant={processingBadgeVariant(selectedRecord.processingStatus)}>{selectedRecord.processingStatus}</Badge>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">Compliance status</div>
                  <Badge variant={complianceBadgeVariant(selectedRecord.complianceStatus)}>{selectedRecord.complianceStatus}</Badge>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">Completed</div>
                  <div className="text-sm">{selectedRecord.completedAt ? displayDate(selectedRecord.completedAt) : "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">RPS result ID</div>
                  <div className="font-mono text-xs">{selectedRecord.rpsResultId ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">License determination ID</div>
                  <div className="font-mono text-xs">{selectedRecord.licenseDeterminationResultId ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">Embargo status</div>
                  <div className="font-mono text-xs">{selectedRecord.embargoStatus ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">Classification status</div>
                  <div className="font-mono text-xs">{selectedRecord.classificationStatus ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">Classification HTS code</div>
                  <div className="font-mono text-xs">{selectedRecord.classificationHtsCode ?? "—"}</div>
                </div>
              </div>
              {(selectedRecord.errorCode || selectedRecord.errorMessage) && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">Error</div>
                  <div className="text-sm text-red-600">
                    {selectedRecord.errorCode ? `[${selectedRecord.errorCode}] ` : ""}
                    {selectedRecord.errorMessage}
                  </div>
                </div>
              )}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-1">Normalized input</div>
                <pre className="text-xs bg-surface-muted rounded-md p-3 overflow-x-auto">
                  {JSON.stringify(selectedRecord.normalizedInput, null, 2)}
                </pre>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="secondary" onClick={() => setSelectedRecord(null)}>
                Close
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>
    </>
  );
}
