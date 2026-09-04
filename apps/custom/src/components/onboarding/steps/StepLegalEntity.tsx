"use client";

import { useState } from "react";
import { Button, Input, Label, Card, CardHeader } from "@/components/ui";
import { Badge } from "@/components/ui";

type EntityType = "US_CORPORATION" | "LLC" | "PARTNERSHIP" | "SOLE_PROPRIETORSHIP" | "FOREIGN";
type ImporterNumberType = "EIN" | "SSN" | "CBP_ASSIGNED";

interface EntityDraft {
  legalName: string;
  tradeName: string;
  entityType: EntityType;
  importerNumberType: ImporterNumberType;
  importerNumber: string;
  addressLine1: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  residentAgentName: string;
  residentAgentAddress: string;
}

interface ExistingEntity {
  id: string;
  importerNumber: string | null;
  importerNumberType: string;
  legalEntity: { legalName: string; entityType: string; taxIdentifier?: string | null } | null;
}

interface Props {
  caseId: string;
  entities: ExistingEntity[];
  path: string;
  onSaved: () => void;
}

const ENTITY_TYPES: { value: EntityType; label: string }[] = [
  { value: "US_CORPORATION", label: "US Corporation" },
  { value: "LLC", label: "LLC" },
  { value: "PARTNERSHIP", label: "Partnership" },
  { value: "SOLE_PROPRIETORSHIP", label: "Sole proprietorship" },
  { value: "FOREIGN", label: "Foreign entity" },
];

const NUMBER_TYPES: { value: ImporterNumberType; label: string; hint: string }[] = [
  { value: "EIN", label: "EIN", hint: "Format: 12-3456789XX" },
  { value: "SSN", label: "SSN", hint: "Sole proprietors only" },
  { value: "CBP_ASSIGNED", label: "CBP-assigned", hint: "Non-resident — CBP issues on 5106 acceptance" },
];

function einChecksum(ein: string): boolean {
  return /^\d{2}-\d{7}([A-Z0-9]{2})?$/.test(ein.trim());
}

function empty(): EntityDraft {
  return {
    legalName: "", tradeName: "", entityType: "US_CORPORATION",
    importerNumberType: "EIN", importerNumber: "",
    addressLine1: "", city: "", stateProvince: "", postalCode: "", country: "US",
    residentAgentName: "", residentAgentAddress: "",
  };
}

export function StepLegalEntity({ caseId, entities, path, onSaved }: Props) {
  const [draft, setDraft] = useState<EntityDraft>(empty());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const isNonResident = path === "NON_RESIDENT" || draft.entityType === "FOREIGN";

  function set<K extends keyof EntityDraft>(key: K, value: EntityDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setValidationErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!draft.legalName.trim()) errs.legalName = "Legal name is required";
    if (draft.importerNumberType !== "CBP_ASSIGNED" && !draft.importerNumber.trim()) {
      errs.importerNumber = "Importer number is required";
    }
    if (draft.importerNumberType === "EIN" && draft.importerNumber && !einChecksum(draft.importerNumber)) {
      errs.importerNumber = "EIN format should be 12-3456789 or 12-3456789AB";
    }
    if (!draft.addressLine1.trim()) errs.addressLine1 = "Address is required";
    if (!draft.city.trim()) errs.city = "City is required";
    if (!draft.postalCode.trim()) errs.postalCode = "Postal code is required";
    if (isNonResident && !draft.residentAgentName.trim()) {
      errs.residentAgentName = "US resident agent required for non-resident entities";
    }
    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/cases/${caseId}/entities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importerNumberType: draft.importerNumberType,
          importerNumber: draft.importerNumber || null,
          legalName: draft.legalName,
          tradeName: draft.tradeName || null,
          entityType: draft.entityType,
          addressLine1: draft.addressLine1,
          city: draft.city,
          stateProvince: draft.stateProvince,
          postalCode: draft.postalCode,
          country: draft.country,
          residentAgent: isNonResident && draft.residentAgentName
            ? { name: draft.residentAgentName, address: draft.residentAgentAddress }
            : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? "Failed to save entity");
      }
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Legal entity</h2>
        <p className="text-sm text-ink-muted mt-1">
          Capture the importer's legal identity exactly as it appears on IRS/CBP records. This feeds the CBP Form 5106.
        </p>
      </div>

      {entities.length > 0 && (
        <Card>
          <CardHeader>Existing entities</CardHeader>
          <div className="divide-y px-6 pb-4">
            {entities.map((e) => (
              <div key={e.id} className="py-2 flex items-center gap-3 text-sm">
                <div className="flex-1 font-medium">{e.legalEntity?.legalName ?? "—"}</div>
                <Badge variant="neutral" className="text-xs">{e.importerNumberType}</Badge>
                <span className="text-ink-muted text-xs">{e.importerNumber ?? "Pending"}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>{entities.length > 0 ? "Add another importing entity" : "Importing entity"}</CardHeader>
        <div className="px-6 pb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label htmlFor="legalName">Legal name *</Label>
              <Input
                id="legalName"
                placeholder="Acme Corporation"
                value={draft.legalName}
                onChange={(e) => set("legalName", e.target.value)}
                className={validationErrors.legalName ? "border-red-400" : ""}
              />
              {validationErrors.legalName && <p className="text-xs text-red-600">{validationErrors.legalName}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="tradeName">Trade / DBA name</Label>
              <Input
                id="tradeName"
                placeholder="Acme"
                value={draft.tradeName}
                onChange={(e) => set("tradeName", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="entityType">Entity type *</Label>
              <select
                id="entityType"
                value={draft.entityType}
                onChange={(e) => set("entityType", e.target.value as EntityType)}
                className="w-full h-9 rounded-xl border border-border bg-white px-3 text-sm"
              >
                {ENTITY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Importer number type *</Label>
            <div className="flex gap-3 flex-wrap">
              {NUMBER_TYPES.map((t) => (
                <label key={t.value} className={`flex items-start gap-2 px-3 py-2 rounded-xl border text-sm cursor-pointer transition-colors ${draft.importerNumberType === t.value ? "border-brand bg-brand/5" : "hover:bg-surface-muted"}`}>
                  <input type="radio" name="numberType" value={t.value} checked={draft.importerNumberType === t.value} onChange={() => set("importerNumberType", t.value)} className="mt-0.5" />
                  <div>
                    <div className="font-medium">{t.label}</div>
                    <div className="text-xs text-ink-muted">{t.hint}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {draft.importerNumberType !== "CBP_ASSIGNED" && (
            <div className="space-y-1">
              <Label htmlFor="importerNumber">{draft.importerNumberType === "EIN" ? "EIN" : "SSN"} *</Label>
              <Input
                id="importerNumber"
                placeholder={draft.importerNumberType === "EIN" ? "12-3456789" : "XXX-XX-XXXX"}
                value={draft.importerNumber}
                onChange={(e) => set("importerNumber", e.target.value)}
                className={validationErrors.importerNumber ? "border-red-400" : ""}
              />
              {validationErrors.importerNumber && <p className="text-xs text-red-600">{validationErrors.importerNumber}</p>}
            </div>
          )}

          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-medium">Physical address *</p>
            <div className="space-y-1">
              <Input
                placeholder="Street address"
                value={draft.addressLine1}
                onChange={(e) => set("addressLine1", e.target.value)}
                className={validationErrors.addressLine1 ? "border-red-400" : ""}
              />
              {validationErrors.addressLine1 && <p className="text-xs text-red-600">{validationErrors.addressLine1}</p>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Input placeholder="City" value={draft.city} onChange={(e) => set("city", e.target.value)} className={validationErrors.city ? "border-red-400" : ""} />
                {validationErrors.city && <p className="text-xs text-red-600">{validationErrors.city}</p>}
              </div>
              <Input placeholder="State / Province" value={draft.stateProvince} onChange={(e) => set("stateProvince", e.target.value)} />
              <div className="space-y-1">
                <Input placeholder="Postal code" value={draft.postalCode} onChange={(e) => set("postalCode", e.target.value)} className={validationErrors.postalCode ? "border-red-400" : ""} />
                {validationErrors.postalCode && <p className="text-xs text-red-600">{validationErrors.postalCode}</p>}
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="country">Country</Label>
              <Input id="country" placeholder="US" value={draft.country} onChange={(e) => set("country", e.target.value)} />
            </div>
          </div>

          {isNonResident && (
            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-medium text-amber-700">US resident agent (required for non-resident importers)</p>
              <div className="space-y-1">
                <Input
                  placeholder="Resident agent name"
                  value={draft.residentAgentName}
                  onChange={(e) => set("residentAgentName", e.target.value)}
                  className={validationErrors.residentAgentName ? "border-red-400" : ""}
                />
                {validationErrors.residentAgentName && <p className="text-xs text-red-600">{validationErrors.residentAgentName}</p>}
              </div>
              <Input placeholder="Resident agent US address" value={draft.residentAgentAddress} onChange={(e) => set("residentAgentAddress", e.target.value)} />
            </div>
          )}
        </div>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save & continue"}
        </Button>
      </div>
    </div>
  );
}
