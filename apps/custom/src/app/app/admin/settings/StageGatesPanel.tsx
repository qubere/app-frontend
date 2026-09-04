"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Plus, Trash2, CheckCircle2, RefreshCw } from "lucide-react";

interface StageGatePolicyRow {
  id?: string;
  stage: string;
  entryType: string | null;
  mode: "AUTO_ADVANCE" | "HUMAN_GATE";
  minimumReviewerRole: "SPECIALIST" | "LICENSED_BROKER" | "MANAGER";
  requireLicensedBroker: boolean;
  gateReason: string | null;
}

const STAGES = [
  { code: "DOCUMENT_INTAKE", label: "Document Intake" },
  { code: "CLASSIFICATION", label: "Classification" },
  { code: "VALUATION", label: "Valuation" },
  { code: "ORIGIN", label: "Origin" },
  { code: "COMPLIANCE", label: "Compliance" },
  { code: "FILING_PREP", label: "Filing Prep" },
  { code: "READY_TO_FILE", label: "Ready to File" },
];

export function StageGatesPanel({
  initialPolicies,
}: {
  initialPolicies?: StageGatePolicyRow[];
}) {
  const router = useRouter();
  const [policies, setPolicies] = useState<StageGatePolicyRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (initialPolicies && initialPolicies.length > 0) {
      setPolicies(initialPolicies);
    } else {
      // Default policy list for all 7 stages
      const defaults: StageGatePolicyRow[] = STAGES.map((s) => ({
        stage: s.code,
        entryType: null,
        mode: s.code === "COMPLIANCE" ? "HUMAN_GATE" : "AUTO_ADVANCE",
        minimumReviewerRole: s.code === "COMPLIANCE" ? "LICENSED_BROKER" : "SPECIALIST",
        requireLicensedBroker: s.code === "COMPLIANCE",
        gateReason: s.code === "COMPLIANCE" ? "PGA / AD-CVD exposure review" : null,
      }));
      setPolicies(defaults);
    }
  }, [initialPolicies]);

  const updatePolicy = (index: number, fields: Partial<StageGatePolicyRow>) => {
    setPolicies((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...fields };
      return next;
    });
  };

  const addOverride = (stage: string) => {
    setPolicies((prev) => [
      ...prev,
      {
        stage,
        entryType: "T01",
        mode: "HUMAN_GATE",
        minimumReviewerRole: "LICENSED_BROKER",
        requireLicensedBroker: true,
        gateReason: `Custom entry-type override for ${stage}`,
      },
    ]);
  };

  const removeOverride = (index: number) => {
    setPolicies((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    setSavedSuccess(false);
    try {
      const res = await fetch("/api/admin/settings/stage-gates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policies }),
      });
      if (res.ok) {
        setSavedSuccess(true);
        router.refresh();
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save stage gates", err);
    } finally {
      setSaving(false);
    }
  };

  const getLivePreview = (pol: StageGatePolicyRow) => {
    const stageLabel = STAGES.find((s) => s.code === pol.stage)?.label || pol.stage;
    const entryScope = pol.entryType ? `entry type ${pol.entryType}` : "all entry types";
    if (pol.mode === "AUTO_ADVANCE") {
      return `${stageLabel} will automatically advance when agent & exception criteria pass for ${entryScope}.`;
    }
    const roleText = pol.minimumReviewerRole.replace("_", " ").toLowerCase();
    return `${stageLabel} will pause for a ${roleText} to approve advancement on ${entryScope}.`;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-2xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Stage-Gate Workflow Policies
            </h3>
            <p className="text-xs text-slate-500">
              Configure autonomous advancement vs human review gates per lifecycle stage and entry type.
            </p>
          </div>
        </div>

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
          <span>{saving ? "Saving..." : savedSuccess ? "Saved!" : "Save Stage Policies"}</span>
        </button>
      </div>

      <div className="space-y-4">
        {policies.map((pol, idx) => {
          const stageObj = STAGES.find((s) => s.code === pol.stage);
          const isDefault = pol.entryType === null;

          return (
            <div
              key={pol.id || `${pol.stage}-${pol.entryType || "default"}-${idx}`}
              className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-sm text-slate-900">
                    {stageObj?.label || pol.stage}
                  </span>
                  {pol.entryType ? (
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded-full">
                      Entry Type: {pol.entryType}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-semibold rounded-full">
                      Default Policy
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-3">
                  <select
                    value={pol.mode}
                    onChange={(e) =>
                      updatePolicy(idx, { mode: e.target.value as any })
                    }
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                  >
                    <option value="AUTO_ADVANCE">Auto Advance</option>
                    <option value="HUMAN_GATE">Human Review Gate</option>
                  </select>

                  {pol.mode === "HUMAN_GATE" && (
                    <select
                      value={pol.minimumReviewerRole}
                      onChange={(e) =>
                        updatePolicy(idx, { minimumReviewerRole: e.target.value as any })
                      }
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
                    >
                      <option value="SPECIALIST">Specialist</option>
                      <option value="LICENSED_BROKER">Licensed Broker</option>
                      <option value="MANAGER">Manager</option>
                    </select>
                  )}

                  {!isDefault && (
                    <button
                      type="button"
                      onClick={() => removeOverride(idx)}
                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove entry-type override"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {pol.mode === "HUMAN_GATE" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Gate Reason Card Message:
                    </label>
                    <input
                      type="text"
                      value={pol.gateReason || ""}
                      onChange={(e) => updatePolicy(idx, { gateReason: e.target.value })}
                      placeholder="e.g. PGA / AD-CVD exposure review"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  {pol.entryType !== null && (
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Entry Type Code:
                      </label>
                      <input
                        type="text"
                        value={pol.entryType || ""}
                        onChange={(e) => updatePolicy(idx, { entryType: e.target.value })}
                        placeholder="e.g. T01, T11"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-indigo-900 bg-indigo-50/80 px-3 py-1.5 rounded-lg border border-indigo-100 italic">
                  Preview: "{getLivePreview(pol)}"
                </p>

                {isDefault && (
                  <button
                    type="button"
                    onClick={() => addOverride(pol.stage)}
                    className="text-[11px] font-semibold text-brand hover:underline flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add entry-type override</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
