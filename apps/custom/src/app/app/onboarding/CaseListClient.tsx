"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus, AlertTriangle, ArrowRight } from "lucide-react";
import { PanelHeading } from "@/components/PanelHeading";
import { Button, Input, Badge } from "@/components/ui";
import { NewCaseModal } from "@/components/onboarding/NewCaseModal";

interface CaseItem {
  id: string;
  path: string;
  status: string;
  currentStep: number;
  createdAt: string;
  client: { id: string; name: string } | null;
  primaryImporter: { id: string; name: string } | null;
  entities: Array<{ screeningStatus: string; bondCoverage: string }>;
}

interface Props {
  cases: CaseItem[];
  brokerProfileStatus: string | null;
}

const STATUS_VARIANTS: Record<string, "success" | "warning" | "danger" | "info" | "neutral" | "default"> = {
  draft: "neutral",
  in_progress: "info",
  awaiting_bond: "warning",
  awaiting_signature: "warning",
  blocked_screening: "danger",
  blocked_bond: "danger",
  ready_to_activate: "success",
  active: "success",
  suspended: "warning",
  withdrawn: "neutral",
};

const PATH_LABELS: Record<string, string> = {
  STANDARD: "Standard",
  SWITCHING: "Broker switch",
  NON_RESIDENT: "Non-resident",
  BULK: "Bulk",
  ERP: "ERP",
};

const STEP_LABELS: Record<number, string> = {
  1: "Legal entity",
  2: "5106",
  3: "Power of attorney",
  4: "Bond",
  5: "Screening",
  6: "Billing",
  7: "Review & activate",
};

function primaryBlocker(c: CaseItem): string | null {
  if (c.status === "blocked_screening") return "Screening blocked";
  if (c.status === "blocked_bond") return "Bond insufficient";
  if (c.status === "awaiting_signature") return "Awaiting POA signature";
  if (c.status === "awaiting_bond") return "Bond application pending";
  return null;
}

export function CaseListClient({ cases, brokerProfileStatus }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [showNew, setShowNew] = useState(false);

  const filtered = cases.filter((c) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      c.client?.name.toLowerCase().includes(s) ||
      c.primaryImporter?.name.toLowerCase().includes(s) ||
      c.id.toLowerCase().includes(s) ||
      c.status.includes(s)
    );
  });

  const active = filtered.filter((c) => c.status === "active");
  const inFlight = filtered.filter((c) => c.status !== "active" && c.status !== "withdrawn");
  const withdrawn = filtered.filter((c) => c.status === "withdrawn");

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PanelHeading
        icon={ClipboardList}
        badge="Importer Onboarding"
        title="Onboarding"
        subtitle="Guided importer activation — legal entity, CBP 5106, Power of Attorney, bond verification, and screening."
      />

      {brokerProfileStatus && brokerProfileStatus !== "ready" && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <span className="font-medium text-amber-800">Broker compliance profile incomplete.</span>{" "}
            <span className="text-amber-700">
              Your broker license, national permit, and filer credentials must be configured before importers can be activated.{" "}
            </span>
            <Link href="/app/admin/broker-compliance" className="underline font-medium text-amber-800">
              Configure now →
            </Link>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Input
          placeholder="Search by client name, importer, or case ID…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
        <Button onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 mr-1" /> Onboard importer
        </Button>
        <Link href="/app/onboarding/import">
          <Button variant="secondary">Bulk import</Button>
        </Link>
      </div>

      {cases.length === 0 && (
        <div className="text-center py-16 text-ink-muted space-y-3">
          <ClipboardList className="h-10 w-10 mx-auto opacity-30" />
          <p className="font-medium">No onboarding cases yet</p>
          <p className="text-sm max-w-sm mx-auto">
            Start here to guide an importer through CBP registration, Power of Attorney, and bond verification before their first filing.
          </p>
          <Button onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-1" /> Onboard your first importer
          </Button>
        </div>
      )}

      {inFlight.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">In progress</h2>
          <CaseTable rows={inFlight} onOpen={(id) => router.push(`/app/onboarding/${id}`)} />
        </section>
      )}

      {active.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">Activated</h2>
          <CaseTable rows={active} onOpen={(id) => router.push(`/app/onboarding/${id}`)} />
        </section>
      )}

      {withdrawn.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">Withdrawn</h2>
          <CaseTable rows={withdrawn} onOpen={(id) => router.push(`/app/onboarding/${id}`)} />
        </section>
      )}

      {showNew && <NewCaseModal onClose={() => setShowNew(false)} />}
    </div>
  );
}

function CaseTable({ rows, onOpen }: { rows: CaseItem[]; onOpen: (id: string) => void }) {
  return (
    <div className="rounded-xl border divide-y text-sm">
      {rows.map((c) => {
        const blocker = primaryBlocker(c);
        return (
          <div
            key={c.id}
            className="flex items-center gap-4 px-4 py-3 hover:bg-surface-muted cursor-pointer"
            onClick={() => onOpen(c.id)}
          >
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{c.client?.name ?? c.primaryImporter?.name ?? c.id}</div>
              {c.primaryImporter && c.client && (
                <div className="text-xs text-ink-muted">{c.primaryImporter.name}</div>
              )}
            </div>
            <Badge variant="neutral" className="text-xs shrink-0">
              {PATH_LABELS[c.path] ?? c.path}
            </Badge>
            <div className="text-xs text-ink-muted shrink-0">
              Step {c.currentStep}: {STEP_LABELS[c.currentStep] ?? "—"}
            </div>
            {blocker && (
              <div className="flex items-center gap-1 text-xs text-red-600 shrink-0">
                <AlertTriangle className="h-3 w-3" /> {blocker}
              </div>
            )}
            <Badge variant={STATUS_VARIANTS[c.status] ?? "neutral"} className="shrink-0">
              {c.status.replace(/_/g, " ")}
            </Badge>
            <ArrowRight className="h-4 w-4 text-ink-muted shrink-0" />
          </div>
        );
      })}
    </div>
  );
}
