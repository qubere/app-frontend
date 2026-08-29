"use client";

// Bulk Compliance Screening -- workspace-tab wrapper around the existing
// BulkScreeningListClient (originally built as a standalone page). Fetches
// its own initial page client-side, mirroring CommunityScreeningPanel /
// RdpsPanel's fetch-on-mount pattern so this tab never depends on the
// compliance page.tsx server-side data-fetch branches.
import { useEffect, useState } from "react";
import { BulkScreeningListClient } from "./bulk-screening/BulkScreeningListClient";

interface BulkScreeningPanelProps {
  mayCreate: boolean;
  mayImportPreApprovals: boolean;
}

const PAGE_SIZE = 20;

export function BulkScreeningPanel({ mayCreate, mayImportPreApprovals }: BulkScreeningPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<{ batches: any[]; total: number; page: number; pageSize: number } | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/compliance/batches?page=1&pageSize=${PAGE_SIZE}`);
        if (!res.ok) {
          if (!cancelled) setError("Failed to load Bulk Compliance Screening batches.");
          return;
        }
        const body = await res.json();
        if (!cancelled) {
          setInitialData({ batches: body.batches ?? [], total: body.total ?? 0, page: body.page ?? 1, pageSize: body.pageSize ?? PAGE_SIZE });
        }
      } catch {
        if (!cancelled) setError("Failed to load Bulk Compliance Screening batches.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-ink-muted">Loading Bulk Compliance Screening batches...</p>;
  }
  if (error || !initialData) {
    return <p className="text-sm text-red-600">{error ?? "Unable to load batches."}</p>;
  }

  return (
    <BulkScreeningListClient
      initialBatches={initialData.batches}
      initialTotal={initialData.total}
      initialPage={initialData.page}
      initialPageSize={initialData.pageSize}
      mayCreate={mayCreate}
      mayImportPreApprovals={mayImportPreApprovals}
    />
  );
}
