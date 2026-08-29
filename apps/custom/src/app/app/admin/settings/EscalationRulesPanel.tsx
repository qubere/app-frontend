"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Clock, AlertTriangle, Plus, CheckCircle2, RefreshCw, Activity, Zap } from "lucide-react";

interface SlaPolicyRow {
  id?: string;
  workKind: string;
  priority: string | null;
  reviewHours: number;
  resolveHours: number | null;
  businessHoursOnly: boolean;
}

interface EscalationRuleRow {
  id?: string;
  appliesToKinds: string[];
  trigger: string;
  thresholdHours: number;
  escalateTo: string;
  maxLevel: number;
  notifyChannel: string;
  active: boolean;
}

interface EscalationEventRow {
  id: string;
  workKind: string;
  workItemId: string;
  level: number;
  reason: string;
  createdAt: string;
  acknowledgedAt?: string | null;
}

export function EscalationRulesPanel({
  initialSla,
  initialRules,
  initialEvents,
}: {
  initialSla?: SlaPolicyRow[];
  initialRules?: EscalationRuleRow[];
  initialEvents?: EscalationEventRow[];
}) {
  const router = useRouter();
  const [slaList, setSlaList] = useState<SlaPolicyRow[]>([]);
  const [rules, setRules] = useState<EscalationRuleRow[]>([]);
  const [events, setEvents] = useState<EscalationEventRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [sweepResultText, setSweepResultText] = useState<string | null>(null);

  useEffect(() => {
    if (initialSla && initialSla.length > 0) {
      setSlaList(initialSla);
    } else {
      setSlaList([
        { workKind: "decision", priority: "critical", reviewHours: 4, resolveHours: 12, businessHoursOnly: true },
        { workKind: "decision", priority: "high", reviewHours: 12, resolveHours: 24, businessHoursOnly: true },
        { workKind: "decision", priority: "normal", reviewHours: 48, resolveHours: 72, businessHoursOnly: true },
        { workKind: "exception", priority: "critical", reviewHours: 6, resolveHours: 18, businessHoursOnly: true },
      ]);
    }

    if (initialRules && initialRules.length > 0) {
      setRules(initialRules);
    } else {
      setRules([
        {
          appliesToKinds: ["decision", "exception"],
          trigger: "SLA_BREACH",
          thresholdHours: 2,
          escalateTo: "TEAM_MANAGER",
          maxLevel: 2,
          notifyChannel: "both",
          active: true,
        },
      ]);
    }

    if (initialEvents) {
      setEvents(initialEvents);
    }
  }, [initialSla, initialRules, initialEvents]);

  const handleSave = async () => {
    setSaving(true);
    setSavedSuccess(false);
    try {
      const res = await fetch("/api/admin/settings/escalation-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sla: slaList, rules }),
      });
      if (res.ok) {
        setSavedSuccess(true);
        router.refresh();
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save SLA rules", err);
    } finally {
      setSaving(false);
    }
  };

  const handleRunSweep = async () => {
    setSweeping(true);
    setSweepResultText(null);
    try {
      const res = await fetch("/api/cron/sla-sweep", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setSweepResultText(`Sweep completed: ${data.result?.breachedDecisions ?? 0} breached decisions, ${data.result?.escalationsCreated ?? 0} escalations created.`);
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to run SLA sweep", err);
    } finally {
      setSweeping(false);
    }
  };

  const addRule = () => {
    setRules((prev) => [
      ...prev,
      {
        appliesToKinds: ["decision"],
        trigger: "SLA_BREACH",
        thresholdHours: 4,
        escalateTo: "TEAM_MANAGER",
        maxLevel: 2,
        notifyChannel: "both",
        active: true,
      },
    ]);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-8 shadow-2xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              SLA Clocks & Escalation Rules
            </h3>
            <p className="text-xs text-slate-500">
              Set target turnaround hours and configure autonomous escalation workflows for SLA breaches.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            disabled={sweeping}
            onClick={handleRunSweep}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 ${sweeping ? "animate-spin text-amber-600" : "text-amber-600"}`} />
            <span>{sweeping ? "Sweeping..." : "Run SLA Sweep Now"}</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-4 py-2 bg-brand hover:bg-brand/90 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center space-x-2 disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : savedSuccess ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            ) : null}
            <span>{saving ? "Saving..." : savedSuccess ? "Saved!" : "Save SLA & Rules"}</span>
          </button>
        </div>
      </div>

      {sweepResultText && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium">
          {sweepResultText}
        </div>
      )}

      {/* SLA Hours Table */}
      <div className="space-y-3">
        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
          Service Level Agreement Targets (SLA)
        </h4>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="p-3">Work Kind</th>
                <th className="p-3">Priority</th>
                <th className="p-3">Review SLA (Hours)</th>
                <th className="p-3">Resolve SLA (Hours)</th>
                <th className="p-3">Business Hours Only</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {slaList.map((s, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="p-3 font-semibold text-slate-900 capitalize">{s.workKind}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      s.priority === "critical" ? "bg-red-100 text-red-800" : s.priority === "high" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"
                    }`}>
                      {s.priority || "All Priorities"}
                    </span>
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      value={s.reviewHours}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setSlaList((prev) => {
                          const next = [...prev];
                          next[idx].reviewHours = val;
                          return next;
                        });
                      }}
                      className="w-20 px-2 py-1 bg-white border border-slate-300 rounded font-semibold text-xs text-slate-900"
                    />
                    <span className="ml-1 text-slate-500">hours</span>
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      value={s.resolveHours || ""}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : null;
                        setSlaList((prev) => {
                          const next = [...prev];
                          next[idx].resolveHours = val;
                          return next;
                        });
                      }}
                      placeholder="Optional"
                      className="w-20 px-2 py-1 bg-white border border-slate-300 rounded font-medium text-xs text-slate-900"
                    />
                    <span className="ml-1 text-slate-500">hours</span>
                  </td>
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={s.businessHoursOnly}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSlaList((prev) => {
                          const next = [...prev];
                          next[idx].businessHoursOnly = checked;
                          return next;
                        });
                      }}
                      className="rounded border-slate-300 text-brand"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Escalation Rules List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
            Active Escalation Rules
          </h4>
          <button
            type="button"
            onClick={addRule}
            className="text-xs font-bold text-brand hover:underline flex items-center space-x-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Escalation Rule</span>
          </button>
        </div>

        <div className="space-y-3">
          {rules.map((rule, idx) => (
            <div key={idx} className="p-4 border border-slate-200 rounded-xl bg-slate-50/40 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Rule #{idx + 1}: When an item is SLA breached for</span>
                  <input
                    type="number"
                    value={rule.thresholdHours}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setRules((prev) => {
                        const next = [...prev];
                        next[idx].thresholdHours = val;
                        return next;
                      });
                    }}
                    className="w-16 px-2 py-1 bg-white border border-slate-300 rounded text-center text-xs font-bold"
                  />
                  <span>hours</span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs font-medium text-slate-600">Escalate to:</span>
                  <select
                    value={rule.escalateTo}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRules((prev) => {
                        const next = [...prev];
                        next[idx].escalateTo = val;
                        return next;
                      });
                    }}
                    className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                  >
                    <option value="TEAM_MANAGER">Team Manager</option>
                    <option value="ROLE:LICENSED_BROKER">Licensed Broker</option>
                    <option value="ACCOUNT_OWNER">Account Owner</option>
                  </select>
                </div>
              </div>

              <p className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
                Rule Summary: "When a decision or exception is SLA-breached for {rule.thresholdHours}h, escalate to {rule.escalateTo.replace(/_/g, " ").toLowerCase()} and notify by in-app + email."
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Escalations Log */}
      <div className="space-y-3">
        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-slate-500" />
          <span>Recent Escalation Events Audit Log</span>
        </h4>

        {events.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No recent escalation events recorded.</p>
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="p-2.5">Time</th>
                  <th className="p-2.5">Work Item</th>
                  <th className="p-2.5">Level</th>
                  <th className="p-2.5">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-50">
                    <td className="p-2.5 text-slate-500 whitespace-nowrap">{new Date(evt.createdAt).toLocaleString()}</td>
                    <td className="p-2.5 font-bold text-slate-900 capitalize">{evt.workKind}:{evt.workItemId.slice(0, 8)}</td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded-full text-[10px]">
                        Level {evt.level}
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-700">{evt.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
