"use client";

import { useState } from "react";

interface Props {
  token: string;
  signerName: string;
  signerRole: string;
  signerTitle?: string;
  importerName: string;
  grantedByEntity: string;
  expirationDate: string | null;
}

type State = "idle" | "submitting" | "done" | "error";

export default function SignPageClient({
  token,
  signerName,
  signerRole,
  importerName,
  grantedByEntity,
  expirationDate,
}: Props) {
  const [typedName, setTypedName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const nameMatches = typedName.trim().toLowerCase() === signerName.trim().toLowerCase();
  const canSign = agreed && nameMatches && state === "idle";

  async function handleSign() {
    setState("submitting");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signerNameAttestation: typedName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error?.message ?? "Signing failed — please try again.");
        setState("error");
        return;
      }
      setState("done");
    } catch {
      setErrorMsg("Network error — please check your connection and try again.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md text-center space-y-4 p-8">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Power of Attorney signed</h1>
          <p className="text-muted-foreground">
            Thank you, <strong>{typedName}</strong>. Your signature has been recorded. Your customs
            broker will receive a confirmation.
          </p>
          {expirationDate && (
            <p className="text-sm text-muted-foreground">
              This authorization expires on{" "}
              {new Date(expirationDate).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
              .
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center py-12 px-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Power of Attorney</p>
          <h1 className="text-2xl font-semibold text-foreground">Review and sign</h1>
          <p className="text-muted-foreground text-sm">
            You have been asked to authorize Qubere as customs broker for <strong>{importerName}</strong>.
          </p>
        </div>

        {/* Document summary card */}
        <div className="border border-border rounded-xl p-5 space-y-3 bg-card">
          <h2 className="text-sm font-semibold text-foreground">Authorization summary</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Granting entity</dt>
              <dd className="text-foreground font-medium">{grantedByEntity}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Signer</dt>
              <dd className="text-foreground font-medium">{signerName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Capacity</dt>
              <dd className="text-foreground font-medium">{signerRole}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Expires</dt>
              <dd className="text-foreground font-medium">
                {expirationDate
                  ? new Date(expirationDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                  : "No expiration (indefinite)"}
              </dd>
            </div>
          </dl>
        </div>

        {/* Legal disclosure */}
        <div className="border border-border rounded-xl p-5 bg-muted/30 space-y-2 text-sm text-foreground">
          <p>
            By signing below, you authorize Qubere, Inc. (a licensed U.S. Customs Broker) to act as
            your agent and attorney-in-fact for the importation of merchandise into the United States,
            including filing of all documents and payments as required by U.S. Customs and Border
            Protection.
          </p>
          <p>
            This authorization is granted under 19 C.F.R. § 141.32 and may be revoked at any time by
            written notice to your broker.
          </p>
        </div>

        {/* Consent + name entry */}
        <div className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <div className="w-4 h-4 border-2 border-border rounded peer-checked:bg-primary peer-checked:border-primary flex items-center justify-center">
                {agreed && (
                  <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-sm text-foreground">
              I have read and understand the authorization above, and I have the authority to sign on
              behalf of <strong>{grantedByEntity}</strong> in my capacity as <strong>{signerRole}</strong>.
            </span>
          </label>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-foreground">
              Type your full name to sign
            </label>
            <p className="text-xs text-muted-foreground">
              Enter your name exactly as shown: <strong>{signerName}</strong>
            </p>
            <input
              type="text"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder={signerName}
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              disabled={state === "submitting"}
              autoComplete="off"
            />
            {typedName.length > 0 && !nameMatches && (
              <p className="text-xs text-destructive">Name does not match — please type your name exactly as shown above.</p>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="text-sm text-destructive border border-destructive/30 rounded-lg px-4 py-3 bg-destructive/5">
            {errorMsg}
          </div>
        )}

        <button
          onClick={handleSign}
          disabled={!canSign}
          className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
        >
          {state === "submitting" ? "Signing…" : "I agree and sign"}
        </button>

        <p className="text-xs text-center text-muted-foreground">
          Your IP address, timestamp, and name confirmation will be recorded as your electronic signature.
        </p>
      </div>
    </div>
  );
}
