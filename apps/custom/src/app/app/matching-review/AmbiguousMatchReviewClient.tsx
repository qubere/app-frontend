"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card } from "@/components/ui";

export interface ProposalRow {
  id: string;
  domain: "PARTY" | "PRODUCT";
  matchStatus: string;
  targetEntityType: string | null;
  targetEntityId: string | null;
  targetRole: string | null;
  sourceDocumentId: string | null;
  sourceDocument?: { id: string; fileName: string; shipmentId: string | null } | null;
  inputPayload: any;
  candidatesJson: any[];
  status: "PENDING" | "CONFIRMED" | "REJECTED" | "CREATED_NEW";
  resolvedPartyId: string | null;
  resolvedProductId: string | null;
  createdAt: string;
}

interface Props {
  initialProposals: ProposalRow[];
  totalCount: number;
  currentDomain: string;
  currentStatus: string;
}

export function AmbiguousMatchReviewClient({
  initialProposals,
  totalCount: _totalCount,
  currentDomain,
  currentStatus,
}: Props) {
  const router = useRouter();
  const [selectedProposal, setSelectedProposal] = useState<ProposalRow | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResolve = async (action: "CONFIRM" | "CREATE_NEW" | "REJECT") => {
    if (!selectedProposal) return;
    if (action === "CONFIRM" && !selectedCandidateId) {
      setError("Please select a candidate to confirm.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/matching/ambiguous-matches/${selectedProposal.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          selectedPartyId: selectedProposal.domain === "PARTY" ? selectedCandidateId : undefined,
          selectedProductId: selectedProposal.domain === "PRODUCT" ? selectedCandidateId : undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to resolve match proposal.");
      }

      setSelectedProposal(null);
      setSelectedCandidateId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Domain / Status Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl bg-surface-muted p-1">
          {["ALL", "PARTY", "PRODUCT"].map((dom) => (
            <button
              key={dom}
              onClick={() => {
                const url = new URL(window.location.href);
                if (dom === "ALL") url.searchParams.delete("domain");
                else url.searchParams.set("domain", dom);
                router.push(url.pathname + url.search);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                currentDomain === dom ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink"
              }`}
            >
              {dom === "ALL" ? "All Domains" : dom}
            </button>
          ))}
        </div>

        <div className="flex gap-1 rounded-xl bg-surface-muted p-1">
          {["PENDING", "CONFIRMED", "REJECTED", "CREATED_NEW"].map((st) => (
            <button
              key={st}
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.set("status", st);
                router.push(url.pathname + url.search);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                currentStatus === st ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Main List & Review Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Proposals List */}
        <div className="lg:col-span-1 space-y-3">
          {initialProposals.length === 0 ? (
            <Card className="p-6 text-center text-sm text-ink-muted">
              No match proposals found matching the current filter.
            </Card>
          ) : (
            initialProposals.map((prop) => {
              const isSelected = selectedProposal?.id === prop.id;
              const inputName =
                prop.inputPayload?.legalName ||
                prop.inputPayload?.productName ||
                prop.inputPayload?.description ||
                "Ambiguous Match";

              return (
                <div
                  key={prop.id}
                  onClick={() => {
                    setSelectedProposal(prop);
                    setSelectedCandidateId(null);
                    setError(null);
                  }}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? "border-brand bg-brand/[0.03] shadow-sm"
                      : "border-border bg-white hover:border-border-hover"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand">
                      {prop.domain} · {prop.matchStatus}
                    </span>
                    <Badge variant={prop.status === "PENDING" ? "warning" : "success"}>
                      {prop.status}
                    </Badge>
                  </div>
                  <h3 className="mt-2 text-sm font-bold text-ink truncate">{inputName}</h3>
                  <div className="mt-2 flex items-center justify-between text-xs text-ink-muted">
                    <span>
                      {Array.isArray(prop.candidatesJson) ? prop.candidatesJson.length : 0} candidate(s)
                    </span>
                    {prop.sourceDocument && <span>Doc: {prop.sourceDocument.fileName}</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Selected Proposal Detail & Resolution Actions */}
        <div className="lg:col-span-2">
          {selectedProposal ? (
            <Card className="p-6 space-y-6">
              <div>
                <div className="flex items-center justify-between">
                  <Badge variant="info">{selectedProposal.domain} MATCH PROPOSAL</Badge>
                  <span className="text-xs text-ink-muted">
                    Created {new Date(selectedProposal.createdAt).toLocaleString()}
                  </span>
                </div>
                <h2 className="mt-2 text-lg font-bold text-ink">
                  {selectedProposal.inputPayload?.legalName ||
                    selectedProposal.inputPayload?.productName ||
                    selectedProposal.inputPayload?.description ||
                    "Input Item"}
                </h2>
                {selectedProposal.targetRole && (
                  <p className="text-xs text-ink-muted mt-0.5">
                    Target Role: <span className="font-semibold text-ink">{selectedProposal.targetRole}</span>
                  </p>
                )}
              </div>

              {/* Input Details */}
              <div className="rounded-xl bg-surface-muted p-4 space-y-2">
                <h4 className="text-xs font-bold uppercase text-ink-muted">Extracted Input Payload</h4>
                <pre className="text-xs font-mono text-ink overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(selectedProposal.inputPayload, null, 2)}
                </pre>
              </div>

              {/* Candidates List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase text-ink-muted">
                  Candidates ({selectedProposal.candidatesJson?.length ?? 0})
                </h4>

                {(selectedProposal.candidatesJson || []).map((cand: any, idx: number) => {
                  const candId = cand.partyId || cand.productId || cand.id;
                  const isCandSelected = selectedCandidateId === candId;

                  return (
                    <div
                      key={candId || idx}
                      onClick={() => setSelectedCandidateId(candId)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        isCandSelected
                          ? "border-brand bg-brand/[0.04] ring-2 ring-brand/20"
                          : "border-border bg-white hover:border-border-hover"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-ink">
                          {cand.partyName || cand.productName || cand.displayName || candId}
                        </span>
                        {cand.rule && <Badge variant="neutral">{cand.rule}</Badge>}
                      </div>
                      {cand.explanation && (
                        <p className="mt-1 text-xs text-ink-muted">{cand.explanation}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-danger/10 text-danger text-xs font-semibold">
                  {error}
                </div>
              )}

              {/* Actions */}
              {selectedProposal.status === "PENDING" && (
                <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border">
                  <Button
                    onClick={() => handleResolve("CONFIRM")}
                    disabled={loading || !selectedCandidateId}
                    variant="primary"
                  >
                    Confirm Selected Candidate
                  </Button>
                  <Button
                    onClick={() => handleResolve("CREATE_NEW")}
                    disabled={loading}
                    variant="secondary"
                  >
                    Confirm as New Master Record
                  </Button>
                  <Button
                    onClick={() => handleResolve("REJECT")}
                    disabled={loading}
                    variant="ghost"
                    className="text-danger hover:bg-danger/10"
                  >
                    Reject Proposal
                  </Button>
                </div>
              )}
            </Card>
          ) : (
            <Card className="p-12 text-center text-sm text-ink-muted">
              Select a proposal from the list on the left to review candidates and resolve.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
