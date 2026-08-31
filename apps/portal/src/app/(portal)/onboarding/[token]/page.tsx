"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronRight,
  Loader2,
  Building2,
  FileText,
  PenLine,
  UploadCloud,
  AlertCircle,
} from "lucide-react";

type StepId = "entity" | "officers" | "poa" | "documents";

const STEPS: { id: StepId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "entity", label: "Confirm entity details", icon: Building2 },
  { id: "officers", label: "Officer / owner info", icon: FileText },
  { id: "poa", label: "Sign Power of Attorney", icon: PenLine },
  { id: "documents", label: "Supporting documents", icon: UploadCloud },
];

interface InvitationContext {
  clientName: string;
  brokerName: string;
  onboardingCaseId: string;
  entityId: string;
  poaEnvelopeSignUrl?: string;
  entityDetails?: {
    legalName: string;
    entityType: string;
    addressLine1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    ein?: string;
  };
  officers?: Array<{ name: string; title: string; role: string }>;
  poaStatus?: string;
  supportingDocs?: Array<{ name: string; type: string }>;
}

export default function OnboardingPortalPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [ctx, setCtx] = useState<InvitationContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<StepId>("entity");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const [entityEdit, setEntityEdit] = useState<Record<string, string>>({});
  const [officers, setOfficers] = useState<Array<{ name: string; title: string; role: string }>>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<Array<{ name: string }>>([]);

  useEffect(() => {
    fetch(`/api/portal/onboarding/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setCtx(d);
        setEntityEdit(d.entityDetails ?? {});
        setOfficers(d.officers ?? []);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function saveEntityDetails() {
    setSaving(true);
    try {
      await fetch(`/api/portal/onboarding/${token}/entity`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entityEdit),
      });
      setStep("officers");
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function saveOfficers() {
    setSaving(true);
    try {
      await fetch(`/api/portal/onboarding/${token}/officers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ officers }),
      });
      setStep("poa");
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDocUpload(file: File, docType: string) {
    setUploadingDoc(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("docType", docType);
      await fetch(`/api/portal/onboarding/${token}/documents`, { method: "POST", body: fd });
      setUploadedDocs((prev) => [...prev, { name: file.name }]);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setUploadingDoc(false);
    }
  }

  async function finishDocuments() {
    setSaving(true);
    try {
      await fetch(`/api/portal/onboarding/${token}/complete`, { method: "POST" });
      setDone(true);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
          <h1 className="text-xl font-semibold">Unable to load your onboarding</h1>
          <p className="text-muted-foreground text-sm">{error}</p>
          <p className="text-xs text-muted-foreground">If this link has expired, contact your broker for a new invitation.</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
          <h1 className="text-2xl font-semibold">All done — thank you!</h1>
          <p className="text-muted-foreground">
            Your information has been submitted to <strong>{ctx?.brokerName}</strong>. They will review and activate
            your account. You may close this window.
          </p>
        </div>
      </div>
    );
  }

  const currentStepIdx = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-lg">Importer onboarding</h1>
          <p className="text-sm text-muted-foreground">Powered by {ctx?.brokerName}</p>
        </div>
        <div className="text-sm text-muted-foreground">{ctx?.clientName}</div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <nav className="flex items-center gap-2 mb-8 flex-wrap">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < currentStepIdx;
            const active = s.id === step;
            return (
              <React.Fragment key={s.id}>
                <div className={`flex items-center gap-2 text-sm font-medium ${active ? "text-foreground" : done ? "text-green-600" : "text-muted-foreground"}`}>
                  {done ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  {s.label}
                </div>
                {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
              </React.Fragment>
            );
          })}
        </nav>

        <div className="rounded-xl border border-border bg-card p-6">
          {step === "entity" && (
            <EntityStep
              details={entityEdit}
              onChange={(k, v) => setEntityEdit((prev) => ({ ...prev, [k]: v }))}
              onNext={saveEntityDetails}
              saving={saving}
            />
          )}

          {step === "officers" && (
            <OfficersStep
              officers={officers}
              onChange={setOfficers}
              onBack={() => setStep("entity")}
              onNext={saveOfficers}
              saving={saving}
            />
          )}

          {step === "poa" && (
            <PoaStep
              signUrl={ctx?.poaEnvelopeSignUrl}
              poaStatus={ctx?.poaStatus}
              onBack={() => setStep("officers")}
              onNext={() => setStep("documents")}
            />
          )}

          {step === "documents" && (
            <DocumentsStep
              uploadedDocs={uploadedDocs}
              uploading={uploadingDoc}
              onUpload={handleDocUpload}
              onBack={() => setStep("poa")}
              onFinish={finishDocuments}
              saving={saving}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function EntityStep({
  details,
  onChange,
  onNext,
  saving,
}: {
  details: Record<string, string>;
  onChange: (k: string, v: string) => void;
  onNext: () => void;
  saving: boolean;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Confirm your entity details</h2>
      <p className="text-sm text-muted-foreground mb-5">
        Review the information below and correct anything that's wrong. Changes are submitted as proposals — your broker
        will review them before they go on file with CBP.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { key: "legalName", label: "Legal name" },
          { key: "entityType", label: "Entity type" },
          { key: "ein", label: "EIN / Importer number" },
          { key: "addressLine1", label: "Address" },
          { key: "city", label: "City" },
          { key: "state", label: "State" },
          { key: "postalCode", label: "Postal code" },
          { key: "country", label: "Country" },
        ].map(({ key, label }) => (
          <div key={key}>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">{label}</label>
            <input
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
              value={details[key] ?? ""}
              onChange={(e) => onChange(key, e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-end">
        <button
          onClick={onNext}
          disabled={saving}
          className="px-5 py-2 rounded bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving…" : "Confirm & continue"}
        </button>
      </div>
    </div>
  );
}

function OfficersStep({
  officers,
  onChange,
  onBack,
  onNext,
  saving,
}: {
  officers: Array<{ name: string; title: string; role: string }>;
  onChange: (o: Array<{ name: string; title: string; role: string }>) => void;
  onBack: () => void;
  onNext: () => void;
  saving: boolean;
}) {
  function update(i: number, k: string, v: string) {
    const next = officers.map((o, idx) => (idx === i ? { ...o, [k]: v } : o));
    onChange(next);
  }
  function add() {
    onChange([...officers, { name: "", title: "", role: "OFFICER" }]);
  }
  function remove(i: number) {
    onChange(officers.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Officer / owner information</h2>
      <p className="text-sm text-muted-foreground mb-5">
        CBP Form 5106 requires the name, title, and role of at least one officer, owner, or authorized representative.
      </p>
      {officers.length === 0 && (
        <p className="text-sm text-muted-foreground mb-4">No officers added yet.</p>
      )}
      <div className="space-y-4">
        {officers.map((o, i) => (
          <div key={i} className="rounded border border-border p-4 relative">
            <button onClick={() => remove(i)} className="absolute top-3 right-3 text-muted-foreground hover:text-destructive text-xs">Remove</button>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(["name", "title", "role"] as const).map((k) => (
                <div key={k}>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">{k}</label>
                  {k === "role" ? (
                    <select
                      className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                      value={o.role}
                      onChange={(e) => update(i, k, e.target.value)}
                    >
                      {["OFFICER", "AUTHORIZED_EMPLOYEE", "GENERAL_PARTNER", "MANAGING_MEMBER", "INDIVIDUAL"].map(
                        (r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
                      )}
                    </select>
                  ) : (
                    <input
                      className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                      value={o[k]}
                      onChange={(e) => update(i, k, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-3 text-sm text-primary underline">+ Add officer / owner</button>
      <div className="mt-6 flex justify-between">
        <button onClick={onBack} className="px-4 py-2 rounded border border-border text-sm">Back</button>
        <button
          onClick={onNext}
          disabled={saving || officers.length === 0}
          className="px-5 py-2 rounded bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving…" : "Continue"}
        </button>
      </div>
    </div>
  );
}

function PoaStep({
  signUrl,
  poaStatus,
  onBack,
  onNext,
}: {
  signUrl?: string;
  poaStatus?: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const isExecuted = poaStatus === "executed";
  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Power of Attorney</h2>
      <p className="text-sm text-muted-foreground mb-5">
        Your broker needs a signed Power of Attorney to act on your behalf with CBP. Click the button below to review
        and sign the document electronically.
      </p>
      {isExecuted ? (
        <div className="flex items-center gap-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 p-4 mb-4">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <div className="font-medium text-green-900 dark:text-green-200 text-sm">POA signed</div>
            <div className="text-xs text-green-700 dark:text-green-400">Your Power of Attorney has been executed successfully.</div>
          </div>
        </div>
      ) : signUrl ? (
        <a
          href={signUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-primary text-primary-foreground text-sm font-medium"
        >
          <PenLine className="w-4 h-4" />
          Open POA for signature
        </a>
      ) : (
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          Your broker hasn&apos;t sent the POA yet — they will notify you when it&apos;s ready. You can continue to the
          next step and come back here once you receive the signing link.
        </div>
      )}
      <div className="mt-6 flex justify-between">
        <button onClick={onBack} className="px-4 py-2 rounded border border-border text-sm">Back</button>
        <button
          onClick={onNext}
          className="px-5 py-2 rounded bg-primary text-primary-foreground text-sm font-medium"
        >
          {isExecuted ? "Continue" : "Skip for now"}
        </button>
      </div>
    </div>
  );
}

function DocumentsStep({
  uploadedDocs,
  uploading,
  onUpload,
  onBack,
  onFinish,
  saving,
}: {
  uploadedDocs: Array<{ name: string }>;
  uploading: boolean;
  onUpload: (file: File, docType: string) => void;
  onBack: () => void;
  onFinish: () => void;
  saving: boolean;
}) {
  const [docType, setDocType] = useState("OTHER");
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onUpload(file, docType);
    e.target.value = "";
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Supporting documents</h2>
      <p className="text-sm text-muted-foreground mb-5">
        Optionally upload articles of incorporation, W-9, prior CBP correspondence, or any other documents your broker
        requested. You can skip this step if you have nothing to add.
      </p>
      <div className="flex gap-3 items-center mb-4">
        <select
          className="rounded border border-border bg-background px-3 py-2 text-sm"
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
        >
          {["ARTICLES_OF_INCORPORATION", "W9", "CBP_CORRESPONDENCE", "CORPORATE_RESOLUTION", "OTHER"].map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
          ))}
        </select>
        <label className={`flex items-center gap-2 px-4 py-2 rounded border border-border text-sm cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : "hover:bg-muted"}`}>
          <UploadCloud className="w-4 h-4" />
          {uploading ? "Uploading…" : "Upload file"}
          <input type="file" className="hidden" onChange={handleFile} accept=".pdf,.doc,.docx,.jpg,.png" />
        </label>
      </div>
      {uploadedDocs.length > 0 && (
        <ul className="space-y-1 mb-4">
          {uploadedDocs.map((d, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
              {d.name}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6 flex justify-between">
        <button onClick={onBack} className="px-4 py-2 rounded border border-border text-sm">Back</button>
        <button
          onClick={onFinish}
          disabled={saving}
          className="px-5 py-2 rounded bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Submitting…" : "Submit & finish"}
        </button>
      </div>
    </div>
  );
}
