"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ShieldAlert, Scale, DollarSign, CheckCircle2, Loader2 } from "lucide-react";
import type {
  TodayLane,
  TodayLaneItem,
  TodayLaneSummary,
  TodaySeverity,
} from "@/modules/today/todayLanes";

const SEVERITY_DOT: Record<TodaySeverity, string> = {
  critical: "bg-red-500",
  high: "bg-amber-400",
  normal: "bg-gray-300",
};

const SEVERITY_LABEL: Record<TodaySeverity, string> = {
  critical: "Critical",
  high: "High",
  normal: "Normal",
};

const LANE_META: Record<
  Exclude<TodayLane, "operations">,
  { title: string; blurb: string; cta: string; Icon: typeof Scale }
> = {
  compliance: {
    title: "Compliance",
    blurb:
      "Open review-queue findings and screening hits across every shipment. Resolve here or open the Compliance workspace for the full disposition.",
    cta: "Open in Compliance",
    Icon: Scale,
  },
  billing: {
    title: "Billing",
    blurb: "Open billing exceptions and revenue-leakage alerts. Resolve or waive them here or in the Billing workspace.",
    cta: "Open in Billing",
    Icon: DollarSign,
  },
};

interface RowAction {
  key: string;
  label: string;
  /** Visual weight. */
  tone: "primary" | "default" | "danger";
  /** A reason/note is mandatory (button stays disabled until one is typed). */
  noteRequired: boolean;
  notePlaceholder: string;
  run: (item: TodayLaneItem, note: string) => Promise<Response>;
}

function actionsForItem(
  item: TodayLaneItem,
  perms: { canResolveCompliance: boolean; canResolveBilling: boolean; canWaiveBilling: boolean }
): RowAction[] {
  if (item.kind === "review-finding" && perms.canResolveCompliance) {
    return [
      {
        key: "resolve",
        label: "Resolve",
        tone: "primary",
        noteRequired: false,
        notePlaceholder: "Optional note for the audit timeline",
        run: (it, note) =>
          fetch(`/api/findings/${encodeURIComponent(it.id)}/resolve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "Resolved", notes: note || undefined }),
          }),
      },
      {
        key: "accept-risk",
        label: "Accept risk",
        tone: "default",
        noteRequired: true,
        notePlaceholder: "State the reasonable-care basis for accepting this risk",
        run: (it, note) =>
          fetch(`/api/findings/${encodeURIComponent(it.id)}/resolve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "AcceptedRisk", notes: note }),
          }),
      },
    ];
  }

  if (item.kind === "screening-finding" && perms.canResolveCompliance) {
    return [
      {
        key: "resolve",
        label: "Mark resolved",
        tone: "primary",
        noteRequired: false,
        notePlaceholder: "",
        run: (it) =>
          fetch(`/api/screening-findings/${encodeURIComponent(it.id)}/resolve`, { method: "POST" }),
      },
    ];
  }

  if (item.kind === "billing-exception") {
    const out: RowAction[] = [];
    const billing = (disposition: "RESOLVED" | "WAIVED") => (it: TodayLaneItem, note: string) =>
      fetch(`/api/billing/exceptions/${encodeURIComponent(it.id)}/disposition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disposition, reason: note }),
      });
    if (perms.canResolveBilling) {
      out.push({
        key: "resolve",
        label: "Resolve",
        tone: "primary",
        noteRequired: true,
        notePlaceholder: "How was this resolved? (recorded on the exception)",
        run: billing("RESOLVED"),
      });
    }
    if (perms.canWaiveBilling) {
      out.push({
        key: "waive",
        label: "Waive",
        tone: "danger",
        noteRequired: true,
        notePlaceholder: "Why is this being waived?",
        run: billing("WAIVED"),
      });
    }
    return out;
  }

  return [];
}

const TONE_CLASS: Record<RowAction["tone"], string> = {
  primary: "bg-brand text-white hover:bg-brand/90",
  default: "bg-surface-muted text-ink hover:bg-white border border-border",
  danger: "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200",
};

function LaneRow({
  item,
  actions,
  cta,
  onDone,
}: {
  item: TodayLaneItem;
  actions: RowAction[];
  cta: string;
  onDone: (id: string) => void;
}) {
  const [openAction, setOpenAction] = useState<RowAction | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!openAction) return;
    if (openAction.noteRequired && !note.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await openAction.run(item, note.trim());
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Request failed (${res.status})`);
      }
      onDone(item.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  };

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <span
          className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${SEVERITY_DOT[item.severity]}`}
          title={SEVERITY_LABEL[item.severity]}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{item.title}</p>
          <p className="text-xs text-ink-muted mt-0.5 line-clamp-2">{item.summary}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {actions.map((a) => (
            <button
              key={a.key}
              onClick={() => {
                setOpenAction((cur) => (cur?.key === a.key ? null : a));
                setNote("");
                setError(null);
              }}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                openAction?.key === a.key ? "ring-2 ring-brand/30 " : ""
              }${TONE_CLASS[a.tone]}`}
            >
              {a.label}
            </button>
          ))}
          <Link
            href={item.href}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold text-brand hover:bg-brand/10 transition-colors"
          >
            {cta}
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {openAction && (
        <div className="mt-2.5 ml-5 rounded-xl border border-border bg-surface-muted/50 p-3 space-y-2">
          {(openAction.noteRequired || openAction.notePlaceholder) && (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={openAction.notePlaceholder}
              rows={2}
              className="w-full text-xs rounded-lg border border-border bg-white p-2 outline-none focus:border-brand resize-y"
            />
          )}
          {error && <p className="text-[11px] text-red-600">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={confirm}
              disabled={busy || (openAction.noteRequired && !note.trim())}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-[11px] font-bold hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy && <Loader2 className="w-3 h-3 animate-spin" />}
              Confirm {openAction.label.toLowerCase()}
            </button>
            <button
              onClick={() => setOpenAction(null)}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-ink-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export function TodayLanePanel({
  summary,
  lane,
  canResolveCompliance = false,
  canResolveBilling = false,
  canWaiveBilling = false,
  onDisposed,
}: {
  summary: TodayLaneSummary | null;
  lane: Exclude<TodayLane, "operations">;
  canResolveCompliance?: boolean;
  canResolveBilling?: boolean;
  canWaiveBilling?: boolean;
  onDisposed?: (lane: Exclude<TodayLane, "operations">, itemId: string) => void;
}) {
  const meta = LANE_META[lane];
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  const perms = { canResolveCompliance, canResolveBilling, canWaiveBilling };

  const groups = useMemo(() => {
    if (!summary) return [];
    return summary.groups
      .map((g) => ({ ...g, items: g.items.filter((it) => !doneIds.has(it.id)) }))
      .filter((g) => g.items.length > 0);
  }, [summary, doneIds]);

  const markDone = (id: string) => {
    setDoneIds((prev) => new Set(prev).add(id));
    onDisposed?.(lane, id);
  };

  if (!summary || groups.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-border shadow-2xs p-10 text-center">
        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-ink">
          {summary && summary.groups.length > 0 ? `All ${meta.title.toLowerCase()} items cleared` : `Nothing open in ${meta.title}`}
        </h3>
        <p className="text-xs text-ink-muted max-w-sm mx-auto mt-1">{meta.blurb}</p>
      </div>
    );
  }

  const remaining = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 bg-white rounded-2xl border border-border shadow-2xs p-4">
        <div className="w-9 h-9 rounded-xl bg-surface-muted border border-border flex items-center justify-center shrink-0">
          <meta.Icon className="w-4 h-4 text-brand" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">
            {remaining} open {meta.title.toLowerCase()} item{remaining === 1 ? "" : "s"}
          </p>
          <p className="text-xs text-ink-muted mt-0.5">{meta.blurb}</p>
        </div>
      </div>

      {groups.map((group) => (
        <div key={group.key} className="bg-white rounded-2xl border border-border shadow-2xs overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-surface-muted/50">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${SEVERITY_DOT[group.severity]}`} />
              <span className="text-sm font-bold text-ink truncate">{group.label}</span>
              {group.clientName && <span className="text-xs text-ink-muted truncate">· {group.clientName}</span>}
            </div>
            <span className="text-[11px] font-bold text-ink-muted shrink-0">
              {group.items.length} item{group.items.length === 1 ? "" : "s"}
            </span>
          </div>

          <ul className="divide-y divide-border">
            {group.items.map((item) => (
              <LaneRow
                key={item.id}
                item={item}
                actions={actionsForItem(item, perms)}
                cta={meta.cta}
                onDone={markDone}
              />
            ))}
          </ul>
        </div>
      ))}

      <p className="flex items-center gap-1.5 text-[11px] text-ink-muted px-1">
        <ShieldAlert className="w-3.5 h-3.5" />
        Every resolve or waive here is written to the {meta.title} audit trail, exactly as it is from the workspace.
      </p>
    </div>
  );
}
