"use client";

import { useState } from "react";
import { CheckCircle2, Circle, AlertCircle, Minus, ChevronRight, AlertTriangle } from "lucide-react";
import { Button, Card, CardHeader, Input, Label, Modal } from "@/components/ui";
import type { ChecklistItem, ChecklistStatus } from "@/modules/onboarding/readiness";

interface ReadinessResult {
  ready: boolean;
  checklist: ChecklistItem[];
}

interface Props {
  caseData: {
    id: string;
    status: string;
    path: string;
    client: { name: string } | null;
    entities: unknown[];
  };
  readiness: ReadinessResult;
  onActivated: () => void;
  onStepClick: (step: number) => void;
}

const CHECKLIST_STEPS: Record<string, number> = {
  legal_entity: 1,
  five_oh_six: 2,
  poa: 3,
  bond: 4,
  screening: 5,
  billing: 6,
};

function ChecklistIcon({ status }: { status: ChecklistStatus }) {
  if (status === "done") return <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />;
  if (status === "blocked") return <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />;
  if (status === "in_progress") return <Circle className="h-5 w-5 text-blue-400 shrink-0" />;
  if (status === "waived") return <Minus className="h-5 w-5 text-ink-muted shrink-0" />;
  return <Circle className="h-5 w-5 text-gray-300 shrink-0" />;
}

interface WaiverModalProps {
  item: ChecklistItem;
  caseId: string;
  onClose: () => void;
  onWaived: () => void;
}

function WaiverModal({ item, caseId, onClose, onWaived }: WaiverModalProps) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleWaive() {
    if (!reason.trim()) { setError("Reason is required"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/onboarding/cases/${caseId}/waivers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklistItem: item.item, reason }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? "Failed to grant waiver");
      }
      onWaived();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setSaving(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} closeDisabled={saving} titleId="waiver-modal-title">
      <h2 id="waiver-modal-title" className="text-base font-semibold">Waive: {item.label}</h2>
      <div className="space-y-3">
        <p className="text-sm text-ink-muted">
          Granting a waiver allows activation to proceed without this requirement being met.
          The waiver is permanently logged and the risk remains visible everywhere this importer appears.
          This action requires <strong>compliance override</strong> authority.
        </p>
        <div className="space-y-1">
          <Label htmlFor="waiverReason">Reason for waiver *</Label>
          <Input
            id="waiverReason"
            placeholder="Describe why this requirement is being waived…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="danger" onClick={handleWaive} disabled={saving}>
          {saving ? "Granting…" : "Grant waiver"}
        </Button>
      </div>
    </Modal>
  );
}

export function StepReviewActivate({ caseData, readiness, onActivated, onStepClick }: Props) {
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waiverItem, setWaiverItem] = useState<ChecklistItem | null>(null);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const waivedItems = readiness.checklist.filter((i) => i.status === "waived");
  const isAlreadyActive = caseData.status === "active";

  async function handleActivate() {
    setActivating(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/cases/${caseData.id}/activate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          const blockerList = (data.error?.blockers ?? []) as ChecklistItem[];
          throw new Error(`Not ready: ${blockerList.map((b) => b.label).join(", ")}`);
        }
        throw new Error(data.error?.message ?? "Activation failed");
      }
      onActivated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setActivating(false);
    }
  }

  async function handleWithdraw() {
    if (!withdrawReason.trim()) return;
    setWithdrawing(true);
    try {
      await fetch(`/api/onboarding/cases/${caseData.id}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: withdrawReason }),
      });
      setShowWithdraw(false);
      onActivated();
    } catch {
      setWithdrawing(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Review &amp; activate</h2>
        <p className="text-sm text-ink-muted mt-1">
          All checklist items must be complete (or explicitly waived) before {caseData.client?.name ?? "this importer"} can be activated for filing.
        </p>
      </div>

      {isAlreadyActive && (
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 font-medium">
          This importer is active and ready for filing.
        </div>
      )}

      {waivedItems.length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Activated with {waivedItems.length} waived {waivedItems.length === 1 ? "requirement" : "requirements"}. Risk remains on record.</span>
        </div>
      )}

      <Card>
        <CardHeader>Readiness checklist</CardHeader>
        <div className="divide-y px-6 pb-4">
          {readiness.checklist.map((item) => (
            <div key={item.item} className="py-3 flex items-start gap-3">
              <ChecklistIcon status={item.status} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{item.label}</div>
                {item.blocker && item.status !== "waived" && (
                  <div className="text-xs text-red-600 mt-0.5">{item.blocker}</div>
                )}
                {item.status === "waived" && (
                  <div className="text-xs text-ink-muted mt-0.5">Waived — risk logged.</div>
                )}
              </div>
              {item.status !== "done" && item.status !== "waived" && (
                <div className="flex items-center gap-2 shrink-0">
                  {CHECKLIST_STEPS[item.item] && (
                    <button
                      className="text-xs text-brand hover:underline flex items-center gap-0.5"
                      onClick={() => onStepClick(CHECKLIST_STEPS[item.item])}
                    >
                      Go to step <ChevronRight className="h-3 w-3" />
                    </button>
                  )}
                  {item.status !== "blocked" && (
                    <button
                      className="text-xs text-ink-muted hover:underline"
                      onClick={() => setWaiverItem(item)}
                    >
                      Waive
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {!isAlreadyActive && (
        <div className="flex items-center justify-between">
          <Button variant="secondary" size="sm" onClick={() => setShowWithdraw(true)}>
            Withdraw case
          </Button>
          <Button
            onClick={handleActivate}
            disabled={activating || !readiness.ready}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {activating ? "Activating…" : "Activate importer"}
          </Button>
        </div>
      )}

      {!readiness.ready && !isAlreadyActive && (
        <p className="text-xs text-ink-muted">
          Complete all checklist items above to enable activation. Waivers require compliance-override authority and are permanently audited.
        </p>
      )}

      {waiverItem && (
        <WaiverModal
          item={waiverItem}
          caseId={caseData.id}
          onClose={() => setWaiverItem(null)}
          onWaived={() => { setWaiverItem(null); onActivated(); }}
        />
      )}

      {showWithdraw && (
        <Modal isOpen onClose={() => setShowWithdraw(false)} closeDisabled={withdrawing} titleId="withdraw-modal-title">
          <h2 id="withdraw-modal-title" className="text-base font-semibold">Withdraw onboarding case</h2>
          <div className="space-y-2">
            <Label htmlFor="withdrawReason">Reason *</Label>
            <Input
              id="withdrawReason"
              placeholder="Why is this case being withdrawn?"
              value={withdrawReason}
              onChange={(e) => setWithdrawReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowWithdraw(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleWithdraw} disabled={withdrawing || !withdrawReason.trim()}>
              {withdrawing ? "Withdrawing…" : "Withdraw"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
