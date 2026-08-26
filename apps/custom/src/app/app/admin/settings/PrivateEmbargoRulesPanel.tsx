"use client";

import { useState } from "react";
import { ShieldOff, Plus, Trash2, Info } from "lucide-react";

interface PrivateEmbargoRule {
  id: string;
  fromCountryCode: string | null;
  appliesToAllFromCountries: boolean;
  toCountryCode: string;
  embargoed: boolean;
  effectiveDate: string;
  expirationDate: string | null;
  reason: string | null;
  reference: string | null;
  status: string;
}

interface PrivateEmbargoRulesPanelProps {
  initialEnabled: boolean;
  initialRules: PrivateEmbargoRule[];
}

const emptyDraft = {
  fromCountryCode: "",
  appliesToAllFromCountries: false,
  toCountryCode: "",
  embargoed: true,
  effectiveDate: new Date().toISOString().slice(0, 10),
  expirationDate: "",
  reason: "",
  reference: "",
};

export function PrivateEmbargoRulesPanel({ initialEnabled, initialRules }: PrivateEmbargoRulesPanelProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [rules, setRules] = useState(initialRules);
  const [draft, setDraft] = useState(emptyDraft);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleEnabled = async (next: boolean) => {
    setEnabled(next);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/private-embargo-rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ privateEmbargoEnabled: next }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to save");
    } catch (e) {
      setEnabled(!next);
      setError(e instanceof Error ? e.message : "Failed to save");
    }
  };

  const createRule = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/private-embargo-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromCountryCode: draft.appliesToAllFromCountries ? null : draft.fromCountryCode || null,
          appliesToAllFromCountries: draft.appliesToAllFromCountries,
          toCountryCode: draft.toCountryCode,
          embargoed: draft.embargoed,
          effectiveDate: draft.effectiveDate,
          expirationDate: draft.expirationDate || null,
          reason: draft.reason || null,
          reference: draft.reference || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to create rule");
      setRules((prev) => [body.rule, ...prev]);
      setDraft(emptyDraft);
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create rule");
    } finally {
      setSaving(false);
    }
  };

  const disableRule = async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/settings/private-embargo-rules/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to disable rule");
      setRules((prev) => prev.map((r) => (r.id === id ? { ...r, status: "DISABLED" } : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to disable rule");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldOff className="w-5 h-5 text-brand" />
        <h2 className="text-base font-extrabold text-ink">Private Embargo Rules</h2>
      </div>
      <p className="text-sm text-ink-muted flex items-start gap-2">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-ink-muted" />
        Account-configured country-pair embargo/watch-list rules, evaluated before government/system embargo
        checks. These are <span className="font-semibold text-ink">private, account-owned policy</span> — not a
        government sanction.
      </p>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>
      )}

      <label className="flex items-center gap-3 cursor-pointer bg-white border border-border rounded-2xl p-4 shadow-2xs">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => toggleEnabled(e.target.checked)}
          className="w-4 h-4 rounded border-border text-brand focus:ring-brand cursor-pointer"
        />
        <div>
          <span className="text-sm font-semibold text-ink">Enable private embargo screening</span>
          <p className="text-[11px] text-ink-muted">
            When disabled, private rules are skipped and government/system embargo screening continues as normal.
          </p>
        </div>
      </label>

      <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-2xs">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="text-sm font-bold text-ink">Rules ({rules.filter((r) => r.status === "ACTIVE").length} active)</p>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-hover transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New rule
          </button>
        </div>

        {showForm && (
          <div className="px-5 py-4 border-b border-border grid grid-cols-2 gap-3 bg-surface-muted/40">
            <label className="text-xs font-semibold text-ink space-y-1">
              <span>Destination country</span>
              <input
                value={draft.toCountryCode}
                onChange={(e) => setDraft((d) => ({ ...d, toCountryCode: e.target.value.toUpperCase() }))}
                placeholder="e.g. IR"
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-border bg-white text-ink font-medium"
              />
            </label>
            <label className="text-xs font-semibold text-ink space-y-1">
              <span>Source country</span>
              <input
                value={draft.fromCountryCode}
                disabled={draft.appliesToAllFromCountries}
                onChange={(e) => setDraft((d) => ({ ...d, fromCountryCode: e.target.value.toUpperCase() }))}
                placeholder="e.g. CN"
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-border bg-white text-ink font-medium disabled:opacity-50"
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-ink col-span-2">
              <input
                type="checkbox"
                checked={draft.appliesToAllFromCountries}
                onChange={(e) => setDraft((d) => ({ ...d, appliesToAllFromCountries: e.target.checked, fromCountryCode: "" }))}
                className="w-4 h-4 rounded border-border text-brand focus:ring-brand cursor-pointer"
              />
              Applies to all source/compliance countries
            </label>
            <label className="text-xs font-semibold text-ink space-y-1">
              <span>Effective date</span>
              <input
                type="date"
                value={draft.effectiveDate}
                onChange={(e) => setDraft((d) => ({ ...d, effectiveDate: e.target.value }))}
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-border bg-white text-ink font-medium"
              />
            </label>
            <label className="text-xs font-semibold text-ink space-y-1">
              <span>Expiration date (optional)</span>
              <input
                type="date"
                value={draft.expirationDate}
                onChange={(e) => setDraft((d) => ({ ...d, expirationDate: e.target.value }))}
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-border bg-white text-ink font-medium"
              />
            </label>
            <label className="text-xs font-semibold text-ink space-y-1 col-span-2">
              <span>Reason (optional)</span>
              <input
                value={draft.reason}
                onChange={(e) => setDraft((d) => ({ ...d, reason: e.target.value }))}
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-border bg-white text-ink font-medium"
              />
            </label>
            <div className="col-span-2 flex justify-end">
              <button
                onClick={createRule}
                disabled={saving || !draft.toCountryCode || (!draft.appliesToAllFromCountries && !draft.fromCountryCode)}
                className="px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-hover transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saving ? "Saving…" : "Create rule"}
              </button>
            </div>
          </div>
        )}

        <div className="divide-y divide-border">
          {rules.length === 0 ? (
            <p className="text-sm text-ink-muted px-5 py-4">No private embargo rules configured.</p>
          ) : (
            rules.map((r) => (
              <div key={r.id} className={`px-5 py-3 flex items-center justify-between gap-3 text-xs ${r.status !== "ACTIVE" ? "opacity-50" : ""}`}>
                <div>
                  <p className="font-semibold text-ink">
                    {r.appliesToAllFromCountries ? "All source countries" : r.fromCountryCode} → {r.toCountryCode}
                    {r.status !== "ACTIVE" && <span className="ml-2 text-[10px] text-ink-muted">({r.status})</span>}
                  </p>
                  <p className="text-ink-muted">
                    Effective {r.effectiveDate.slice(0, 10)}
                    {r.expirationDate ? ` – ${r.expirationDate.slice(0, 10)}` : " (open-ended)"}
                    {r.reason ? ` — ${r.reason}` : ""}
                  </p>
                </div>
                {r.status === "ACTIVE" && (
                  <button
                    onClick={() => disableRule(r.id)}
                    className="text-red-600 hover:text-red-700 cursor-pointer"
                    aria-label="Disable rule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
