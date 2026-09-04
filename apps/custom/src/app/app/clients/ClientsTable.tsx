"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Contact2,
  Landmark,
  Link2,
  Plus,
  Search,
  UserPlus,
} from "lucide-react";
import { NewCaseModal } from "@/components/onboarding/NewCaseModal";
import { Badge, Button, Card, Input, Label, Modal, ModalFooter, ModalHeader } from "@/components/ui";
import type { FormattedClient } from "@/lib/clients/clientsData";

interface ClientsTableProps {
  clients: FormattedClient[];
  onSaved?: () => void;
}

type Message = { type: "success" | "error"; text: string };

export function ClientsTable({ clients, onSaved }: ClientsTableProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [expandedClientId, setExpandedClientId] = useState<string | null>(clients[0]?.id ?? null);
  const [showCreateClient, setShowCreateClient] = useState(clients.length === 0);
  const [addImporterClient, setAddImporterClient] = useState<FormattedClient | null>(null);
  const [addPartyClient, setAddPartyClient] = useState<FormattedClient | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const filteredClients = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((client) => [
      client.name,
      client.contactName,
      client.contactEmail,
      ...client.importers.flatMap((importer) => [importer.name, importer.cbpImporterNumber]),
    ].some((value) => value?.toLowerCase().includes(term)));
  }, [clients, query]);

  function saved(nextMessage: Message) {
    setMessage(nextMessage);
    router.refresh();
    onSaved?.();
  }

  return (
    <div className="space-y-4">
      {message && (
        <div role={message.type === "error" ? "alert" : "status"} className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-semibold ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
          {message.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search client, contact, importer, or CBP number" className="bg-white pl-9" />
        </div>
        <Button onClick={() => setShowCreateClient((open) => !open)} variant={showCreateClient ? "secondary" : "primary"}>
          <UserPlus className="h-4 w-4" /> {showCreateClient ? "Close" : "Add client"}
        </Button>
      </div>

      {showCreateClient && <CreateClientCard onSaved={(name) => { saved({ type: "success", text: `Client “${name}” added.` }); setShowCreateClient(false); }} onError={(text) => setMessage({ type: "error", text })} />}

      <Card className="overflow-hidden border border-border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-xs">
            <thead className="border-b border-border bg-surface-muted/60 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
              <tr><th className="w-10 px-4 py-3"><span className="sr-only">Expand</span></th><th className="px-2 py-3">Client</th><th className="px-4 py-3">Importers</th><th className="px-4 py-3">Parties</th><th className="px-4 py-3">Shipments · 90d</th><th className="px-4 py-3">Terms</th><th className="px-4 py-3">Portal</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredClients.map((client) => {
                const expanded = expandedClientId === client.id;
                const ready = client.importers.filter((importer) => importer.readiness.ready).length;
                const partyOnly = client.legalEntities.filter((entity) => !entity.registeredImporterId);
                return [
                  <tr key={client.id} className="cursor-pointer hover:bg-surface-muted/30" onClick={() => setExpandedClientId(expanded ? null : client.id)}>
                    <td className="px-4 py-4"><button type="button" aria-label={`${expanded ? "Collapse" : "Expand"} ${client.name}`} aria-expanded={expanded} className="rounded-md p-1 text-ink-muted hover:bg-surface-muted">{expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button></td>
                    <td className="px-2 py-4"><Link href={`/app/clients/${client.id}`} onClick={(event) => event.stopPropagation()} className="font-bold text-ink hover:text-brand">{client.name}</Link><p className="mt-1 text-[10px] text-ink-muted">{client.contactName ?? client.contactEmail ?? "No primary contact"}</p></td>
                    <td className="px-4 py-4"><span className="font-bold text-ink">{client.importers.length}</span><span className="text-ink-muted"> · {ready} ready</span></td>
                    <td className="px-4 py-4"><Link href={`/app/parties?clientId=${client.id}`} onClick={(event) => event.stopPropagation()} className="font-semibold text-ink hover:text-brand">{client.partyCount}</Link></td>
                    <td className="px-4 py-4"><Link href={`/app/shipments?clientId=${client.id}`} onClick={(event) => event.stopPropagation()} className="font-semibold text-ink hover:text-brand">{client.shipmentCount90d}</Link></td>
                    <td className="px-4 py-4 text-ink">Net {client.paymentTermsDays}</td>
                    <td className="px-4 py-4"><Link href={`/app/clients/${client.id}`} onClick={(event) => event.stopPropagation()} className="font-semibold text-ink hover:text-brand">{client.portalUserCount ? `${client.portalUserCount} user${client.portalUserCount === 1 ? "" : "s"}` : "Not invited"}</Link></td>
                  </tr>,
                  expanded && <tr key={`${client.id}-detail`}><td colSpan={7} className="bg-surface-muted/25 px-5 py-5"><ClientPortfolioDetail client={client} partyOnly={partyOnly} onAddImporter={() => setAddImporterClient(client)} onAddParty={() => setAddPartyClient(client)} /></td></tr>,
                ];
              })}
            </tbody>
          </table>
        </div>
        {filteredClients.length === 0 && <div className="px-6 py-14 text-center"><Contact2 className="mx-auto h-8 w-8 text-ink-muted/40" /><p className="mt-3 text-sm font-bold text-ink">No clients match this search</p><p className="mt-1 text-xs text-ink-muted">Search by client, contact, importer, or CBP number.</p></div>}
      </Card>

      {addImporterClient && <NewCaseModal initialClient={{ id: addImporterClient.id, name: addImporterClient.name, contactEmail: addImporterClient.contactEmail }} lockClient onClose={() => setAddImporterClient(null)} />}
      {addPartyClient && <AddPartyModal client={addPartyClient} onClose={() => setAddPartyClient(null)} onSaved={(name) => { setAddPartyClient(null); saved({ type: "success", text: `Party “${name}” added to ${addPartyClient.name}.` }); }} />}
    </div>
  );
}

function ClientPortfolioDetail({ client, partyOnly, onAddImporter, onAddParty }: { client: FormattedClient; partyOnly: FormattedClient["legalEntities"]; onAddImporter: () => void; onAddParty: () => void }) {
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-bold text-ink">Filing identities and trade parties</p><p className="mt-0.5 text-[11px] text-ink-muted">Compliance status is read-only here; open an importer to resolve evidence.</p></div>
      <div className="flex flex-wrap gap-2"><Button size="sm" onClick={onAddImporter}><Plus className="h-3.5 w-3.5" /> Add importer</Button><Button size="sm" variant="secondary" onClick={onAddParty}><Landmark className="h-3.5 w-3.5" /> Add party</Button><Link href="/app/importers?client=none" className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold text-ink shadow-xs hover:bg-surface-muted"><Link2 className="h-3.5 w-3.5" /> Link existing importer</Link></div>
    </div>
    <div className="grid gap-3 lg:grid-cols-2">
      {client.importers.map((importer) => <Link key={importer.id} href={`/app/importers/${importer.id}`} className="group rounded-2xl border border-border bg-white p-4 shadow-2xs transition-colors hover:border-brand/30 hover:bg-brand/[0.02]"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-ink group-hover:text-brand">{importer.name}</p><p className="mt-1 font-mono text-[10px] text-ink-muted">{importer.cbpImporterNumber ?? "CBP number pending"}</p></div><Badge variant={importer.readiness.ready ? "success" : "warning"}>{importer.readiness.label}</Badge></div><div className="mt-3 flex flex-wrap gap-2 text-[10px]"><EvidenceChip good={importer.registrationStatus === "registered"} label="5106" /><EvidenceChip good={importer.poaStatus === "executed"} label={`POA ${importer.poaStatus?.replaceAll("_", " ") ?? "missing"}`} /><EvidenceChip good={Boolean(importer.bondStatus && ["verified", "attested"].includes(importer.bondStatus.toLowerCase()))} label={`Bond ${importer.bondStatus ?? "missing"}`} /></div>{!importer.readiness.ready && <p className="mt-3 text-[11px] font-medium text-amber-800">Next: {importer.readiness.blockers[0]?.label}</p>}</Link>)}
      {client.importers.length === 0 && <button type="button" onClick={onAddImporter} className="rounded-2xl border border-dashed border-border bg-white p-5 text-left hover:border-brand/40 hover:bg-brand/[0.02]"><Building2 className="h-5 w-5 text-brand" /><p className="mt-2 text-xs font-bold text-ink">Add the first importer</p><p className="mt-1 text-[11px] text-ink-muted">Start the broker-led registration and readiness workflow.</p></button>}
    </div>
    {partyOnly.length > 0 && <div className="rounded-xl border border-border bg-white px-4"><p className="border-b border-border py-3 text-[10px] font-bold uppercase tracking-wider text-ink-muted">Party-only legal entities</p>{partyOnly.map((entity) => <div key={entity.id} className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-0"><div><p className="text-xs font-semibold text-ink">{entity.legalName}</p><p className="text-[10px] text-ink-muted">{entity.entityType.replaceAll("_", " ")} · {entity.country}</p></div><Badge variant="default">Trade party</Badge></div>)}</div>}
  </div>;
}

function EvidenceChip({ good, label }: { good: boolean; label: string }) {
  return <span className={`rounded-full px-2 py-1 font-semibold capitalize ${good ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{good ? "●" : "○"} {label.replaceAll("_", " ")}</span>;
}

function CreateClientCard({ onSaved, onError }: { onSaved: (name: string) => void; onError: (message: string) => void }) {
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try { const response = await fetch("/api/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, contactName, contactEmail }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message ?? "Could not add client."); onSaved(name.trim()); }
    catch (cause) { onError(cause instanceof Error ? cause.message : "Could not add client."); setBusy(false); }
  }
  return <Card className="border border-brand/20 bg-brand/[0.02] p-4"><form onSubmit={submit} className="grid gap-3 lg:grid-cols-[2fr_1fr_1.5fr_auto]"><div><Label htmlFor="client-name">Client name *</Label><Input id="client-name" value={name} onChange={(event) => setName(event.target.value)} required autoFocus placeholder="Northwind Trade Group" className="mt-1" /></div><div><Label htmlFor="client-contact">Primary contact</Label><Input id="client-contact" value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Alex Morgan" className="mt-1" /></div><div><Label htmlFor="client-email">Contact email</Label><Input id="client-email" type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="ops@northwind.com" className="mt-1" /></div><Button type="submit" loading={busy} className="self-end"><UserPlus className="h-4 w-4" /> Add client</Button></form></Card>;
}

function AddPartyModal({ client, onClose, onSaved }: { client: FormattedClient; onClose: () => void; onSaved: (name: string) => void }) {
  const [legalName, setLegalName] = useState(""); const [tradeName, setTradeName] = useState(""); const [taxIdentifier, setTaxIdentifier] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(""); try { const response = await fetch("/api/legal-entities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: client.id, legalName, tradeName, taxIdentifier }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message ?? data.error ?? "Could not add party."); onSaved(legalName.trim()); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add party."); setBusy(false); } }
  return <Modal isOpen onClose={onClose} closeDisabled={busy} titleId="add-party-title"><ModalHeader titleId="add-party-title" title="Add trade party" subtitle={`For ${client.name} · does not create a CBP importer`} icon={<Landmark className="h-4 w-4" />} onClose={onClose} closeDisabled={busy} /><form onSubmit={submit} className="space-y-4"><div><Label htmlFor="party-legal-name">Legal company name *</Label><Input id="party-legal-name" value={legalName} onChange={(event) => setLegalName(event.target.value)} required autoFocus className="mt-1" /></div><div><Label htmlFor="party-trade-name">Trade name / DBA</Label><Input id="party-trade-name" value={tradeName} onChange={(event) => setTradeName(event.target.value)} className="mt-1" /></div><div><Label htmlFor="party-tax-id">Tax identifier</Label><Input id="party-tax-id" value={taxIdentifier} onChange={(event) => setTaxIdentifier(event.target.value)} className="mt-1 font-mono" /></div><div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-[11px] text-blue-800">This creates a reusable trade party only. Use <strong>Add importer</strong> when the company needs CBP registration, POA, bond, and screening.</div>{error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}<ModalFooter className="border-t border-border pt-4"><Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" loading={busy}><Plus className="h-4 w-4" /> Add party <ArrowRight className="h-3.5 w-3.5" /></Button></ModalFooter></form></Modal>;
}
