"use client";

// Bulk Compliance Screening -- batch list + upload dialog. Initial page is
// server-rendered by page.tsx; pagination/refresh re-fetches from
// /api/compliance/batches like every other client panel in this app.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UploadCloud } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { displayDate } from "@/lib/honest";

interface BatchSummary {
  id: string;
  batchType: string;
  processingStatus: string;
  complianceStatus: string;
  originalFileName: string;
  totalRecords: number;
  validRecords: number;
  passedRecords: number;
  failedRecords: number;
  reviewRecords: number;
  errorRecords: number;
  createdAt: string;
}

interface ColumnMappingTemplateSummary {
  id: string;
  name: string;
  fieldMappings: Record<string, string>;
}

interface BulkScreeningListClientProps {
  initialBatches: BatchSummary[];
  initialTotal: number;
  initialPage: number;
  initialPageSize: number;
  mayCreate: boolean;
  mayImportPreApprovals: boolean;
}

function processingBadgeVariant(status: string): BadgeProps["variant"] {
  if (status === "COMPLETED") return "success";
  if (status === "FAILED" || status === "VALIDATION_FAILED" || status === "CANCELLED") return "danger";
  if (status === "PROCESSING" || status === "READY" || status === "QUEUED" || status === "VALIDATING") return "warning";
  return "neutral";
}

function complianceBadgeVariant(status: string): BadgeProps["variant"] {
  if (status === "PASSED") return "success";
  if (status === "COMPLETED_WITH_ERRORS") return "danger";
  if (status === "COMPLETED_WITH_FINDINGS") return "warning";
  return "neutral";
}

export function BulkScreeningListClient({
  initialBatches,
  initialTotal,
  initialPage,
  initialPageSize,
  mayCreate,
  mayImportPreApprovals,
}: BulkScreeningListClientProps) {
  const router = useRouter();
  const [batches, setBatches] = useState(initialBatches);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [partyScreening, setPartyScreening] = useState(true);
  const [licenseScreening, setLicenseScreening] = useState(false);
  const [embargoScreening, setEmbargoScreening] = useState(false);
  const [productClassification, setProductClassification] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [palImportOpen, setPalImportOpen] = useState(false);
  const [palImporting, setPalImporting] = useState(false);
  const [palImportError, setPalImportError] = useState<string | null>(null);
  const palFileInputRef = useRef<HTMLInputElement>(null);

  const [templates, setTemplates] = useState<ColumnMappingTemplateSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateMappingsText, setNewTemplateMappingsText] = useState(
    '{\n  "partyName": "Party Name",\n  "destinationCountry": "Destination Country"\n}'
  );
  const [templateSaveError, setTemplateSaveError] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const loadTemplates = useCallback(async () => {
    const res = await fetch("/api/compliance/batches/templates");
    if (res.ok) {
      const body = await res.json();
      setTemplates(body.templates ?? []);
    }
  }, []);

  useEffect(() => {
    if (uploadOpen) loadTemplates();
  }, [uploadOpen, loadTemplates]);

  async function onSaveTemplate() {
    setTemplateSaveError(null);
    let fieldMappings: unknown;
    try {
      fieldMappings = JSON.parse(newTemplateMappingsText);
    } catch {
      setTemplateSaveError("fieldMappings must be valid JSON.");
      return;
    }
    setSavingTemplate(true);
    try {
      const res = await fetch("/api/compliance/batches/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTemplateName, fieldMappings }),
      });
      const body = await res.json();
      if (!res.ok) {
        setTemplateSaveError(body.error?.message ?? "Failed to save template.");
        return;
      }
      setNewTemplateName("");
      await loadTemplates();
      setSelectedTemplateId(body.template.id);
      setTemplateEditorOpen(false);
    } finally {
      setSavingTemplate(false);
    }
  }

  async function onDeleteTemplate(id: string) {
    const res = await fetch(`/api/compliance/batches/templates/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (selectedTemplateId === id) setSelectedTemplateId("");
      await loadTemplates();
    }
  }

  const [statusFilter, setStatusFilter] = useState("");
  const [batchTypeFilter, setBatchTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(
    async (nextPage: number, overrides?: { status?: string; batchType?: string; search?: string }) => {
      setLoading(true);
      try {
        const status = overrides?.status ?? statusFilter;
        const batchType = overrides?.batchType ?? batchTypeFilter;
        const searchTerm = overrides?.search ?? search;
        const params = new URLSearchParams({ page: String(nextPage), pageSize: String(initialPageSize) });
        if (status) params.set("status", status);
        if (batchType) params.set("batchType", batchType);
        if (searchTerm) params.set("search", searchTerm);
        const res = await fetch(`/api/compliance/batches?${params.toString()}`);
        if (res.ok) {
          const body = await res.json();
          setBatches(body.batches ?? []);
          setTotal(body.total ?? 0);
          setPage(body.page ?? nextPage);
        }
      } finally {
        setLoading(false);
      }
    },
    [initialPageSize, statusFilter, batchTypeFilter, search]
  );

  async function onUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setUploadError("Choose a file to upload.");
      return;
    }
    if (!partyScreening && !licenseScreening && !embargoScreening && !productClassification) {
      setUploadError(
        "Enable at least one of Party Screening, License Screening, Embargo Screening, or Product Classification."
      );
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set(
        "servicesEnabled",
        JSON.stringify({ partyScreening, licenseScreening, embargoScreening, productClassification })
      );
      if (selectedTemplateId) form.set("columnMappingTemplateId", selectedTemplateId);

      const res = await fetch("/api/compliance/batches", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) {
        setUploadError(body.error?.message ?? "Upload failed.");
        return;
      }
      setUploadOpen(false);
      router.push(`/app/compliance/bulk-screening/${body.batch.id}`);
    } finally {
      setUploading(false);
    }
  }

  async function onPalImport() {
    const file = palFileInputRef.current?.files?.[0];
    if (!file) {
      setPalImportError("Choose a file to upload.");
      return;
    }

    setPalImporting(true);
    setPalImportError(null);
    try {
      const form = new FormData();
      form.set("file", file);

      const res = await fetch("/api/compliance/batches/pre-approved-party-import", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) {
        setPalImportError(body.error?.message ?? "Import failed.");
        return;
      }
      setPalImportOpen(false);
      router.push(`/app/compliance/bulk-screening/${body.batch.id}`);
    } finally {
      setPalImporting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / initialPageSize));

  function applyFilters(next: { status?: string; batchType?: string; search?: string }) {
    if (next.status !== undefined) setStatusFilter(next.status);
    if (next.batchType !== undefined) setBatchTypeFilter(next.batchType);
    if (next.search !== undefined) setSearch(next.search);
    load(1, next);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Search by filename\u2026"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applyFilters({ search });
          }}
          className="text-sm rounded-md border border-border px-2 py-1.5 w-56"
        />
        <select
          value={statusFilter}
          onChange={(e) => applyFilters({ status: e.target.value })}
          className="text-sm rounded-md border border-border px-2 py-1.5"
        >
          <option value="">All statuses</option>
          <option value="UPLOADED">Uploaded</option>
          <option value="VALIDATING">Validating</option>
          <option value="VALIDATION_FAILED">Validation failed</option>
          <option value="QUEUED">Queued</option>
          <option value="PROCESSING">Processing</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="EXPIRED">Expired</option>
        </select>
        <select
          value={batchTypeFilter}
          onChange={(e) => applyFilters({ batchType: e.target.value })}
          className="text-sm rounded-md border border-border px-2 py-1.5"
        >
          <option value="">All types</option>
          <option value="TRANSACTION_COMPLIANCE">Transaction Compliance</option>
        </select>
        <Button variant="secondary" onClick={() => applyFilters({ search })}>
          Search
        </Button>
        {(statusFilter || batchTypeFilter || search) && (
          <Button
            variant="secondary"
            onClick={() => {
              setStatusFilter("");
              setBatchTypeFilter("");
              setSearch("");
              load(1, { status: "", batchType: "", search: "" });
            }}
          >
            Clear filters
          </Button>
        )}
        {mayImportPreApprovals && (
          <Button variant="secondary" className={mayCreate ? "ml-auto" : ""} onClick={() => setPalImportOpen(true)}>
            <UploadCloud className="w-4 h-4 mr-1.5" /> Bulk pre-approve parties
          </Button>
        )}
        {mayCreate && (
          <Button className={mayImportPreApprovals ? "" : "ml-auto"} onClick={() => setUploadOpen(true)}>
            <UploadCloud className="w-4 h-4 mr-1.5" /> Upload batch
          </Button>
        )}
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-bold uppercase tracking-wider text-ink-muted border-b border-border">
              <th className="py-2 pr-4">File</th>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Compliance</th>
              <th className="py-2 pr-4">Records</th>
              <th className="py-2 pr-4">Findings</th>
              <th className="py-2 pr-4">Created</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id} className="border-b border-border last:border-0 hover:bg-surface-muted/50">
                <td className="py-2 pr-4">
                  <Link href={`/app/compliance/bulk-screening/${b.id}`} className="font-semibold text-brand hover:underline">
                    {b.originalFileName}
                  </Link>
                </td>
                <td className="py-2 pr-4">{b.batchType}</td>
                <td className="py-2 pr-4">
                  <Badge variant={processingBadgeVariant(b.processingStatus)}>{b.processingStatus}</Badge>
                </td>
                <td className="py-2 pr-4">
                  <Badge variant={complianceBadgeVariant(b.complianceStatus)}>{b.complianceStatus}</Badge>
                </td>
                <td className="py-2 pr-4">
                  {b.validRecords}/{b.totalRecords}
                </td>
                <td className="py-2 pr-4 text-xs text-ink-muted">
                  {b.failedRecords} failed &middot; {b.reviewRecords} review &middot; {b.errorRecords} error
                </td>
                <td className="py-2 pr-4 text-xs text-ink-muted">{displayDate(b.createdAt)}</td>
              </tr>
            ))}
            {batches.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-ink-muted">
                  No batches uploaded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-ink-muted">
          <Button variant="secondary" disabled={loading || page <= 1} onClick={() => load(page - 1)}>
            Previous
          </Button>
          <span>
            Page {page} of {totalPages}
          </span>
          <Button variant="secondary" disabled={loading || page >= totalPages} onClick={() => load(page + 1)}>
            Next
          </Button>
        </div>
      )}

      <Modal isOpen={uploadOpen} onClose={() => setUploadOpen(false)}>
        <ModalHeader>Upload Bulk Compliance Screening batch</ModalHeader>
        <ModalBody className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-muted mb-1">File (CSV, XLSX, JSON, or XML)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.json,application/json,.xml,application/xml,text/xml"
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={partyScreening} onChange={(e) => setPartyScreening(e.target.checked)} />
              Party Screening (Restricted Party)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={licenseScreening} onChange={(e) => setLicenseScreening(e.target.checked)} />
              License Screening (License Determination)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={embargoScreening} onChange={(e) => setEmbargoScreening(e.target.checked)} />
              Embargo Screening (Country Embargo)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={productClassification}
                onChange={(e) => setProductClassification(e.target.checked)}
              />
              Product Classification
            </label>
          </div>
          <div className="space-y-2 border-t border-border pt-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-muted mb-1">
              Column mapping template (optional)
            </label>
            <div className="flex items-center gap-2">
              <select
                className="text-sm border border-border rounded px-2 py-1 flex-1"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
              >
                <option value="">None (auto-detect columns)</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {selectedTemplateId && (
                <Button variant="secondary" onClick={() => onDeleteTemplate(selectedTemplateId)}>
                  Delete
                </Button>
              )}
              <Button variant="secondary" onClick={() => setTemplateEditorOpen((v) => !v)}>
                {templateEditorOpen ? "Close" : "New template"}
              </Button>
            </div>
            {templateEditorOpen && (
              <div className="space-y-2 bg-surface-muted p-3 rounded">
                <input
                  type="text"
                  placeholder="Template name"
                  className="text-sm border border-border rounded px-2 py-1 w-full"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                />
                <textarea
                  className="text-sm border border-border rounded px-2 py-1 w-full font-mono"
                  rows={5}
                  value={newTemplateMappingsText}
                  onChange={(e) => setNewTemplateMappingsText(e.target.value)}
                />
                <p className="text-xs text-ink-muted">
                  JSON object mapping canonical field names to your file&apos;s column headers.
                </p>
                {templateSaveError && <p className="text-sm text-red-600">{templateSaveError}</p>}
                <Button onClick={onSaveTemplate} disabled={savingTemplate || !newTemplateName}>
                  {savingTemplate ? "Saving..." : "Save template"}
                </Button>
              </div>
            )}
          </div>
          {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setUploadOpen(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={onUpload} disabled={uploading}>
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={palImportOpen} onClose={() => setPalImportOpen(false)}>
        <ModalHeader>Bulk pre-approve parties</ModalHeader>
        <ModalBody className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-muted mb-1">
              File (CSV)
            </label>
            <input ref={palFileInputRef} type="file" accept=".csv,text/csv" className="text-sm" />
            <p className="text-xs text-ink-muted mt-1">
              Columns: Party ID (required), Reason (optional), Expires At (optional, ISO date). Each row grants the
              same pre-approval as the single-party API -- partyId existence, identity, and reference-data
              freshness are re-checked when the row is processed, never assumed from the file.
            </p>
          </div>
          {palImportError && <p className="text-sm text-red-600">{palImportError}</p>}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setPalImportOpen(false)} disabled={palImporting}>
            Cancel
          </Button>
          <Button onClick={onPalImport} disabled={palImporting}>
            {palImporting ? "Uploading..." : "Upload"}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
