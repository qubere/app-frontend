"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, RefreshCw, CheckCircle, Link2, X, AlertCircle, Layers } from "lucide-react";
import { PanelHeading } from "@/components/PanelHeading";
import { Button, Badge } from "@/components/ui";

interface ErpConfig {
  id: string;
  provider: string;
  name: string;
  status: string;
  lastSyncAt: string | null;
}

interface DedupeCandidate {
  id: string;
  legalName?: string;
  name?: string;
  sku?: string;
  score: number;
  matchReason: string;
}

interface Proposal {
  proposalId: string;
  type: "entity" | "product";
  action: "create" | "link_existing" | "skip";
  erp: {
    providerId: string;
    legalName?: string;
    name?: string;
    ein?: string;
    sku?: string;
    description?: string;
  };
  dedupeCandidates: DedupeCandidate[];
  linkTargetId?: string;
}

interface DispositionMap {
  [proposalId: string]: { action: "create" | "link_existing" | "skip"; linkTargetId?: string };
}

export function ErpReviewClient({ erpConfigs }: { erpConfigs: ErpConfig[] }) {
  const [selectedConfig, setSelectedConfig] = useState<ErpConfig | null>(
    erpConfigs.length === 1 ? erpConfigs[0] : null
  );
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [dispositions, setDispositions] = useState<DispositionMap>({});
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [committed, setCommitted] = useState<{ created: number; linked: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePull() {
    if (!selectedConfig) return;
    setLoading(true);
    setError(null);
    setProposals([]);
    setDispositions({});
    setCommitted(null);
    try {
      const res = await fetch(`/api/onboarding/erp/${selectedConfig.id}/pull`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Pull failed");
      setProposals(data.proposals ?? []);
      const initial: DispositionMap = {};
      for (const p of (data.proposals ?? []) as Proposal[]) {
        initial[p.proposalId] = { action: p.action, linkTargetId: p.linkTargetId };
      }
      setDispositions(initial);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    if (!selectedConfig) return;
    setCommitting(true);
    setError(null);
    try {
      const items = Object.entries(dispositions).map(([proposalId, d]) => ({
        proposalId,
        action: d.action,
        linkTargetId: d.linkTargetId,
      }));
      const res = await fetch("/api/onboarding/erp/proposals/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrationConfigId: selectedConfig.id, items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Commit failed");
      setCommitted(data);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setCommitting(false);
    }
  }

  function setAction(proposalId: string, action: "create" | "link_existing" | "skip", linkTargetId?: string) {
    setDispositions((prev) => ({ ...prev, [proposalId]: { action, linkTargetId } }));
  }

  const entityProposals = proposals.filter((p) => p.type === "entity");
  const productProposals = proposals.filter((p) => p.type === "product");

  if (erpConfigs.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <PanelHeading
          icon={Layers}
          badge="Onboarding"
          title="ERP entity review"
          subtitle="Import entity and product master from a connected ERP and review dedupe candidates before writing."
        />
        <div className="mt-8 text-center py-12 border border-dashed border-border rounded-lg">
          <Layers className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No ERP integrations configured.</p>
          <div className="mt-4">
            <Link href="/app/admin/integrations">
              <Button variant="outline">Configure an ERP integration</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link href="/app/onboarding" className="hover:underline">Onboarding</Link>
        <ChevronRight className="w-3 h-3" />
        <span>ERP review</span>
      </div>

      <PanelHeading
        icon={Layers}
        badge="Onboarding"
        title="ERP entity review"
        subtitle="Pull your ERP entity and product master, review dedupe candidates, and commit what should be created or linked."
      />

      {committed ? (
        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 p-6">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h2 className="font-semibold text-green-900 dark:text-green-200">Commit complete</h2>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center mb-4">
            {(["Created", "Linked", "Skipped"] as const).map((label) => (
              <div key={label} className="rounded border border-border bg-card p-3">
                <div className="text-2xl font-bold">{committed[label.toLowerCase() as "created" | "linked" | "skipped"]}</div>
                <div className="text-xs text-muted-foreground mt-1">{label}</div>
              </div>
            ))}
          </div>
          <Link href="/app/onboarding">
            <Button variant="primary">View onboarding cases</Button>
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {erpConfigs.length > 1 && (
            <div className="rounded-lg border border-border bg-card p-4">
              <label className="text-sm font-medium mb-2 block">Select ERP integration</label>
              <select
                className="rounded border border-border bg-background px-3 py-2 text-sm w-full max-w-xs"
                value={selectedConfig?.id ?? ""}
                onChange={(e) => {
                  const c = erpConfigs.find((x) => x.id === e.target.value) ?? null;
                  setSelectedConfig(c);
                  setProposals([]);
                  setDispositions({});
                }}
              >
                <option value="">— Select —</option>
                {erpConfigs.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.provider})</option>
                ))}
              </select>
            </div>
          )}

          {selectedConfig && (
            <div className="flex items-center gap-3">
              <Button onClick={handlePull} disabled={loading} variant="outline">
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                {loading ? "Pulling from ERP…" : "Pull from ERP"}
              </Button>
              {selectedConfig.lastSyncAt && (
                <span className="text-xs text-muted-foreground">
                  Last pull: {new Date(selectedConfig.lastSyncAt).toLocaleString()}
                </span>
              )}
              {error && (
                <span className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </span>
              )}
            </div>
          )}

          {proposals.length > 0 && (
            <div className="space-y-4">
              {entityProposals.length > 0 && (
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
                    <h2 className="font-semibold text-sm">Entities ({entityProposals.length})</h2>
                    <span className="text-xs text-muted-foreground">Importers / legal entities from ERP</span>
                  </div>
                  <div className="divide-y divide-border">
                    {entityProposals.map((p) => (
                      <ProposalRow
                        key={p.proposalId}
                        proposal={p}
                        disposition={dispositions[p.proposalId] ?? { action: p.action }}
                        onAction={(action, linkTargetId) => setAction(p.proposalId, action, linkTargetId)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {productProposals.length > 0 && (
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
                    <h2 className="font-semibold text-sm">Products ({productProposals.length})</h2>
                    <span className="text-xs text-muted-foreground">Product master from ERP</span>
                  </div>
                  <div className="divide-y divide-border">
                    {productProposals.map((p) => (
                      <ProposalRow
                        key={p.proposalId}
                        proposal={p}
                        disposition={dispositions[p.proposalId] ?? { action: p.action }}
                        onAction={(action, linkTargetId) => setAction(p.proposalId, action, linkTargetId)}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button onClick={handleCommit} disabled={committing} variant="primary">
                  {committing ? "Committing…" : "Commit dispositions"}
                </Button>
                <Button variant="outline" onClick={() => { setProposals([]); setDispositions({}); }}>
                  Discard
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProposalRow({
  proposal,
  disposition,
  onAction,
}: {
  proposal: Proposal;
  disposition: { action: string; linkTargetId?: string };
  onAction: (action: "create" | "link_existing" | "skip", linkTargetId?: string) => void;
}) {
  const label = proposal.type === "entity" ? (proposal.erp.legalName ?? "—") : (proposal.erp.name ?? "—");
  const sub = proposal.type === "entity"
    ? proposal.erp.ein ? `EIN ${proposal.erp.ein}` : "No EIN"
    : proposal.erp.sku ? `SKU ${proposal.erp.sku}` : (proposal.erp.description ?? "");

  return (
    <div className="px-5 py-3 flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{label}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
        {proposal.dedupeCandidates.length > 0 && (
          <div className="mt-2 space-y-1">
            {proposal.dedupeCandidates.slice(0, 2).map((c) => (
              <div key={c.id} className="text-xs flex items-center gap-2 text-muted-foreground">
                <Link2 className="w-3 h-3 flex-shrink-0" />
                <span>{c.legalName ?? c.name ?? c.id}</span>
                <span className="text-green-600 font-medium">{Math.round(c.score * 100)}%</span>
                <span>— {c.matchReason}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {disposition.action === "create" && <Badge variant="success">Create new</Badge>}
        {disposition.action === "link_existing" && <Badge variant="info">Link existing</Badge>}
        {disposition.action === "skip" && <Badge variant="neutral">Skip</Badge>}
        <div className="flex gap-1">
          <button
            onClick={() => onAction("create")}
            className={`px-2 py-1 rounded text-xs border transition-colors ${disposition.action === "create" ? "bg-green-100 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300" : "border-border text-muted-foreground hover:bg-muted"}`}
          >
            Create
          </button>
          {proposal.dedupeCandidates.length > 0 && (
            <button
              onClick={() => onAction("link_existing", proposal.dedupeCandidates[0]?.id)}
              className={`px-2 py-1 rounded text-xs border transition-colors ${disposition.action === "link_existing" ? "bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300" : "border-border text-muted-foreground hover:bg-muted"}`}
            >
              <Link2 className="w-3 h-3 inline mr-0.5" />
              Link
            </button>
          )}
          <button
            onClick={() => onAction("skip")}
            className={`px-2 py-1 rounded text-xs border transition-colors ${disposition.action === "skip" ? "bg-muted border-border text-foreground" : "border-border text-muted-foreground hover:bg-muted"}`}
          >
            <X className="w-3 h-3 inline" />
          </button>
        </div>
      </div>
    </div>
  );
}
