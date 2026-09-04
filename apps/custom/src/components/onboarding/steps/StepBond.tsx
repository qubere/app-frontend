"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Shield,
  ChevronDown,
  ChevronUp,
  Loader2,
  Info,
} from "lucide-react";
import { Button, Input, Label, Card, CardHeader, Badge } from "@/components/ui";

type BondCoverage = "own" | "broker_bond" | "single_transaction" | "none";

interface BondVerification {
  id: string;
  method: string;
  result: string;
  suretyCode: string | null;
  suretyName: string | null;
  queriedImporterNumber: string | null;
  responseRaw: string | null;
  discrepancies: unknown[] | null;
  performedAt: string;
}

interface Bond {
  id: string;
  bondNumber: string;
  bondType: string;
  suretyName: string;
  suretyCode: string | null;
  bondAmount: string;
  activityCode: string | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  status: string;
  lastVerifiedAt: string | null;
  verifications?: BondVerification[];
}

interface OnboardingEntity {
  id: string;
  importerNumber: string | null;
  importerNumberType: string;
  bondCoverage: string;
  bond: Bond | null;
  legalEntity: { legalName: string } | null;
}

interface SufficiencyResult {
  requiredAmount: string;
  rawAmount: string;
  actualAmount: string | null;
  shortfall: string | null;
  sufficient: boolean | null;
  basis: "HISTORICAL" | "PROJECTED";
  priorYearDutyTaxFee: string;
}

interface Props {
  caseId: string;
  entities: OnboardingEntity[];
  onSaved: () => void;
}

const ACTIVITY_CODES = [
  { code: "A", label: "A — Importer or broker" },
  { code: "B", label: "B — Drawback claimant" },
  { code: "C", label: "C — Foreign trade zone (FTZ)" },
  { code: "D", label: "D — Bonded warehouse proprietor" },
  { code: "E", label: "E — Bonded carrier" },
  { code: "F", label: "F — Freight forwarder" },
  { code: "G", label: "G — Container station" },
  { code: "H", label: "H — Custodian of bonded merchandise" },
  { code: "J", label: "J — International carrier" },
  { code: "K", label: "K — Cartman" },
  { code: "L", label: "L — Lighterman" },
  { code: "M", label: "M — Wool warehouse" },
  { code: "N", label: "N — National permit holder (Customs broker)" },
  { code: "O", label: "O — Container freight station" },
  { code: "P", label: "P — Pilot" },
  { code: "Q", label: "Q — Port cargo report/entry" },
  { code: "R", label: "R — Roving CES" },
  { code: "S", label: "S — Importer — steel license" },
  { code: "T", label: "T — Importer — textile" },
];

const RESULT_BADGES: Record<string, { variant: "success" | "warning" | "danger" | "neutral"; label: string }> = {
  match:             { variant: "success",  label: "CBP Verified" },
  surety_confirmed:  { variant: "success",  label: "Surety Confirmed" },
  surety_unconfirmed:{ variant: "warning",  label: "Surety Unconfirmed" },
  no_bond_on_file:   { variant: "warning",  label: "No Bond on File" },
  mismatch:          { variant: "danger",   label: "Data Mismatch" },
  lapsed:            { variant: "danger",   label: "Lapsed" },
  error:             { variant: "danger",   label: "Error" },
};

const BOND_STATUS_BADGES: Record<string, { variant: "success" | "warning" | "danger" | "neutral"; label: string }> = {
  verified:            { variant: "success", label: "Verified" },
  attested:            { variant: "warning", label: "Attested" },
  unverified:          { variant: "neutral", label: "Unverified" },
  verifying:           { variant: "neutral", label: "Verifying…" },
  insufficient:        { variant: "danger",  label: "Insufficient" },
  verification_failed: { variant: "danger",  label: "Verification Failed" },
};

function fmt(amount: string) {
  return "$" + Number(amount).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function EvidenceBlock({ verification }: { verification: BondVerification }) {
  const [open, setOpen] = useState(false);
  const badge = RESULT_BADGES[verification.result] ?? { variant: "neutral" as const, label: verification.result };
  const methodLabel = {
    CBP_IMPORTER_BOND_QUERY: "CBP Importer/Bond Query (KI/KR)",
    SURETY_CODE_LOOKUP: "CBP Active Sureties List (Circular 570, Aug 1, 2025)",
    MANUAL_ATTESTATION: "Manual Attestation",
  }[verification.method] ?? verification.method;

  return (
    <div className="rounded-md border bg-surface-muted p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Shield className="h-3.5 w-3.5 text-ink-muted shrink-0" />
          <span className="text-ink-muted truncate">{methodLabel}</span>
          <span className="text-ink-muted">·</span>
          <span className="text-ink-muted">
            {new Date(verification.performedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} UTC
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={badge.variant} className="text-xs">{badge.label}</Badge>
          {verification.responseRaw && (
            <button onClick={() => setOpen(!open)} className="text-ink-muted hover:text-ink">
              {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>
      {verification.discrepancies && Array.isArray(verification.discrepancies) && verification.discrepancies.length > 0 && (
        <div className="mt-2 text-red-600 text-xs space-y-0.5">
          {(verification.discrepancies as Array<{ field: string; expected: unknown; cbpValue: unknown }>).map((d, i) => (
            <div key={i}>Field <strong>{d.field}</strong>: expected {String(d.expected)}, CBP shows {String(d.cbpValue)}</div>
          ))}
        </div>
      )}
      {open && verification.responseRaw && (
        <pre className="mt-2 text-xs font-mono bg-black/5 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
          {(() => {
            try { return JSON.stringify(JSON.parse(verification.responseRaw), null, 2); }
            catch { return verification.responseRaw; }
          })()}
        </pre>
      )}
    </div>
  );
}

function SufficiencyCard({ s }: { s: SufficiencyResult }) {
  if (s.sufficient === null) return null;
  return (
    <div className={`rounded-md border p-3 text-sm ${s.sufficient ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
      <div className="flex items-center gap-2 font-medium mb-1">
        {s.sufficient
          ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          : <AlertTriangle className="h-4 w-4 text-red-600" />}
        <span className={s.sufficient ? "text-emerald-800" : "text-red-800"}>
          {s.sufficient ? "Bond is sufficient" : "Bond insufficient — increase required"}
        </span>
      </div>
      <div className="text-ink-muted text-xs space-y-0.5 ml-6">
        <div>CBP formula: 10% × {s.basis === "HISTORICAL" ? "actual" : "projected"} {fmt(s.priorYearDutyTaxFee)} prior-year duties/taxes/fees = {fmt(s.rawAmount)}</div>
        <div>Required (after rounding + $50k floor): <strong>{fmt(s.requiredAmount)}</strong></div>
        <div>Current bond amount: {fmt(s.actualAmount ?? "0")}</div>
        {s.shortfall && <div className="text-red-700 font-medium">Shortfall: {fmt(s.shortfall)} — contact your surety for a rider</div>}
        <div className="text-ink-muted/70">{s.basis === "HISTORICAL" ? "Based on actual filing data from the past 12 months" : "Based on projected annual duty exposure entered in case settings"}</div>
      </div>
    </div>
  );
}

export function StepBond({ caseId, entities, onSaved }: Props) {
  const [activeEntityIdx, setActiveEntityIdx] = useState(0);
  const [localEntities, setLocalEntities] = useState<OnboardingEntity[]>(entities);
  const [coverage, setCoverage] = useState<BondCoverage>(
    (entities[0]?.bondCoverage as BondCoverage) ?? "own"
  );

  // Bond form
  const [suretyName, setSuretyName] = useState(entities[0]?.bond?.suretyName ?? "");
  const [suretyCode, setSuretyCode] = useState(entities[0]?.bond?.suretyCode ?? "");
  const [bondNumber, setBondNumber] = useState(entities[0]?.bond?.bondNumber ?? "");
  const [bondAmount, setBondAmount] = useState(entities[0]?.bond?.bondAmount ?? "");
  const [activityCode, setActivityCode] = useState(entities[0]?.bond?.activityCode ?? "A");
  const [effectiveDate, setEffectiveDate] = useState(
    entities[0]?.bond?.effectiveDate?.slice(0, 10) ?? ""
  );
  const [expirationDate, setExpirationDate] = useState(
    entities[0]?.bond?.expirationDate?.slice(0, 10) ?? ""
  );

  // Verification state
  const [verifications, setVerifications] = useState<BondVerification[]>(
    entities[0]?.bond?.verifications ?? []
  );
  const [sufficiency, setSufficiency] = useState<SufficiencyResult | null>(null);

  // Attestation form
  const [showAttestForm, setShowAttestForm] = useState(false);
  const [attestNote, setAttestNote] = useState("");

  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [attesting, setAttesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entity = localEntities[activeEntityIdx];
  const bond = entity?.bond ?? null;
  const importerNumber = entity?.importerNumber ?? "";

  useEffect(() => {
    if (!bond?.id) return;
    fetch(`/api/onboarding/bond/sufficiency?caseId=${caseId}`)
      .then((r) => r.json())
      .then((d) => {
        const entityResult = d.entities?.find((e: { entityId: string; sufficiency: SufficiencyResult | null }) => e.entityId === entity?.id);
        if (entityResult?.sufficiency) setSufficiency(entityResult.sufficiency);
      })
      .catch(() => {});
  }, [bond?.id, caseId, entity?.id]);

  async function saveCoverage() {
    if (!entity) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        caseId,
        entityId: entity.id,
        coverage,
      };
      if (coverage === "own") {
        if (!bondNumber || !suretyName || !bondAmount) {
          setError("Surety name, bond number, and bond amount are required for own-bond coverage.");
          setSaving(false);
          return;
        }
        body.bond = {
          suretyName,
          suretyCode: suretyCode || undefined,
          bondNumber,
          bondType: "continuous",
          bondAmount: parseFloat(bondAmount),
          activityCode: activityCode || undefined,
          effectiveDate: effectiveDate || undefined,
          expirationDate: expirationDate || undefined,
        };
      }
      const res = await fetch("/api/onboarding/bond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to save bond");
      }
      const data = await res.json();
      setLocalEntities((prev) =>
        prev.map((e, i) => (i === activeEntityIdx ? { ...e, bondCoverage: coverage, bond: data.bond } : e))
      );
      if (data.bond) {
        setVerifications([]);
        setSufficiency(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function verify() {
    if (!bond || !importerNumber) return;
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/bond/${bond.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importerNumber }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Verification failed");
      }
      const data = await res.json();
      setVerifications((prev) => [data.verification, ...prev]);
      // Refresh sufficiency
      const suf = await fetch(`/api/onboarding/bond/sufficiency?caseId=${caseId}`).then((r) => r.json()).catch(() => null);
      if (suf) {
        const entityResult = suf.entities?.find((e: { entityId: string; sufficiency: SufficiencyResult | null }) => e.entityId === entity?.id);
        if (entityResult?.sufficiency) setSufficiency(entityResult.sufficiency);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  }

  async function attest() {
    if (!bond || !attestNote.trim()) return;
    setAttesting(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/bond/${bond.id}/attest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: attestNote }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Attestation failed");
      }
      const data = await res.json();
      setVerifications((prev) => [data.verification, ...prev]);
      setShowAttestForm(false);
      setAttestNote("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Attestation failed");
    } finally {
      setAttesting(false);
    }
  }

  const latestVerif = verifications[0] ?? null;
  const bondStatus = bond?.status ?? "unverified";
  const statusBadge = BOND_STATUS_BADGES[bondStatus] ?? { variant: "neutral" as const, label: bondStatus };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Step 4 · Customs Bond</h2>
        <p className="text-sm text-ink-muted mt-1">
          A valid, sufficient customs bond must be on file with CBP before entries can be filed for this importer.
        </p>
      </div>

      {/* Entity tabs (multi-entity S4) */}
      {localEntities.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {localEntities.map((e, i) => (
            <button
              key={e.id}
              onClick={() => setActiveEntityIdx(i)}
              className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                i === activeEntityIdx ? "bg-brand text-white border-brand" : "border-gray-200 hover:bg-surface-muted"
              }`}
            >
              {e.legalEntity?.legalName ?? `Entity ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      {entity && (
        <>
          {/* Coverage selector */}
          <Card>
            <CardHeader className="pb-3">
              <span className="font-medium text-sm">Bond coverage for {entity.legalEntity?.legalName ?? "this entity"}</span>
            </CardHeader>
            <div className="px-4 pb-4 grid grid-cols-2 gap-2">
              {(
                [
                  { value: "own", label: "Own continuous bond", desc: "Importer has their own continuous bond on file with CBP" },
                  { value: "broker_bond", label: "Ride broker's bond", desc: "Importer uses the account's master bond for coverage" },
                  { value: "single_transaction", label: "Single-transaction bond", desc: "STB per shipment — no continuous bond required" },
                  { value: "none", label: "No bond yet — request one", desc: "Parks the case in awaiting_bond state while the importer applies" },
                ] as { value: BondCoverage; label: string; desc: string }[]
              ).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setCoverage(opt.value)}
                  className={`text-left p-3 rounded-md border text-sm transition-colors ${
                    coverage === opt.value
                      ? "border-brand bg-brand/5 font-medium"
                      : "border-gray-200 hover:bg-surface-muted"
                  }`}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-xs text-ink-muted mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </Card>

          {/* Own-bond form */}
          {coverage === "own" && (
            <Card>
              <CardHeader className="pb-3">
                <span className="font-medium text-sm">Bond details</span>
                {bond && <Badge variant={statusBadge.variant} className="text-xs ml-auto">{statusBadge.label}</Badge>}
              </CardHeader>
              <div className="px-4 pb-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="suretyName">Surety name *</Label>
                    <Input id="suretyName" value={suretyName} onChange={(e) => setSuretyName(e.target.value)} placeholder="e.g. Western Surety Company" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="suretyCode">Surety code (CBP 3-digit)</Label>
                    <Input id="suretyCode" value={suretyCode} onChange={(e) => setSuretyCode(e.target.value)} placeholder="e.g. 913" maxLength={3} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="bondNumber">Bond number *</Label>
                    <Input id="bondNumber" value={bondNumber} onChange={(e) => setBondNumber(e.target.value)} placeholder="e.g. 9876543210US" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bondAmount">Bond amount (USD) *</Label>
                    <Input id="bondAmount" type="number" min={0} value={bondAmount} onChange={(e) => setBondAmount(e.target.value)} placeholder="50000" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="activityCode">Activity code (CBPF 301)</Label>
                  <select
                    id="activityCode"
                    value={activityCode}
                    onChange={(e) => setActivityCode(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {ACTIVITY_CODES.map((a) => (
                      <option key={a.code} value={a.code}>{a.label}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="effectiveDate">Effective date</Label>
                    <Input id="effectiveDate" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="expirationDate">Expiration date (continuous bonds: leave blank)</Label>
                    <Input id="expirationDate" type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} />
                  </div>
                </div>

                <Button onClick={saveCoverage} disabled={saving} size="sm">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {bond ? "Update bond details" : "Save bond details"}
                </Button>
              </div>
            </Card>
          )}

          {/* Broker bond / STB / none info cards */}
          {coverage === "broker_bond" && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 flex gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>The importer will ride the account's master continuous bond. Confirm the bond's headroom covers this importer's projected duty exposure.</span>
            </div>
          )}
          {coverage === "single_transaction" && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>A single-transaction bond (STB) must be placed for each shipment. The STB amount must be ≥ entered value + all duties, taxes, and fees. STBs do not appear in the CBP importer/bond query (KI/KR).</span>
            </div>
          )}
          {coverage === "none" && (
            <div className="rounded-md border border-gray-200 bg-surface-muted p-3 text-sm text-ink-muted flex gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>The case will be placed in <strong>awaiting_bond</strong> status. Return here once the surety issues the bond to complete verification.</span>
            </div>
          )}

          {/* Save coverage (non-own) */}
          {coverage !== "own" && (
            <Button onClick={saveCoverage} disabled={saving} size="sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save coverage selection
            </Button>
          )}

          {/* Verification panel — only for own continuous bond */}
          {coverage === "own" && bond && (
            <Card>
              <CardHeader className="pb-3">
                <span className="font-medium text-sm">Verification</span>
                <span className="text-xs text-ink-muted ml-auto">Importer no. {importerNumber || "—"}</span>
              </CardHeader>
              <div className="px-4 pb-4 space-y-3">
                {/* Sufficiency */}
                {sufficiency && <SufficiencyCard s={sufficiency} />}

                {/* Evidence history */}
                {verifications.map((v) => (
                  <EvidenceBlock key={v.id} verification={v} />
                ))}

                {verifications.length === 0 && (
                  <p className="text-sm text-ink-muted">No verification on record. Run a verification below.</p>
                )}

                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={verify}
                    disabled={verifying || !importerNumber}
                    size="sm"
                    title={!importerNumber ? "Importer number required — complete Step 1 first" : undefined}
                  >
                    {verifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
                    Verify with CBP
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowAttestForm(!showAttestForm)}
                  >
                    Manual attestation
                  </Button>
                </div>

                {!importerNumber && (
                  <p className="text-xs text-amber-700">
                    An importer number is required to query CBP. Complete Step 1 to set it.
                  </p>
                )}

                <p className="text-xs text-ink-muted">
                  "Verify with CBP" checks the CBP Active Sureties list (Circular 570) and, when ABI transport is configured, queries the CBP Importer/Bond Query (KI/KR) for a real-time record. Only a KI/KR <em>match</em> sets status to <strong>Verified</strong>; surety-list confirmation sets <strong>Attested</strong>.
                </p>

                {showAttestForm && (
                  <div className="border rounded-md p-3 space-y-3 bg-surface-muted">
                    <p className="text-sm font-medium">Manual attestation</p>
                    <p className="text-xs text-ink-muted">
                      Use this when you have confirmed the bond with the surety directly (e.g. a surety letter or phone confirmation) and ABI verification is not available.
                    </p>
                    <div className="space-y-1.5">
                      <Label htmlFor="attestNote">Attestation note *</Label>
                      <textarea
                        id="attestNote"
                        value={attestNote}
                        onChange={(e) => setAttestNote(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[72px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="e.g. Confirmed with Western Surety by phone on 2026-08-31. Bond #9876543210US is active. Ref: call log #1234."
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={attest} disabled={attesting || !attestNote.trim()}>
                        {attesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Save attestation
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowAttestForm(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* Latest verification status banner */}
          {latestVerif && (
            <div className={`rounded-md p-3 text-sm flex items-start gap-2 ${
              ["match", "surety_confirmed"].includes(latestVerif.result)
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : ["mismatch", "lapsed", "error"].includes(latestVerif.result)
                ? "bg-red-50 border border-red-200 text-red-800"
                : "bg-amber-50 border border-amber-200 text-amber-800"
            }`}>
              {["match", "surety_confirmed"].includes(latestVerif.result)
                ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
              <span>
                {latestVerif.result === "match" && "Bond confirmed against CBP Importer/Bond Query — status set to Verified."}
                {latestVerif.result === "surety_confirmed" && "Surety confirmed against CBP Active Sureties List (Circular 570, Aug 1, 2025) — status set to Attested."}
                {latestVerif.result === "surety_unconfirmed" && "Surety name/code not found in the CBP Active Sureties list. Verify directly with the surety or update the surety name/code."}
                {latestVerif.result === "no_bond_on_file" && "CBP shows no continuous bond for this importer number. The importer may need to file a new bond, or switch to broker-bond / STB coverage."}
                {latestVerif.result === "mismatch" && "Bond data does not match CBP records. Review the discrepancies above and correct the bond details."}
                {latestVerif.result === "lapsed" && "Bond is lapsed per CBP records. A new or reinstated bond is required before filing."}
                {latestVerif.result === "error" && "Verification encountered an error. Try again or use manual attestation."}
              </span>
            </div>
          )}
        </>
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={onSaved}>Continue to screening →</Button>
      </div>
    </div>
  );
}
