"use client";

import { useState } from "react";
import { ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { PanelHeading } from "@/components/PanelHeading";
import { Button, Input, Label, Card, CardHeader, Badge } from "@/components/ui";

interface BrokerProfile {
  id: string;
  licenseType: string;
  brokerLicenseNumber: string | null;
  nationalPermitNumber: string | null;
  nationalPermitStatus: string;
  filerCode: string | null;
  status: string;
  responsibleSupervisionAttestedAt: string | null;
  permitQualifyingOfficers: Array<{
    id: string;
    name: string;
    individualLicenseNumber: string;
    active: boolean;
  }>;
}

interface Props {
  profile: BrokerProfile | null;
}

const PERMIT_STATUS_COLORS: Record<string, string> = {
  none: "bg-gray-100 text-gray-600",
  pending: "bg-amber-100 text-amber-700",
  active: "bg-emerald-100 text-emerald-700",
  suspended: "bg-red-100 text-red-700",
  revoked: "bg-red-100 text-red-700",
};

export function BrokerComplianceClient({ profile: initial }: Props) {
  const [profile, setProfile] = useState<BrokerProfile | null>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    licenseType: initial?.licenseType ?? "CORPORATE",
    brokerLicenseNumber: initial?.brokerLicenseNumber ?? "",
    nationalPermitNumber: initial?.nationalPermitNumber ?? "",
    nationalPermitStatus: initial?.nationalPermitStatus ?? "none",
    filerCode: initial?.filerCode ?? "",
  });

  function setField(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/broker-compliance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Failed to save");
      setProfile(data.profile);
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  async function handleAttestSupervision() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/broker-compliance/attest-supervision", { method: "POST" });
      const data = await res.json();
      if (res.ok) setProfile(data.profile);
    } finally {
      setSaving(false);
    }
  }

  const profileStatus = profile?.status ?? "incomplete";

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PanelHeading
        icon={ShieldCheck}
        badge="Broker Compliance"
        title="Broker Compliance Profile"
        subtitle="Configure your broker license, national permit, filer credentials, and responsible-supervision designation (19 CFR 111)."
      />

      {profileStatus !== "ready" && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <span className="font-medium text-amber-800">Profile incomplete.</span>{" "}
            <span className="text-amber-700">
              Your broker license and national permit must be active before importers can be activated for filing.
            </span>
          </div>
        </div>
      )}
      {profileStatus === "ready" && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Broker compliance profile is complete and in good standing.
        </div>
      )}

      <Card>
        <CardHeader>License &amp; permit</CardHeader>
        <div className="px-6 pb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="licenseType">License type</Label>
              <select
                id="licenseType"
                value={form.licenseType}
                onChange={(e) => setField("licenseType", e.target.value)}
                className="w-full h-9 rounded-xl border border-border bg-white px-3 text-sm"
              >
                <option value="CORPORATE">Corporate</option>
                <option value="INDIVIDUAL">Individual</option>
                <option value="PARTNERSHIP">Partnership</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="brokerLicenseNumber">Broker license number</Label>
              <Input
                id="brokerLicenseNumber"
                placeholder="XX-NNNNN"
                value={form.brokerLicenseNumber}
                onChange={(e) => setField("brokerLicenseNumber", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nationalPermitNumber">National permit number</Label>
              <Input
                id="nationalPermitNumber"
                placeholder="NP-XXXXXXXX"
                value={form.nationalPermitNumber}
                onChange={(e) => setField("nationalPermitNumber", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nationalPermitStatus">National permit status</Label>
              <select
                id="nationalPermitStatus"
                value={form.nationalPermitStatus}
                onChange={(e) => setField("nationalPermitStatus", e.target.value)}
                className="w-full h-9 rounded-xl border border-border bg-white px-3 text-sm"
              >
                <option value="none">None</option>
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="revoked">Revoked</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="filerCode">ABI filer code</Label>
              <Input
                id="filerCode"
                placeholder="XXXXX"
                value={form.filerCode}
                onChange={(e) => setField("filerCode", e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && <p className="text-sm text-emerald-600">Saved successfully.</p>}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>Responsible supervision attestation (19 CFR 111.28)</CardHeader>
        <div className="px-6 pb-6 space-y-3">
          <p className="text-sm text-ink-muted">
            Attest that the broker maintains adequate responsible supervision and control of all customs business
            conducted by its employees and agents. This attestation is required for license compliance.
          </p>
          {profile?.responsibleSupervisionAttestedAt && (
            <div className="text-sm text-emerald-700">
              Last attested: {new Date(profile.responsibleSupervisionAttestedAt).toLocaleDateString()}
            </div>
          )}
          <Button variant="secondary" onClick={handleAttestSupervision} disabled={saving}>
            Attest responsible supervision
          </Button>
        </div>
      </Card>

      {profile && profile.permitQualifyingOfficers.length > 0 && (
        <Card>
          <CardHeader>Permit qualifying officers (PQOs)</CardHeader>
          <div className="divide-y px-6 pb-4 text-sm">
            {profile.permitQualifyingOfficers.map((pqo) => (
              <div key={pqo.id} className="py-2 flex items-center gap-3">
                <div className="flex-1 font-medium">{pqo.name}</div>
                <span className="text-ink-muted text-xs">{pqo.individualLicenseNumber}</span>
                <Badge variant={pqo.active ? "success" : "neutral"} className="text-xs">
                  {pqo.active ? "Active" : "Inactive"}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex items-center gap-3 text-sm text-ink-muted">
        <span>National permit status:</span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PERMIT_STATUS_COLORS[form.nationalPermitStatus] ?? ""}`}>
          {form.nationalPermitStatus}
        </span>
      </div>
    </div>
  );
}
