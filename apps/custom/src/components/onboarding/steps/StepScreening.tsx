"use client";

import { useState } from "react";
import { ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Button, Badge, Label } from "@/components/ui";

interface EntityScreening {
  id: string;
  importerNumber: string | null;
  importerNumberType: string;
  screeningStatus: string;
  legalEntity: { legalName: string } | null;
}

interface Props {
  caseId: string;
  entities: EntityScreening[];
  onSaved: () => Promise<void>;
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; badgeVariant: "success" | "warning" | "danger" | "neutral" }> = {
  pending:   { icon: <ShieldCheck className="h-5 w-5 text-gray-400" />, label: "Not screened", badgeVariant: "neutral" },
  passed:    { icon: <ShieldCheck className="h-5 w-5 text-emerald-500" />, label: "Cleared", badgeVariant: "success" },
  flagged:   { icon: <ShieldAlert className="h-5 w-5 text-amber-500" />, label: "Flagged — review", badgeVariant: "warning" },
  blocked:   { icon: <ShieldX className="h-5 w-5 text-red-500" />, label: "Blocked", badgeVariant: "danger" },
  overridden:{ icon: <ShieldCheck className="h-5 w-5 text-blue-500" />, label: "Override applied", badgeVariant: "neutral" },
};

function entityName(e: EntityScreening) {
  return e.legalEntity?.legalName ?? e.importerNumber ?? e.id;
}

export function StepScreening({ caseId, entities, onSaved }: Props) {
  const [localEntities, setLocalEntities] = useState<EntityScreening[]>(entities);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [screeningSummary, setScreeningSummary] = useState<string | null>(null);

  const [dispositionEntityId, setDispositionEntityId] = useState<string | null>(null);
  const [dispositionType, setDispositionType] = useState<"FALSE_POSITIVE" | "OVERRIDE" | "CONFIRMED_MATCH">("FALSE_POSITIVE");
  const [dispositionNote, setDispositionNote] = useState("");
  const [dispositionSaving, setDispositionSaving] = useState(false);
  const [dispositionError, setDispositionError] = useState<string | null>(null);

  async function runScreening() {
    setRunning(true);
    setRunError(null);
    setScreeningSummary(null);
    try {
      const res = await fetch(`/api/onboarding/cases/${caseId}/screen`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Screening failed");
      setScreeningSummary(data.message);
      // Refresh entity statuses from results
      if (Array.isArray(data.results)) {
        setLocalEntities((prev) =>
          prev.map((e) => {
            const r = data.results.find((x: { entityId: string; screeningStatus: string }) => x.entityId === e.id);
            return r ? { ...e, screeningStatus: r.screeningStatus } : e;
          })
        );
      }
    } catch (err: unknown) {
      setRunError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setRunning(false);
    }
  }

  async function handleDisposition() {
    if (!dispositionEntityId || !dispositionNote.trim()) return;
    setDispositionSaving(true);
    setDispositionError(null);
    try {
      const res = await fetch(`/api/onboarding/entity/${dispositionEntityId}/disposition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disposition: dispositionType, note: dispositionNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Disposition failed");
      // Update local state
      setLocalEntities((prev) =>
        prev.map((e) =>
          e.id === dispositionEntityId ? { ...e, screeningStatus: data.newStatus } : e
        )
      );
      setDispositionEntityId(null);
      setDispositionNote("");
    } catch (err: unknown) {
      setDispositionError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setDispositionSaving(false);
    }
  }

  const allCleared = localEntities.every(
    (e) => e.screeningStatus === "passed" || e.screeningStatus === "overridden"
  );
  const anyBlocked = localEntities.some((e) => e.screeningStatus === "blocked");
  const anyFlagged = localEntities.some((e) => e.screeningStatus === "flagged");

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">Step 5 — Denied-Party Screening</h2>
        <p className="text-sm text-ink-muted mt-1">
          Screens each importer entity against OFAC SDN, BIS Entity List, and UFLPA.
          Flagged results require an operator note; blocked results require a compliance-role override.
        </p>
      </div>

      {/* Entity list */}
      <div className="space-y-3">
        {localEntities.map((entity) => {
          const cfg = STATUS_CONFIG[entity.screeningStatus] ?? STATUS_CONFIG.pending;
          const needsDisposition = entity.screeningStatus === "flagged" || entity.screeningStatus === "blocked";
          return (
            <div key={entity.id} className="border rounded-lg p-4 flex items-start gap-3">
              <div className="mt-0.5 shrink-0">{cfg.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">{entityName(entity)}</span>
                  <Badge variant={cfg.badgeVariant} className="text-xs">{cfg.label}</Badge>
                </div>
                {entity.importerNumber && (
                  <div className="text-xs text-ink-muted mt-0.5">
                    {entity.importerNumberType}: {entity.importerNumber}
                  </div>
                )}
                {needsDisposition && (
                  <button
                    onClick={() => { setDispositionEntityId(entity.id); setDispositionNote(""); setDispositionError(null); }}
                    className="mt-2 text-xs text-blue-600 hover:underline"
                  >
                    {entity.screeningStatus === "blocked" ? "Apply override (compliance role required)" : "Add disposition note →"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Disposition panel */}
      {dispositionEntityId && (
        <div className="border rounded-lg p-4 bg-amber-50 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="font-medium text-sm">
              Disposition: {entityName(localEntities.find((e) => e.id === dispositionEntityId)!)}
            </span>
          </div>

          <div className="flex gap-3 flex-wrap">
            {(["FALSE_POSITIVE", "CONFIRMED_MATCH", "OVERRIDE"] as const).map((d) => (
              <label key={d} className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="radio"
                  name="disposition"
                  value={d}
                  checked={dispositionType === d}
                  onChange={() => setDispositionType(d)}
                  className="accent-blue-600"
                />
                {d === "FALSE_POSITIVE" ? "False positive (clear)" :
                 d === "CONFIRMED_MATCH" ? "Confirmed match (keep blocked)" :
                 "Override (compliance role)"}
              </label>
            ))}
          </div>

          <div>
            <Label className="text-xs">Operator note (required)</Label>
            <textarea
              value={dispositionNote}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDispositionNote(e.target.value)}
              placeholder="Explain your disposition decision…"
              className="mt-1 text-sm w-full border rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand/40"
              rows={3}
            />
          </div>

          {dispositionError && <p className="text-xs text-red-600">{dispositionError}</p>}

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleDisposition}
              disabled={dispositionSaving || !dispositionNote.trim()}
            >
              {dispositionSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Save disposition
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDispositionEntityId(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Summary / alerts */}
      {screeningSummary && (
        <div className={`rounded-lg p-3 text-sm flex items-center gap-2 ${
          anyBlocked ? "bg-red-50 text-red-700" :
          anyFlagged ? "bg-amber-50 text-amber-700" :
          "bg-emerald-50 text-emerald-700"
        }`}>
          {anyBlocked ? <ShieldX className="h-4 w-4 shrink-0" /> :
           anyFlagged ? <ShieldAlert className="h-4 w-4 shrink-0" /> :
           <CheckCircle2 className="h-4 w-4 shrink-0" />}
          {screeningSummary}
        </div>
      )}

      {runError && (
        <p className="text-sm text-red-600">{runError}</p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={runScreening} disabled={running} variant="secondary">
          {running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {localEntities.some((e) => e.screeningStatus !== "pending") ? "Re-run screening" : "Run screening"}
        </Button>

        {allCleared && (
          <Button onClick={onSaved}>
            Continue to Billing →
          </Button>
        )}
      </div>

      {anyBlocked && !allCleared && (
        <p className="text-xs text-ink-muted">
          A BLOCKED result requires a user with the <strong>compliance.override</strong> role to apply an override before this case can be activated.
        </p>
      )}
    </div>
  );
}
