"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, FileSignature, Plus, Search, UserRoundPlus, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PanelHeading } from "@/components/PanelHeading";
import { ClientNavTabs } from "@/components/clients/ClientNavTabs";
import { ClientPicker, type ClientOption } from "@/components/onboarding/ClientPicker";
import { NewCaseModal } from "@/components/onboarding/NewCaseModal";
import { Badge, Button, Card, Input, Modal, ModalFooter, ModalHeader } from "@/components/ui";

type MissingCode = "CLIENT" | "FIVE_OH_SIX" | "POA" | "BOND" | "SCREENING";
interface ImporterRow {
  id: string;
  name: string;
  irsEin: string | null;
  cbpImporterNumber: string | null;
  clientId: string | null;
  registrationStatus: string;
  client: { id: string; name: string } | null;
  bond: { id: string; status: string; bondNumber: string; bondType: string; bondAmount: string; continuousBondFormulaAmount: string | null; expirationDate: string | null; lastVerifiedAt: string | null } | null;
  powersOfAttorney: Array<{ id: string; status: string; signerName: string | null; executionMethod: string | null; signedDate: string; expirationDate: string | null; revokedAt: string | null }>;
  onboardingEntities: Array<{ screeningStatus: string; bondCoverage: string }>;
  onboardingCases: Array<{ id: string; path: string; status: string; currentStep: number }>;
  readiness: { ready: boolean; label: string; blockers: Array<{ code: MissingCode; label: string; href: string }> };
}

function latestPoa(importer: ImporterRow) {
  return importer.powersOfAttorney[0] ?? null;
}

function shortDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
}

export function ImportersRegistryClient({ accountName, initialImporters, initialView, initialMissing }: {
  accountName: string;
  initialImporters: ImporterRow[];
  initialView: "importers" | "bonds" | "poa";
  initialMissing?: string;
}) {
  const router = useRouter();
  const [importers, setImporters] = useState(initialImporters);
  const [query, setQuery] = useState("");
  const [missing, setMissing] = useState(initialMissing?.toUpperCase() ?? "all");
  const [showNew, setShowNew] = useState(false);
  const [attaching, setAttaching] = useState<ImporterRow | null>(null);
  const ready = importers.filter((item) => item.readiness.ready).length;
  const unassigned = importers.filter((item) => !item.clientId).length;
  const filtered = useMemo(() => importers.filter((item) => {
    const term = query.trim().toLowerCase();
    const matchesQuery = !term || [item.name, item.cbpImporterNumber, item.irsEin, item.client?.name]
      .some((value) => value?.toLowerCase().includes(term));
    const matchesMissing = missing === "all" || item.readiness.blockers.some((blocker) => blocker.code === missing);
    return matchesQuery && matchesMissing;
  }), [importers, missing, query]);
  const stats: Array<{ label: string; value: number; icon: LucideIcon; color: string }> = [
    { label: "Importers", value: importers.length, icon: Building2, color: "text-ink" },
    { label: "Ready to file", value: ready, icon: CheckCircle2, color: "text-emerald-600" },
    { label: "Onboarding", value: importers.filter((item) => item.onboardingCases.some((itemCase) => itemCase.status !== "active")).length, icon: UserRoundPlus, color: "text-brand" },
    { label: "Blocked", value: importers.length - ready, icon: AlertTriangle, color: "text-amber-600" },
    { label: "Unassigned", value: unassigned, icon: AlertTriangle, color: "text-red-600" },
  ];

  function changeView(view: "importers" | "bonds" | "poa") {
    router.push(view === "importers" ? "/app/importers" : `/app/importers?view=${view}`);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <PanelHeading icon={Building2} badge="Filing identity registry" title="Importers" subtitle={`Filing readiness and authority for every company served by ${accountName}.`} />
        <Button onClick={() => setShowNew(true)} className="self-start"><Plus className="h-4 w-4" /> Add importer</Button>
      </div>
      <ClientNavTabs activeView={initialView} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="flex items-center gap-3 p-4">
            <Icon className={`h-5 w-5 ${color}`} />
            <div><p className="text-xl font-extrabold text-ink">{value}</p><p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{label}</p></div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden border border-border">
        <div className="flex flex-col gap-3 border-b border-border bg-surface-muted/30 p-4 lg:flex-row lg:items-center">
          <div className="flex rounded-xl border border-border bg-white p-1">
            {(["importers", "bonds", "poa"] as const).map((view) => (
              <button key={view} onClick={() => changeView(view)} className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize ${initialView === view ? "bg-brand text-white" : "text-ink-muted hover:bg-surface-muted"}`}>{view === "poa" ? "POAs" : view}</button>
            ))}
          </div>
          <div className="relative min-w-0 flex-1 lg:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search importer, client, CBP number, or EIN" className="bg-white pl-9" />
          </div>
          {initialView === "importers" && (
            <select value={missing} onChange={(event) => setMissing(event.target.value)} className="rounded-xl border border-border bg-white px-3 py-2.5 text-xs font-semibold text-ink">
              <option value="all">All readiness states</option>
              <option value="CLIENT">Unassigned client</option>
              <option value="FIVE_OH_SIX">Missing 5106</option>
              <option value="POA">Missing POA</option>
              <option value="BOND">Bond issue</option>
              <option value="SCREENING">Screening issue</option>
            </select>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center"><Building2 className="mx-auto h-8 w-8 text-ink-muted/40" /><p className="mt-3 text-sm font-bold text-ink">No importers match these filters</p><p className="mt-1 text-xs text-ink-muted">Clear a filter or add an importer to a client.</p></div>
        ) : initialView === "bonds" ? (
          <BondTable importers={filtered} />
        ) : initialView === "poa" ? (
          <PoaTable importers={filtered} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="border-b border-border bg-surface-muted/60 text-[10px] font-bold uppercase tracking-wider text-ink-muted"><tr><th className="px-5 py-3">Importer</th><th className="px-4 py-3">Client</th><th className="px-4 py-3">CBP registration</th><th className="px-4 py-3">POA</th><th className="px-4 py-3">Bond</th><th className="px-4 py-3">Screening</th><th className="px-5 py-3">Readiness</th></tr></thead>
              <tbody className="divide-y divide-border">
                {filtered.map((importer) => {
                  const poa = latestPoa(importer);
                  const screening = importer.onboardingEntities[0]?.screeningStatus ?? "pending";
                  return <tr key={importer.id} className="group hover:bg-surface-muted/30">
                    <td className="px-5 py-4"><Link href={`/app/importers/${importer.id}`} className="font-bold text-ink hover:text-brand">{importer.name}</Link><p className="mt-1 font-mono text-[10px] text-ink-muted">{importer.cbpImporterNumber ?? "CBP # pending"}</p></td>
                    <td className="px-4 py-4">{importer.client ? <Link href={`/app/clients/${importer.client.id}`} className="font-semibold text-ink hover:text-brand">{importer.client.name}</Link> : <button onClick={() => setAttaching(importer)} className="inline-flex items-center gap-1 font-bold text-amber-700 hover:underline"><AlertTriangle className="h-3 w-3" /> Attach client</button>}</td>
                    <td className="px-4 py-4"><StatusBadge good={importer.registrationStatus === "registered"} label={importer.registrationStatus === "registered" ? "Registered" : "Pending 5106"} /></td>
                    <td className="px-4 py-4"><StatusBadge good={poa?.status === "executed" && !poa.revokedAt} label={poa?.status === "executed" ? "Executed" : poa?.status === "out_for_signature" ? "Out for signature" : "Missing"} /></td>
                    <td className="px-4 py-4"><StatusBadge good={Boolean(importer.bond && ["verified", "attested"].includes(importer.bond.status))} label={importer.bond?.status ?? "Missing"} /></td>
                    <td className="px-4 py-4"><StatusBadge good={["passed", "overridden"].includes(screening)} label={screening} /></td>
                    <td className="px-5 py-4"><Link href={`/app/importers/${importer.id}`} className="inline-flex items-center gap-2"><Badge variant={importer.readiness.ready ? "success" : "warning"}>{importer.readiness.label}</Badge><ArrowRight className="h-3.5 w-3.5 text-ink-muted transition-transform group-hover:translate-x-0.5" /></Link>{!importer.readiness.ready && <p className="mt-1.5 max-w-[220px] text-[10px] text-ink-muted">{importer.readiness.blockers[0]?.label}</p>}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showNew && <NewCaseModal onClose={() => setShowNew(false)} />}
      {attaching && <AttachClientModal importer={attaching} onClose={() => setAttaching(null)} onUpdated={(next) => { setImporters((items) => items.map((item) => item.id === next.id ? next : item)); setAttaching(null); }} />}
    </div>
  );
}

function StatusBadge({ good, label }: { good: boolean; label: string }) {
  return <Badge variant={good ? "success" : "warning"}>{label.replaceAll("_", " ")}</Badge>;
}

function BondTable({ importers }: { importers: ImporterRow[] }) {
  const rows = [...importers].sort((a, b) => Number(a.bond?.bondAmount ?? 0) - Number(b.bond?.bondAmount ?? 0));
  return <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead className="border-b border-border bg-surface-muted/60 text-[10px] font-bold uppercase tracking-wider text-ink-muted"><tr><th className="px-5 py-3">Importer · Client</th><th className="px-4 py-3">Bond</th><th className="px-4 py-3">Coverage</th><th className="px-4 py-3">Required</th><th className="px-4 py-3">Verified</th><th className="px-5 py-3">Risk</th></tr></thead><tbody className="divide-y divide-border">{rows.map((importer) => <tr key={importer.id} className="hover:bg-surface-muted/30"><td className="px-5 py-4"><Link href={`/app/importers/${importer.id}?tab=bond`} className="font-bold text-ink hover:text-brand">{importer.name}</Link><p className="mt-1 text-[10px] text-ink-muted">{importer.client?.name ?? "Unassigned"}</p></td><td className="px-4 py-4 font-mono">{importer.bond?.bondNumber ?? "—"}</td><td className="px-4 py-4">{importer.bond ? `$${Number(importer.bond.bondAmount).toLocaleString()}` : "—"}</td><td className="px-4 py-4">{importer.bond?.continuousBondFormulaAmount ? `$${Number(importer.bond.continuousBondFormulaAmount).toLocaleString()}` : "—"}</td><td className="px-4 py-4">{shortDate(importer.bond?.lastVerifiedAt)}</td><td className="px-5 py-4"><StatusBadge good={!importer.readiness.blockers.some((item) => item.code === "BOND")} label={importer.readiness.blockers.find((item) => item.code === "BOND")?.label ?? "Covered"} /></td></tr>)}</tbody></table></div>;
}

function PoaTable({ importers }: { importers: ImporterRow[] }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-xs"><thead className="border-b border-border bg-surface-muted/60 text-[10px] font-bold uppercase tracking-wider text-ink-muted"><tr><th className="px-5 py-3">Importer · Client</th><th className="px-4 py-3">Signer</th><th className="px-4 py-3">Method</th><th className="px-4 py-3">Effective</th><th className="px-4 py-3">Expires</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-border">{importers.map((importer) => { const poa = latestPoa(importer); return <tr key={importer.id} className="hover:bg-surface-muted/30"><td className="px-5 py-4"><Link href={`/app/importers/${importer.id}?tab=poa`} className="font-bold text-ink hover:text-brand">{importer.name}</Link><p className="mt-1 text-[10px] text-ink-muted">{importer.client?.name ?? "Unassigned"}</p></td><td className="px-4 py-4">{poa?.signerName ?? "—"}</td><td className="px-4 py-4">{poa?.executionMethod?.replaceAll("_", " ") ?? "—"}</td><td className="px-4 py-4">{shortDate(poa?.signedDate)}</td><td className="px-4 py-4">{shortDate(poa?.expirationDate)}</td><td className="px-5 py-4"><StatusBadge good={poa?.status === "executed" && !poa.revokedAt} label={poa?.status ?? "Missing"} /></td></tr>; })}</tbody></table></div>;
}

function AttachClientModal({ importer, onClose, onUpdated }: { importer: ImporterRow; onClose: () => void; onUpdated: (importer: ImporterRow) => void }) {
  const [client, setClient] = useState<ClientOption | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [impact, setImpact] = useState<{ shipments: number; customsFilings: number } | null>(null);
  async function save(confirmHistoricalReassignment = false) {
    if (!client) { setError("Choose a client before assigning this importer."); return; }
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/importers/${importer.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: client.id, confirmHistoricalReassignment }) });
      const data = await response.json();
      if (response.status === 409 && data.error?.code === "HISTORICAL_FILINGS_CONFIRMATION_REQUIRED") {
        setImpact(data.error.details); setBusy(false); return;
      }
      if (!response.ok) throw new Error(data.error?.message ?? "Could not assign client.");
      onUpdated({ ...importer, clientId: client.id, client: { id: client.id, name: client.name }, readiness: { ...importer.readiness, blockers: importer.readiness.blockers.filter((item) => item.code !== "CLIENT") } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not assign client."); setBusy(false); }
  }
  return <Modal isOpen onClose={onClose} closeDisabled={busy} titleId="attach-client-title"><ModalHeader titleId="attach-client-title" title="Attach importer to client" subtitle={importer.name} icon={<Building2 className="h-4 w-4" />} onClose={onClose} closeDisabled={busy} /><div className="space-y-4"><ClientPicker value={client} onChange={(next) => { setClient(next); setImpact(null); }} disabled={busy} />{impact && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><p className="font-bold">Review the operational impact</p><p className="mt-1">This importer has {impact.shipments} shipment(s) and {impact.customsFilings} filing(s). Their historical records remain unchanged; new work will use {client?.name}.</p></div>}{error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}</div><ModalFooter>{impact ? <><Button variant="secondary" onClick={() => setImpact(null)} disabled={busy}>Go back</Button><Button onClick={() => save(true)} loading={busy}>Confirm assignment</Button></> : <><Button variant="secondary" onClick={onClose} disabled={busy}><X className="h-3.5 w-3.5" /> Cancel</Button><Button onClick={() => save()} loading={busy}><FileSignature className="h-3.5 w-3.5" /> Assign client</Button></>}</ModalFooter></Modal>;
}
