"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import {
  rollupProcessingState,
  isTerminalProcessingState,
  type ProcessingResponse,
  type ProcessingRollup,
} from "@/lib/documents/processingState";

const POLL_MS = 4_000;

const TONE_CLASS: Record<ProcessingRollup["tone"], string> = {
  neutral: "bg-surface-muted text-ink-muted border-border",
  progress: "bg-blue-50 text-blue-700 border-blue-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warn: "bg-amber-50 text-amber-800 border-amber-200",
  error: "bg-red-50 text-red-700 border-red-200",
};

function ToneIcon({ rollup }: { rollup: ProcessingRollup }) {
  if (rollup.polling) return <Loader2 className="h-3 w-3 animate-spin" />;
  if (rollup.tone === "success") return <CheckCircle2 className="h-3 w-3" />;
  if (rollup.tone === "error") return <XCircle className="h-3 w-3" />;
  if (rollup.tone === "warn") return <AlertTriangle className="h-3 w-3" />;
  return <Clock className="h-3 w-3" />;
}

/**
 * A pill that shows where a document is in the parse → extract pipeline and,
 * while it is still moving, polls `/api/documents/{id}/processing` (which also
 * nudges the pipeline forward on read). Click to see the run history.
 *
 * `nonce` — bump it (e.g. after a reprocess) to force an immediate refetch.
 */
export function DocumentProcessingBadge({
  documentId,
  nonce = 0,
  className = "",
}: {
  documentId: string;
  nonce?: number;
  className?: string;
}) {
  const [data, setData] = useState<ProcessingResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}/processing`, { cache: "no-store" });
      if (!res.ok) {
        setError(true);
        return null;
      }
      const body = (await res.json()) as ProcessingResponse;
      setData(body);
      setError(false);
      return body;
    } catch {
      setError(true);
      return null;
    }
  }, [documentId]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const body = await load();
      if (cancelled) return;
      const rollup = rollupProcessingState(body);
      if (rollup.polling) {
        timer.current = setTimeout(tick, POLL_MS);
      }
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load, nonce]);

  const rollup = rollupProcessingState(data);
  const runs = data?.runs ?? [];

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Document processing status — click for details"
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TONE_CLASS[rollup.tone]}`}
      >
        <ToneIcon rollup={rollup} />
        {error && !data ? "Status unavailable" : rollup.label}
      </button>

      {open && (
        <>
          <span className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <span className="absolute right-0 top-full z-20 mt-1 w-80 rounded-xl border border-border bg-white p-3 text-left text-xs shadow-xl">
            <span className="block font-semibold text-ink">{rollup.label}</span>
            {rollup.detail && <span className="mt-0.5 block text-ink-muted">{rollup.detail}</span>}
            {data?.parser?.blocker && (
              <span className="mt-1 block rounded-md bg-red-50 p-1.5 text-red-700">{data.parser.blocker}</span>
            )}
            <span className="mt-2 block border-t border-border pt-2 font-semibold text-ink-muted">
              Runs
            </span>
            {runs.length === 0 ? (
              <span className="block text-ink-muted">No processing runs yet.</span>
            ) : (
              <span className="mt-1 block space-y-1">
                {runs.slice(0, 6).map((r) => (
                  <span key={r.id} className="flex items-center justify-between gap-2">
                    <span className="text-ink-muted">
                      v{r.version} · {String(r.parser?.provider ?? "—")}
                      {r.isActive ? " · active" : ""}
                    </span>
                    <span
                      className={
                        r.status === "SUCCEEDED"
                          ? "text-emerald-700"
                          : r.status === "FAILED"
                            ? "text-red-700"
                            : "text-blue-700"
                      }
                    >
                      {r.status}
                    </span>
                  </span>
                ))}
              </span>
            )}
          </span>
        </>
      )}
    </span>
  );
}

export { isTerminalProcessingState };
