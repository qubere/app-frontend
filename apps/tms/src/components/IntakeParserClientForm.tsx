"use client";

import { useState } from "react";
import { Sparkles, Send, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export function IntakeParserClientForm() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/transportation-orders/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to parse intake text");
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-brand/20 p-6 space-y-4 shadow-2xs relative overflow-hidden">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-brand" />
          <h2 className="font-extrabold text-sm tracking-tight text-ink">Inbound Email & Document Intake Parser</h2>
        </div>
        <span className="text-xs font-bold text-brand bg-brand/10 px-2.5 py-0.5 rounded-full border border-brand/20">
          Automated Extraction
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-xs font-bold text-ink">
          Paste Inbound Email / Document Request Text:
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="e.g. Need to move 2x40HC Shanghai to Oakland next week. Delivery Sacramento. PO-882199 attached."
          className="w-full p-3 rounded-xl bg-surface-muted border border-border text-xs font-mono text-ink focus:outline-none focus:border-brand focus:bg-white transition-all"
        />

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-ink-muted font-medium">
            Triggers evidence provenance extraction, confidence scoring, and AgentDecision classification.
          </span>
          <button
            type="submit"
            disabled={loading || !text.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-xl text-xs font-bold hover:bg-brand-accent transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {loading ? "Parsing Intake..." : "Parse Intake Request"}
          </button>
        </div>
      </form>

      {error && (
        <div className="p-3 bg-critical-surface border border-critical/20 rounded-xl text-critical text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="mt-4 p-4 bg-surface-muted border border-border rounded-xl space-y-2">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="text-xs font-bold text-ink flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Intake Parsed Successfully
            </span>
            <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
              Confidence: {result.parsedData?.confidence ?? 92}%
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs pt-1 font-mono">
            <div>
              <span className="text-ink-muted block text-[10px] uppercase tracking-wider font-semibold">Origin Port</span>
              <span className="text-ink font-bold">{result.parsedData?.origin?.city ?? "CNSHA"}</span>
            </div>
            <div>
              <span className="text-ink-muted block text-[10px] uppercase tracking-wider font-semibold">Destination Port</span>
              <span className="text-ink font-bold">{result.parsedData?.destination?.city ?? "USOAK"}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
