"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, AlertTriangle, Loader2, Send, Upload, RotateCcw, ExternalLink } from "lucide-react";
import { Button, Input, Label, Card, CardHeader, Badge } from "@/components/ui";
import { VALID_SIGNER_ROLES, SIGNER_ROLE_LABELS } from "@/lib/esign";

type ExecutionMethod = "E_SIGN" | "WET_INK" | "WET_INK_NOTARIZED";

interface PoaTemplate {
  id: string;
  name: string;
  entityTypes: string[];
  termMonths: number | null;
  requiresNotarization: boolean;
  isDefault: boolean;
}

interface PoaEnvelope {
  id: string;
  provider: string;
  status: string;
  sentAt: string | null;
  completedAt: string | null;
}

interface Poa {
  id: string;
  status: string;
  executionMethod: string | null;
  signerName: string | null;
  signerTitle: string | null;
  signerRole: string | null;
  expirationDate: string | null;
  executedDocumentUrl: string | null;
  envelope: PoaEnvelope | null;
}

interface OnboardingEntity {
  id: string;
  legalEntity: { legalName: string; entityType: string } | null;
  importerOfRecord: { name: string } | null;
  poa: Poa | null;
}

interface Props {
  caseId: string;
  entities: OnboardingEntity[];
  onSaved: () => void;
}

const POA_STATUS_BADGES: Record<string, { variant: "success" | "warning" | "danger" | "neutral"; label: string }> = {
  draft:              { variant: "neutral",  label: "Draft" },
  out_for_signature:  { variant: "warning",  label: "Out for Signature" },
  executed:           { variant: "success",  label: "Executed" },
  declined:           { variant: "danger",   label: "Declined" },
  expired:            { variant: "danger",   label: "Expired" },
  revoked:            { variant: "danger",   label: "Revoked" },
};

function entityTypeLabel(et: string) {
  const m: Record<string, string> = {
    US_CORPORATION: "U.S. Corporation",
    LLC: "LLC",
    PARTNERSHIP: "Partnership",
    SOLE_PROPRIETORSHIP: "Sole Proprietorship",
    FOREIGN: "Foreign Entity",
  };
  return m[et] ?? et;
}

export default function StepPoa({ caseId, entities, onSaved }: Props) {
  const [templates, setTemplates] = useState<PoaTemplate[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState(entities[0]?.id ?? "");
  const [executionMethod, setExecutionMethod] = useState<ExecutionMethod>("E_SIGN");
  const [templateId, setTemplateId] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signerTitle, setSignerTitle] = useState("");
  const [signerRole, setSignerRole] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [signingUrl, setSigningUrl] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revoking, setRevoking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [attestationNote, setAttestationNote] = useState("");
  const [notarized, setNotarized] = useState(false);
  const [entitiesState, setEntitiesState] = useState(entities);
  const [error, setError] = useState("");

  const entity = entitiesState.find((e) => e.id === selectedEntityId);
  const entityType = entity?.legalEntity?.entityType ?? "US_CORPORATION";
  const validRoles = VALID_SIGNER_ROLES[entityType] ?? ["OFFICER", "AUTHORIZED_EMPLOYEE"];
  const poa = entity?.poa ?? null;

  useEffect(() => {
    fetch(`/api/onboarding/poa/templates?entityType=${entityType}`)
      .then((r) => r.json())
      .then((d) => {
        setTemplates(d.templates ?? []);
        const def = (d.templates ?? []).find((t: PoaTemplate) => t.isDefault);
        if (def) setTemplateId(def.id);
      })
      .catch(() => {});
  }, [entityType]);

  async function handleCreate() {
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding/poa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          entityId: selectedEntityId,
          templateId: templateId || undefined,
          executionMethod,
          signer: {
            name: signerName.trim(),
            title: signerTitle.trim() || undefined,
            role: signerRole,
            email: signerEmail.trim() || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error?.message ?? data.message ?? "Failed to create POA"); return; }
      setEntitiesState((prev) => prev.map((e) => e.id === selectedEntityId ? { ...e, poa: data.poa } : e));
    } finally {
      setCreating(false);
    }
  }

  async function handleSendEnvelope() {
    if (!poa) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/onboarding/poa/${poa.id}/send`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error?.message ?? data.message ?? "Failed to send"); return; }
      if (data.signingUrl) setSigningUrl(data.signingUrl);
      setEntitiesState((prev) =>
        prev.map((e) =>
          e.id === selectedEntityId ? { ...e, poa: { ...e.poa!, status: "out_for_signature", envelope: data.envelope } } : e
        )
      );
    } finally {
      setSending(false);
    }
  }

  async function handleUpload() {
    if (!poa || !uploadFile) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("attestationNote", attestationNote.trim());
      fd.append("caseId", caseId);
      fd.append("notarized", String(notarized));
      const res = await fetch(`/api/onboarding/poa/${poa.id}/upload`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error?.message ?? data.message ?? "Upload failed"); return; }
      setEntitiesState((prev) => prev.map((e) => e.id === selectedEntityId ? { ...e, poa: data.poa } : e));
      setUploadFile(null);
      setAttestationNote("");
    } finally {
      setUploading(false);
    }
  }

  async function handleRevoke() {
    if (!poa || !revokeReason.trim()) return;
    setRevoking(true);
    setError("");
    try {
      const res = await fetch(`/api/onboarding/poa/${poa.id}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: revokeReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error?.message ?? data.message ?? "Revoke failed"); return; }
      setEntitiesState((prev) => prev.map((e) => e.id === selectedEntityId ? { ...e, poa: data.poa } : e));
      setRevokeReason("");
    } finally {
      setRevoking(false);
    }
  }

  const allExecuted = entitiesState.every(
    (e) => e.poa?.status === "executed" || e.poa?.status === "out_for_signature"
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Power of Attorney</h2>
        <p className="text-sm text-muted-foreground mt-1">
          A signed POA authorizes Qubere to act as customs broker for each importer of record.
          Required before any CBP filings can be submitted.
        </p>
      </div>

      {/* Entity selector */}
      {entities.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {entities.map((e) => {
            const s = entitiesState.find((x) => x.id === e.id)?.poa?.status;
            const badge = s ? POA_STATUS_BADGES[s] : null;
            return (
              <button
                key={e.id}
                onClick={() => setSelectedEntityId(e.id)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  selectedEntityId === e.id
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {e.legalEntity?.legalName ?? e.importerOfRecord?.name ?? e.id}
                {badge && <span className="ml-2 text-xs">{badge.label}</span>}
              </button>
            );
          })}
        </div>
      )}

      {entity && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{entity.legalEntity?.legalName ?? entity.importerOfRecord?.name}</span>
            <span>·</span>
            <span>{entityTypeLabel(entityType)}</span>
            {poa && (
              <>
                <span>·</span>
                <Badge variant={POA_STATUS_BADGES[poa.status]?.variant ?? "neutral"}>
                  {POA_STATUS_BADGES[poa.status]?.label ?? poa.status}
                </Badge>
              </>
            )}
          </div>

          {/* Executed */}
          {poa?.status === "executed" && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-semibold">POA Executed</span>
                </div>
              </CardHeader>
              <div className="px-5 pb-5 space-y-2 text-sm text-muted-foreground">
                <p>Signer: <strong className="text-foreground">{poa.signerName}</strong> ({poa.signerRole})</p>
                {poa.expirationDate && (
                  <p>Expires: {new Date(poa.expirationDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
                )}
                {poa.executedDocumentUrl && (
                  <a href={poa.executedDocumentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    View executed document <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </Card>
          )}

          {/* Out for signature */}
          {poa?.status === "out_for_signature" && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-semibold">Awaiting Signature</span>
                </div>
              </CardHeader>
              <div className="px-5 pb-5 space-y-3 text-sm">
                <p className="text-muted-foreground">
                  A signing link was sent to <strong className="text-foreground">{poa.signerName}</strong>.
                  The POA will be marked executed once they complete signing.
                </p>
                {signingUrl && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Signing link (share with signer):</p>
                    <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
                      <code className="text-xs text-foreground flex-1 break-all">{signingUrl}</code>
                      <a href={signingUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* No POA yet — create form */}
          {!poa && (
            <Card>
              <CardHeader>
                <h3 className="font-medium text-sm text-foreground">Create Power of Attorney</h3>
              </CardHeader>
              <div className="px-5 pb-5 space-y-4">
                {/* Template */}
                {templates.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Template</Label>
                    <select
                      value={templateId}
                      onChange={(e) => setTemplateId(e.target.value)}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground"
                    >
                      <option value="">No template (blank)</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}{t.termMonths ? ` — ${t.termMonths}mo term` : ""}{t.requiresNotarization ? " (notarization required)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Execution method */}
                <div className="space-y-1.5">
                  <Label>Execution method</Label>
                  <div className="flex flex-wrap gap-2">
                    {(["E_SIGN", "WET_INK", "WET_INK_NOTARIZED"] as ExecutionMethod[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setExecutionMethod(m)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                          executionMethod === m
                            ? "border-primary bg-primary/5 text-primary font-medium"
                            : "border-border text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {m === "E_SIGN" ? "E-sign (Qubere)" : m === "WET_INK" ? "Wet ink" : "Wet ink + Notarized"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Signer info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Signer full name</Label>
                    <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Jane Smith" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Signer title (optional)</Label>
                    <Input value={signerTitle} onChange={(e) => setSignerTitle(e.target.value)} placeholder="President" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Signer authority</Label>
                    <select
                      value={signerRole}
                      onChange={(e) => setSignerRole(e.target.value)}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground"
                    >
                      <option value="">Select…</option>
                      {validRoles.map((r) => (
                        <option key={r} value={r}>{SIGNER_ROLE_LABELS[r] ?? r}</option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">Valid roles for {entityTypeLabel(entityType)}</p>
                  </div>
                  {executionMethod === "E_SIGN" && (
                    <div className="space-y-1.5">
                      <Label>Signer email</Label>
                      <Input
                        type="email"
                        value={signerEmail}
                        onChange={(e) => setSignerEmail(e.target.value)}
                        placeholder="signer@company.com"
                      />
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleCreate}
                  disabled={creating || !signerName.trim() || !signerRole}
                  className="w-full"
                >
                  {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</> : "Create POA record"}
                </Button>
              </div>
            </Card>
          )}

          {/* Draft — ready to send or upload */}
          {poa?.status === "draft" && (
            <Card>
              <CardHeader>
                <h3 className="font-medium text-sm text-foreground">
                  {poa.executionMethod === "E_SIGN" ? "Send for e-signature" : "Upload executed document"}
                </h3>
              </CardHeader>
              <div className="px-5 pb-5 space-y-4">
                {poa.executionMethod === "E_SIGN" ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Clicking send will generate a secure signing link for{" "}
                      <strong className="text-foreground">{poa.signerName}</strong>. Share the link with
                      them — no Qubere account required to sign.
                    </p>
                    <Button onClick={handleSendEnvelope} disabled={sending} className="w-full">
                      {sending ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</>
                      ) : (
                        <><Send className="w-4 h-4 mr-2" />Generate signing link</>
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Upload the signed PDF after{" "}
                      <strong className="text-foreground">{poa.signerName}</strong> returns the
                      wet-ink executed document.
                    </p>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label>Signed PDF</Label>
                        <input
                          type="file"
                          accept="application/pdf"
                          onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                          className="text-sm text-foreground"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Attestation (your confirmation of signer authority)</Label>
                        <Input
                          value={attestationNote}
                          onChange={(e) => setAttestationNote(e.target.value)}
                          placeholder="I verified this signer's authority via corporate resolution dated…"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={notarized} onChange={(e) => setNotarized(e.target.checked)} />
                        Document is notarized
                      </label>
                      <Button
                        onClick={handleUpload}
                        disabled={uploading || !uploadFile || !attestationNote.trim()}
                        className="w-full"
                      >
                        {uploading ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading…</>
                        ) : (
                          <><Upload className="w-4 h-4 mr-2" />Upload executed POA</>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}

          {/* Revoke — only for non-draft/non-revoked POAs */}
          {poa && !["draft", "revoked"].includes(poa.status) && (
            <details className="border border-border rounded-xl">
              <summary className="px-4 py-3 text-sm text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-2">
                <RotateCcw className="w-3.5 h-3.5" /> Revoke this POA
              </summary>
              <div className="px-4 pb-4 pt-2 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Revocation suspends any active onboarding case. A new POA must be created before CBP
                  filings can resume.
                </p>
                <div className="space-y-1.5">
                  <Label>Reason for revocation</Label>
                  <Input
                    value={revokeReason}
                    onChange={(e) => setRevokeReason(e.target.value)}
                    placeholder="Signer left the company"
                  />
                </div>
                <Button
                  variant="danger"
                  onClick={handleRevoke}
                  disabled={revoking || !revokeReason.trim()}
                >
                  {revoking ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Revoking…</> : "Revoke POA"}
                </Button>
              </div>
            </details>
          )}
        </div>
      )}

      {error && (
        <div className="text-sm text-destructive border border-destructive/30 rounded-lg px-4 py-3 bg-destructive/5">
          {error}
        </div>
      )}

      {/* Continue */}
      {allExecuted && (
        <div className="pt-2">
          <Button onClick={onSaved} className="w-full">
            Continue to next step
          </Button>
        </div>
      )}
    </div>
  );
}
