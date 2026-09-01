"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Upload, CheckCircle, AlertTriangle, XCircle, ChevronRight, FileText, FileInput } from "lucide-react";
import { PanelHeading } from "@/components/PanelHeading";
import { Button, Badge } from "@/components/ui";

interface BulkRow {
  legalName: string;
  importerNumberType: string;
  importerNumber?: string;
  [key: string]: string | undefined;
}

interface RowValidation {
  rowIndex: number;
  row: BulkRow;
  errors: string[];
  warnings: string[];
  status: "valid" | "invalid" | "duplicate";
}

interface DryRunResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  validations: RowValidation[];
}

interface CommitResult {
  batchId: string;
  casesCreated: number;
  rowsSkipped: number;
}

const CSV_TEMPLATE = [
  "legal_name,importer_number_type,importer_number,entity_type,address_line1,city,state,postal_code,country,contact_email",
  '"Acme Imports LLC",EIN,12-3456789,LLC,"100 Trade St",Chicago,IL,60601,US,imports@acme.com',
  '"Global Goods Corp",EIN,98-7654321,CORPORATION,"200 Commerce Ave",New York,NY,10001,US,',
].join("\n");

export function BulkImportClient() {
  const [csvText, setCsvText] = useState("");
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
  const [committed, setCommitted] = useState<CommitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipInvalid, setSkipInvalid] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleDryRun() {
    setLoading(true);
    setError(null);
    setDryRun(null);
    setCommitted(null);
    try {
      const res = await fetch("/api/onboarding/import/dry-run", {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: csvText,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Dry-run failed");
      setDryRun(data);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: dryRun?.validations.map((v) => v.row) ?? [],
          skipInvalid,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Commit failed");
      setCommitted(data);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleFileLoad(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target?.result as string ?? "");
    reader.readAsText(file);
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bulk-importer-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const statusBadge = (status: RowValidation["status"]) => {
    if (status === "valid") return <Badge variant="success">Valid</Badge>;
    if (status === "invalid") return <Badge variant="danger">Invalid</Badge>;
    return <Badge variant="warning">Duplicate</Badge>;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link href="/app/onboarding" className="hover:underline">Onboarding</Link>
        <ChevronRight className="w-3 h-3" />
        <span>Bulk import</span>
      </div>

      <PanelHeading
        icon={FileInput}
        badge="Onboarding"
        title="Bulk import importers"
        subtitle="Upload a CSV to create multiple onboarding cases at once. Each valid row becomes a draft case."
      />

      {committed ? (
        <div className="mt-6 rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <h2 className="text-lg font-semibold">Import complete</h2>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="rounded border border-border p-3 text-center">
              <div className="text-2xl font-bold">{committed.casesCreated}</div>
              <div className="text-xs text-muted-foreground mt-1">Cases created</div>
            </div>
            <div className="rounded border border-border p-3 text-center">
              <div className="text-2xl font-bold">{committed.rowsSkipped}</div>
              <div className="text-xs text-muted-foreground mt-1">Rows skipped</div>
            </div>
            <div className="rounded border border-border p-3 text-center">
              <div className="text-mono text-xs pt-3 break-all">{committed.batchId.slice(0, 8)}…</div>
              <div className="text-xs text-muted-foreground mt-1">Batch ID</div>
            </div>
          </div>
          <Link href="/app/onboarding">
            <Button variant="primary">View onboarding cases</Button>
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">1 · Paste CSV or upload a file</h2>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={downloadTemplate}>
                  <FileText className="w-4 h-4 mr-1" />
                  Download template
                </Button>
                <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-1" />
                  Upload file
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFileLoad}
                />
              </div>
            </div>
            <textarea
              className="w-full h-48 rounded border border-border bg-background p-3 font-mono text-xs resize-y"
              placeholder={"legal_name,importer_number_type,importer_number,...\nAcme Imports LLC,EIN,12-3456789,..."}
              value={csvText}
              onChange={(e) => { setCsvText(e.target.value); setDryRun(null); setCommitted(null); }}
            />
            <div className="text-xs text-muted-foreground mt-1">
              Required columns: <code>legal_name</code>, <code>importer_number_type</code> (EIN / SSN / CBP_ASSIGNED), <code>importer_number</code>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleDryRun} disabled={!csvText.trim() || loading} variant="outline">
              {loading ? "Validating…" : "Validate (dry run)"}
            </Button>
            {error && (
              <span className="text-sm text-destructive flex items-center gap-1">
                <XCircle className="w-4 h-4" />
                {error}
              </span>
            )}
          </div>

          {dryRun && (
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center gap-4 mb-4">
                <h2 className="font-semibold">2 · Validation results</h2>
                <div className="flex gap-3 text-sm">
                  <span className="text-green-600 font-medium">{dryRun.validRows} valid</span>
                  <span className="text-red-600 font-medium">{dryRun.invalidRows} invalid</span>
                  <span className="text-yellow-600 font-medium">{dryRun.duplicateRows} duplicate</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="pb-2 pr-4">#</th>
                      <th className="pb-2 pr-4">Legal name</th>
                      <th className="pb-2 pr-4">Importer #</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dryRun.validations.map((v) => (
                      <tr key={v.rowIndex} className="border-b border-border/50 last:border-0">
                        <td className="py-2 pr-4 text-muted-foreground">{v.rowIndex + 1}</td>
                        <td className="py-2 pr-4 font-medium truncate max-w-[200px]">{v.row.legalName || "—"}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{v.row.importerNumber || "—"}</td>
                        <td className="py-2 pr-4">{statusBadge(v.status)}</td>
                        <td className="py-2">
                          {v.errors.map((e, i) => (
                            <div key={i} className="text-xs text-red-600 flex items-start gap-1">
                              <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              {e}
                            </div>
                          ))}
                          {v.warnings.map((w, i) => (
                            <div key={i} className="text-xs text-yellow-600 flex items-start gap-1">
                              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              {w}
                            </div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {dryRun.invalidRows > 0 && (
                <div className="mt-4 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    id="skipInvalid"
                    checked={skipInvalid}
                    onChange={(e) => setSkipInvalid(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="skipInvalid">
                    Skip invalid rows and import the rest ({dryRun.validRows} valid)
                  </label>
                </div>
              )}

              <div className="mt-4 flex gap-3">
                <Button
                  onClick={handleCommit}
                  disabled={loading || (dryRun.validRows === 0 && skipInvalid)}
                  variant="primary"
                >
                  {loading ? "Importing…" : `Import ${skipInvalid ? dryRun.validRows : dryRun.totalRows - dryRun.invalidRows} rows`}
                </Button>
                <Button variant="outline" onClick={() => setDryRun(null)}>
                  Edit CSV
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
