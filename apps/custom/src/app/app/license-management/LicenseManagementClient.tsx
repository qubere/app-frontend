"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShieldCheck, RefreshCw, Plus, PlayCircle, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardHeaderIcon, Button, Badge, Input, Select, Label, FormField, Modal } from "@/components/ui";

interface LicenseSummary {
  id: string;
  licenseNumber: string;
  licenseType: string;
  agency: string | null;
  jurisdiction: string | null;
  status: "DRAFT" | "ACTIVE" | "SUSPENDED" | "EXPIRED" | "REVOKED" | "CLOSED";
  effectiveDate: string;
  expirationDate: string | null;
  _count?: { lines: number };
}

interface DeterminationResult {
  id: string;
  status: string;
  baseDecision: string;
  finalDecision: string;
  reason: string;
  missingInputs?: string[] | null;
}

interface LicenseAlert {
  type: string;
  licenseId: string;
  licenseNumber: string;
  lineNumber?: number;
  message: string;
}

type TriStateOption = "UNKNOWN" | "TRUE" | "FALSE";

const CONDITION_LABELS = {
  governmentEndUser: "Foreign government end-user",
  militaryEndUser: "Military end-user",
  usSubsidiary: "End-user is a U.S. subsidiary of the exporter",
  endUserCertificateOnFile: "End-user certificate/letter of assurance on file",
  customsFreeZone: "Destination is within a customs free zone",
  internalUseOnly: "Product is for internal company use/product development only",
  replacementPartsIndicator: "Item is intended as replacement parts",
  encryptionItem: "Item is an encryption item",
  encryptionSelfClassified: "Encryption self-classification on file",
  militaryEndUseCountry: "Military end-use country involved",
  nuclearEndUse: "Nuclear end use",
  missileTechnologyEndUse: "Missile technology end use",
  chemicalBiologicalEndUse: "Chemical or biological weapons end use",
} as const;

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  ACTIVE: "success",
  DRAFT: "neutral",
  SUSPENDED: "warning",
  EXPIRED: "danger",
  REVOKED: "danger",
  CLOSED: "neutral",
};

const RESULT_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  NO_LICENSE_REQUIRED: "success",
  LICENSE_EXCEPTION_APPLIES: "success",
  LICENSE_REQUIRED: "warning",
  REVIEW_REQUIRED: "warning",
  RULE_DATA_UNAVAILABLE: "warning",
  INCOMPLETE: "warning",
  INVALID_CLASSIFICATION: "danger",
  UNSUPPORTED_JURISDICTION: "danger",
  BLOCKED: "danger",
  ERROR: "danger",
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message ?? body?.error ?? `Request failed (${res.status})`);
  return body as T;
}

export function LicenseManagementClient({
  canCreate,
  canExecuteDetermination,
  canViewDetermination,
  canViewAlerts,
}: {
  canCreate: boolean;
  canExecuteDetermination: boolean;
  canViewDetermination: boolean;
  canViewAlerts: boolean;
}) {
  const tabs = useMemo(() => {
    const list: Array<"licenses" | "determination" | "alerts"> = ["licenses"];
    if (canViewDetermination) list.push("determination");
    if (canViewAlerts) list.push("alerts");
    return list;
  }, [canViewDetermination, canViewAlerts]);

  const [tab, setTab] = useState<"licenses" | "determination" | "alerts">("licenses");
  const [licenses, setLicenses] = useState<LicenseSummary[]>([]);
  const [alerts, setAlerts] = useState<LicenseAlert[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newLicense, setNewLicense] = useState({ licenseNumber: "", licenseType: "BIS_LICENSE", effectiveDate: "" });

  const [detForm, setDetForm] = useState({
    operationType: "EXPORT" as "EXPORT" | "IMPORT",
    classificationType: "ECCN",
    classificationValue: "",
    destinationCountry: "",
    originCountry: "",
  });
  const [detConditions, setDetConditions] = useState({
    governmentEndUser: "UNKNOWN" as TriStateOption,
    militaryEndUser: "UNKNOWN" as TriStateOption,
    usSubsidiary: "UNKNOWN" as TriStateOption,
    endUserCertificateOnFile: "UNKNOWN" as TriStateOption,
    customsFreeZone: "UNKNOWN" as TriStateOption,
    internalUseOnly: "UNKNOWN" as TriStateOption,
    replacementPartsIndicator: "UNKNOWN" as TriStateOption,
    encryptionItem: "UNKNOWN" as TriStateOption,
    encryptionSelfClassified: "UNKNOWN" as TriStateOption,
    militaryEndUseCountry: "UNKNOWN" as TriStateOption,
    nuclearEndUse: "UNKNOWN" as TriStateOption,
    missileTechnologyEndUse: "UNKNOWN" as TriStateOption,
    chemicalBiologicalEndUse: "UNKNOWN" as TriStateOption,
  });
  const [detReferenceNumbers, setDetReferenceNumbers] = useState({ zNumber: "", ccatsNumber: "" });
  const [detResult, setDetResult] = useState<DeterminationResult | null>(null);

  const loadLicenses = () => {
    fetchJson<{ licenses: LicenseSummary[] }>("/api/compliance/licenses")
      .then((data) => setLicenses(data.licenses))
      .catch((err) => setError(err.message));
  };
  const loadAlerts = () => {
    fetchJson<{ alerts: LicenseAlert[] }>("/api/compliance/license-alerts")
      .then((data) => setAlerts(data.alerts))
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    if (tab === "licenses") loadLicenses();
    if (tab === "alerts") loadAlerts();
  }, [tab]);

  const createLicense = async () => {
    setBusy(true);
    setError(null);
    try {
      await fetchJson("/api/compliance/licenses", {
        method: "POST",
        body: JSON.stringify(newLicense),
      });
      setCreateOpen(false);
      setNewLicense({ licenseNumber: "", licenseType: "BIS_LICENSE", effectiveDate: "" });
      loadLicenses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create license.");
    } finally {
      setBusy(false);
    }
  };

  const runDetermination = async () => {
    setBusy(true);
    setError(null);
    setDetResult(null);
    try {
      const conditions: Record<string, string> = {};
      for (const [key, val] of Object.entries(detConditions)) {
        if (val !== "UNKNOWN") conditions[key] = val;
      }
      if (detReferenceNumbers.zNumber.trim()) conditions.encryptionExceptionZNumber = detReferenceNumbers.zNumber.trim();
      if (detReferenceNumbers.ccatsNumber.trim()) conditions.encryptionExceptionCcatsNumber = detReferenceNumbers.ccatsNumber.trim();

      const data = await fetchJson<{ determination: { id: string; outcome: DeterminationResult } }>(
        "/api/compliance/license-determination",
        {
          method: "POST",
          body: JSON.stringify({
            operationType: detForm.operationType,
            classification: { type: detForm.classificationType, value: detForm.classificationValue },
            destinationCountry: detForm.destinationCountry || undefined,
            originCountry: detForm.originCountry || undefined,
            conditions: Object.keys(conditions).length > 0 ? conditions : undefined,
          }),
        }
      );
      setDetResult({ ...data.determination.outcome, id: data.determination.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Determination failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardHeaderIcon>
            <ShieldCheck className="w-5 h-5" />
          </CardHeaderIcon>
          <div>
            <h1 className="text-lg font-bold text-ink">License Management</h1>
            <p className="text-sm text-ink-muted">
              Export/import license determination, managed license portfolio, and utilization tracking.
            </p>
          </div>
        </CardHeader>

        <div className="flex gap-2 mb-6">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                tab === t ? "bg-brand text-white" : "bg-surface-muted text-ink-muted hover:bg-border"
              }`}
            >
              {t === "licenses" ? "Licenses" : t === "determination" ? "Run Determination" : "Alerts"}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {tab === "licenses" && (
          <div>
            <div className="flex justify-end gap-2 mb-3">
              <Button variant="secondary" size="sm" onClick={loadLicenses}>
                <RefreshCw className="w-4 h-4" /> Refresh
              </Button>
              {canCreate && (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="w-4 h-4" /> New License
                </Button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-ink-muted border-b border-border">
                    <th className="py-2 pr-4">License #</th>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">Agency</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Expires</th>
                    <th className="py-2 pr-4">Lines</th>
                  </tr>
                </thead>
                <tbody>
                  {licenses.map((license) => (
                    <tr key={license.id} className="border-b border-border/60">
                      <td className="py-2 pr-4">
                        <Link href={`/app/license-management/${license.id}`} className="font-semibold text-brand hover:underline">
                          {license.licenseNumber}
                        </Link>
                      </td>
                      <td className="py-2 pr-4">{license.licenseType}</td>
                      <td className="py-2 pr-4">{license.agency ?? "—"}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={STATUS_TONE[license.status] ?? "neutral"}>{license.status}</Badge>
                      </td>
                      <td className="py-2 pr-4">{license.expirationDate ? new Date(license.expirationDate).toLocaleDateString() : "—"}</td>
                      <td className="py-2 pr-4">{license._count?.lines ?? 0}</td>
                    </tr>
                  ))}
                  {licenses.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-ink-muted">
                        No managed licenses yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "determination" && (
          <div className="max-w-xl space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField>
                <Label>Operation</Label>
                <Select
                  value={detForm.operationType}
                  onChange={(e) => setDetForm((f) => ({ ...f, operationType: e.target.value as "EXPORT" | "IMPORT" }))}
                >
                  <option value="EXPORT">Export</option>
                  <option value="IMPORT">Import</option>
                </Select>
              </FormField>
              <FormField>
                <Label>Classification Type</Label>
                <Select
                  value={detForm.classificationType}
                  onChange={(e) => setDetForm((f) => ({ ...f, classificationType: e.target.value }))}
                >
                  {["ECCN", "USML", "HTS", "SCHEDULE_B", "ICN"].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
            <FormField>
              <Label>
                Classification Value <span className="text-red-600">*</span>
              </Label>
              <Input
                value={detForm.classificationValue}
                onChange={(e) => setDetForm((f) => ({ ...f, classificationValue: e.target.value }))}
                placeholder="e.g. 5A002.a.1"
              />
            </FormField>
            {detForm.operationType === "EXPORT" ? (
              <FormField>
                <Label>
                  Destination Country <span className="text-red-600">*</span>
                </Label>
                <Input
                  value={detForm.destinationCountry}
                  onChange={(e) => setDetForm((f) => ({ ...f, destinationCountry: e.target.value }))}
                  placeholder="ISO country code"
                />
              </FormField>
            ) : (
              <FormField>
                <Label>
                  Origin Country <span className="text-red-600">*</span>
                </Label>
                <Input
                  value={detForm.originCountry}
                  onChange={(e) => setDetForm((f) => ({ ...f, originCountry: e.target.value }))}
                  placeholder="ISO country code"
                />
              </FormField>
            )}

            <div className="space-y-2">
              <Label>End-Use / End-User Conditions</Label>
              <div className="grid grid-cols-1 gap-2 rounded-xl border border-border p-3">
                {Object.entries(CONDITION_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-ink">{label}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      {(["UNKNOWN", "TRUE", "FALSE"] as const).map((option) => (
                        <label key={option} className="flex items-center gap-1.5 text-xs font-medium text-ink cursor-pointer">
                          <input
                            type="radio"
                            name={`condition-${key}`}
                            checked={detConditions[key as keyof typeof detConditions] === option}
                            onChange={() => setDetConditions((c) => ({ ...c, [key]: option }))}
                            className="w-3.5 h-3.5 text-brand focus:ring-brand cursor-pointer"
                          />
                          {option === "UNKNOWN" ? "Unknown" : option === "TRUE" ? "Yes" : "No"}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField>
                <Label>Encryption Exception ZNumber</Label>
                <Input
                  value={detReferenceNumbers.zNumber}
                  onChange={(e) => setDetReferenceNumbers((r) => ({ ...r, zNumber: e.target.value }))}
                  placeholder="e.g. Z123456"
                />
              </FormField>
              <FormField>
                <Label>CCATS Number</Label>
                <Input
                  value={detReferenceNumbers.ccatsNumber}
                  onChange={(e) => setDetReferenceNumbers((r) => ({ ...r, ccatsNumber: e.target.value }))}
                  placeholder="e.g. G123456"
                />
              </FormField>
            </div>

            <Button onClick={runDetermination} disabled={busy || !canExecuteDetermination || !detForm.classificationValue}>
              <PlayCircle className="w-4 h-4" /> Run Determination
            </Button>

            {detResult && (
              <div className="rounded-xl border border-border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant={RESULT_TONE[detResult.status] ?? "neutral"}>{detResult.status}</Badge>
                  {detResult.baseDecision !== detResult.finalDecision && (
                    <span className="text-xs text-ink-muted">
                      base: {detResult.baseDecision} → final: {detResult.finalDecision}
                    </span>
                  )}
                </div>
                <p className="text-sm text-ink">{detResult.reason}</p>
                {detResult.missingInputs && detResult.missingInputs.length > 0 && (
                  <p className="text-xs text-ink-muted">Missing: {detResult.missingInputs.join(", ")}</p>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "alerts" && (
          <div>
            <div className="flex justify-end mb-3">
              <Button variant="secondary" size="sm" onClick={loadAlerts}>
                <RefreshCw className="w-4 h-4" /> Refresh
              </Button>
            </div>
            <div className="space-y-2">
              {alerts.map((alert, idx) => (
                <div key={idx} className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <Badge variant="warning">{alert.type.replaceAll("_", " ")}</Badge>
                    <p className="mt-1">{alert.message}</p>
                  </div>
                </div>
              ))}
              {alerts.length === 0 && <p className="text-sm text-ink-muted">No active license alerts.</p>}
            </div>
          </div>
        )}
      </Card>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)}>
        <h2 id="modal-title" className="text-lg font-bold text-ink">
          New Managed License
        </h2>
        <div className="space-y-3">
          <FormField>
            <Label>License Number</Label>
            <Input
              value={newLicense.licenseNumber}
              onChange={(e) => setNewLicense((f) => ({ ...f, licenseNumber: e.target.value }))}
            />
          </FormField>
          <FormField>
            <Label>License Type</Label>
            <Select
              value={newLicense.licenseType}
              onChange={(e) => setNewLicense((f) => ({ ...f, licenseType: e.target.value }))}
            >
              {["BIS_LICENSE", "DDTC_LICENSE", "OFAC_LICENSE", "GENERIC_EXCEPTION", "OTHER"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField>
            <Label>Effective Date</Label>
            <Input
              type="date"
              value={newLicense.effectiveDate}
              onChange={(e) => setNewLicense((f) => ({ ...f, effectiveDate: e.target.value }))}
            />
          </FormField>
          <Button onClick={createLicense} disabled={busy || !newLicense.licenseNumber || !newLicense.effectiveDate}>
            Create License
          </Button>
        </div>
      </Modal>
    </div>
  );
}
