"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface KeywordRuleReviewItem {
  id: string;
  category: string;
  phrase: string;
  matchType: string;
  citation: string | null;
  severity: string;
  authority: string;
  createdAt: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  END_USE_NUCLEAR: "End-Use: Nuclear",
  END_USE_MISSILE: "End-Use: Missile",
  END_USE_ROCKET_UAV: "End-Use: Rocket/UAV",
  END_USE_CHEM_BIO: "End-Use: Chem/Bio",
  MILITARY_END_USE: "Military End-Use",
  ANTI_BOYCOTT_REQUEST: "Anti-Boycott",
  RESTRICTED_PARTY_RED_FLAG: "Restricted Party Red Flag",
};

function categoryLabel(category: string) {
  return CATEGORY_LABEL[category] ?? category;
}

const SEVERITY_VARIANT: Record<string, "danger" | "warning" | "info"> = {
  CRITICAL: "danger",
  HIGH: "danger",
  MEDIUM: "warning",
  LOW: "info",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function KeywordRuleReviewPanel() {
  const [items, setItems] = useState<KeywordRuleReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/platform-admin/keyword-rule-review");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to load pending keyword rules");
      setItems(data.items ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load pending keyword rules");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleReview = async (item: KeywordRuleReviewItem, action: "PUBLISH" | "REJECT") => {
    setReviewingId(item.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/platform-admin/keyword-rule-review/${item.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `Failed to ${action.toLowerCase()} this phrase`);

      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setMessage({
        type: "success",
        text: `${action === "PUBLISH" ? "Published" : "Rejected"} [${categoryLabel(item.category)}] "${item.phrase}"`,
      });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Network error occurred." });
    } finally {
      setReviewingId(null);
    }
  };

  const byCategory = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1;
    return acc;
  }, {});
  const categoriesWithPending = Object.keys(byCategory).sort();

  return (
    <div className="space-y-8">
      {message && (
        <div
          className={`p-4 rounded-2xl text-sm border flex items-center space-x-3 ${
            message.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Summary stat tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="apple-card p-5 rounded-3xl border border-border bg-white shadow-sm">
          <div className="flex items-center space-x-2 text-ink-muted text-xs font-bold uppercase tracking-wider mb-2">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Total Pending</span>
          </div>
          <p className="text-lg font-extrabold text-ink">{items.length}</p>
          <p className="text-[10px] text-ink-muted mt-1">
            Invisible to End-Use, Anti-Boycott, and Military End-Use screening until published.
          </p>
        </div>
        {categoriesWithPending.slice(0, 3).map((category) => (
          <div key={category} className="apple-card p-5 rounded-3xl border border-border bg-white shadow-sm">
            <div className="flex items-center space-x-2 text-ink-muted text-xs font-bold uppercase tracking-wider mb-2">
              <span>{categoryLabel(category)}</span>
            </div>
            <p className="text-lg font-extrabold text-ink">{byCategory[category]}</p>
          </div>
        ))}
      </div>

      <div className="apple-card rounded-3xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-bold text-ink flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            <span>Pending Keyword Rule Review ({items.length})</span>
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Hand-authored End-Use, Military End-Use, Anti-Boycott, and Restricted-Party red-flag phrases. A phrase
            has zero effect on live screening until it is published here.
          </p>
        </div>

        {loading ? (
          <div className="p-10 flex items-center justify-center text-ink-muted">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span>Loading pending reviews…</span>
          </div>
        ) : loadError ? (
          <div className="p-10 text-center space-y-3">
            <AlertCircle className="w-6 h-6 text-red-500 mx-auto" />
            <p className="text-sm text-red-700">{loadError}</p>
            <Button size="sm" variant="secondary" onClick={fetchItems}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-ink">
              <thead className="bg-surface-muted border-b border-border text-xs uppercase font-bold text-ink-muted">
                <tr>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Phrase</th>
                  <th className="px-6 py-4">Citation</th>
                  <th className="px-6 py-4">Severity</th>
                  <th className="px-6 py-4">Added</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => {
                  const isReviewing = reviewingId === item.id;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <Badge variant="info" className="normal-case">
                          {categoryLabel(item.category)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 font-semibold">{item.phrase}</td>
                      <td className="px-6 py-4 text-xs text-ink-muted max-w-xs">{item.citation ?? "—"}</td>
                      <td className="px-6 py-4">
                        <Badge variant={SEVERITY_VARIANT[item.severity] ?? "info"} className="normal-case text-xs">
                          {item.severity}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-xs text-ink-muted">{formatDateTime(item.createdAt)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={isReviewing}
                            onClick={() => handleReview(item, "PUBLISH")}
                            className="rounded-full py-1.5 shadow-2xs gap-1.5"
                          >
                            {isReviewing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            <span>Publish</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={isReviewing}
                            onClick={() => handleReview(item, "REJECT")}
                            className="rounded-full py-1.5 shadow-2xs gap-1.5"
                          >
                            <span>Reject</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-ink-muted">
                      Nothing pending review.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
