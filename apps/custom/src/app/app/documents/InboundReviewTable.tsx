'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, FileText, RefreshCw, ShieldAlert } from 'lucide-react';
type Review = { id: string; reason: string; clientId: string | null; client: { name: string } | null; createdAt: string; inboundEmail: { originalFromAddress: string; subject: string | null }; shipmentDocument: { id: string; fileName: string; status: string } | null; candidateSummary: { shipmentId: string; score: number; signals: { type: string; value: string }[] }[] | null };
type Shipment = { id: string; shipmentNumber: string; importerName: string };
const reasons: Record<string, string> = { UNKNOWN_SENDER: 'Check sender', MATCH_CONFLICT: 'Multiple shipment matches', LOW_CONFIDENCE: 'Confirm shipment', NO_MATCH: 'Choose shipment', EXTRACTION_FAILED: 'Document could not be read' };
const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-surface-muted disabled:opacity-40';
export function InboundReviewTable() {
  const [rows, setRows] = useState<Review[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [busy, setBusy] = useState(''), [message, setMessage] = useState('');
  const [selected, setSelected] = useState<Review | null>(null), [shipments, setShipments] = useState<Shipment[]>([]), [candidateShipments, setCandidateShipments] = useState<Shipment[]>([]), [shipmentId, setShipmentId] = useState(''), [q, setQ] = useState('');
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]), [clientId, setClientId] = useState(''), [cursor, setCursor] = useState<string | null>(null), [confirm, setConfirm] = useState('');
  const load = async (next?: string) => {
    setLoading(true); setError('');
    try { const r = await fetch(`/api/broker/inbound-reviews${next ? `?cursor=${encodeURIComponent(next)}` : ''}`); if (!r.ok) throw new Error('Unable to load email review. Try again.'); const d = await r.json(); setRows(v => next ? [...v, ...d.items] : d.items); setCursor(d.nextCursor); }
    catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try { const r = await fetch(`/api/broker/inbound-reviews/${selected.id}?q=${encodeURIComponent(q)}`, { signal: controller.signal }); if (!r.ok) throw new Error('Unable to load shipments.'); const d = await r.json(); setShipments(d.shipments); setCandidateShipments(d.candidateShipments ?? []); setClients(d.clients); }
      catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [selected, q]);
  async function decide(action: string) {
    if (!selected) return;
    setBusy(action); setError('');
    try {
      const r = await fetch(`/api/broker/inbound-reviews/${selected.id}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shipmentId: shipmentId || undefined, clientId: clientId || undefined }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.message || 'Could not save the decision. Refresh and try again.');
      setMessage(action === 'resolve' ? 'Document attached. Any updated Entry Proof stays a draft until published.' : action === 'approve' ? 'Email approved. Attachments are queued for scanning.' : action === 'reassign' ? 'Client updated. Open the item to choose its shipment.' : 'Document discarded.');
      setSelected(null); setConfirm(''); await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(''); }
  }
  return <div className="space-y-5">
    <Link href="/app/documents" className="inline-flex items-center gap-2 text-sm text-brand"><ArrowLeft size={16} />Documents</Link>
    <div className="flex items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold text-ink">Email review</h1><p className="mt-1 text-sm text-ink-muted">Confirm the sender and shipment before documents enter the filing workflow.</p></div><button className={button} disabled={loading || !!busy} onClick={() => load()}><RefreshCw size={16} />Refresh</button></div>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="flex items-center gap-2 rounded-xl bg-blue-50 p-4 text-sm text-blue-800"><Check size={16} />{message}</p>}
    <div className="grid items-start gap-5 lg:grid-cols-2"><div><div className="max-h-[70vh] overflow-auto rounded-xl border border-border bg-surface"><div className="border-b border-border px-5 py-3 text-sm font-semibold">{rows.length}{cursor ? '+' : ''} awaiting a decision</div>
      {loading && !rows.length ? <p className="p-6 text-sm text-ink-muted">Loading review queue…</p> : !rows.length ? <div className="p-10 text-center"><Check className="mx-auto mb-3 text-emerald-600" /><h2 className="font-semibold">No documents waiting for review</h2><p className="mt-1 text-sm text-ink-muted">Ambiguous matches and new senders will appear here.</p></div> : rows.map(row => <button key={row.id} disabled={!!busy} onClick={() => { setSelected(row); setShipmentId(''); setClientId(''); setQ(''); setShipments([]); setCandidateShipments([]); setConfirm(''); }} className={`flex w-full flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4 text-left hover:bg-blue-50 ${selected?.id === row.id ? 'bg-blue-50' : ''}`}><div className="min-w-0"><p className="flex items-center gap-2 font-medium"><FileText size={16} className="text-brand" />{row.shipmentDocument?.fileName || row.inboundEmail.subject || 'Email held for sender approval'}</p><p className="mt-1 text-sm text-ink-muted">{row.client?.name || 'Operations inbox'} · {row.inboundEmail.originalFromAddress}</p><p className="mt-1 text-xs text-ink-muted">Received {new Date(row.createdAt).toLocaleString()}</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">{reasons[row.reason] || 'Needs review'}</span></button>)}
    </div>
    {cursor && <button className={`${button} mt-3`} disabled={loading || !!busy} onClick={() => load(cursor)}>Load more</button>}</div>
    {selected && <section aria-label="Review selected document" className="lg:sticky lg:top-4 rounded-xl border border-blue-200 bg-surface p-5 space-y-4"><div className="flex justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-brand">Review decision</p><h2 className="mt-1 text-lg font-semibold">{selected.shipmentDocument?.fileName || 'Approve this email'}</h2><p className="text-sm text-ink-muted">{selected.client?.name || 'Operations inbox'} · {selected.inboundEmail.originalFromAddress}</p></div><button className={button} disabled={!!busy} onClick={() => setSelected(null)}>Close</button></div>
      {selected.shipmentDocument && <a className={`${button} text-brand`} href={`/api/documents/proxy?documentId=${encodeURIComponent(selected.shipmentDocument.id)}`} target="_blank" rel="noreferrer">Preview document ↗</a>}
      {selected.reason === 'UNKNOWN_SENDER' && <p className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><ShieldAlert size={18} className="shrink-0" />This sender is not on the approved list. Check the sender and document before continuing. This decision approves only this item.</p>}
      {selected.shipmentDocument ? <>
        {!!selected.candidateSummary?.length && <div><h3 className="text-sm font-semibold">Matching evidence</h3>{selected.candidateSummary.map(c => <p key={c.shipmentId} className="mt-2 rounded-lg bg-surface-muted p-3 text-sm">{candidateShipments.find(s => s.id === c.shipmentId)?.shipmentNumber || 'Shipment unavailable'} · {Math.round(c.score * 100)}% match<br /><span className="text-ink-muted">{c.signals.map(s => `${s.type.replaceAll('_', ' ')} ${s.value}`).join(' · ')}</span></p>)}</div>}
        <label className="block text-sm font-medium">Find a shipment for {selected.client?.name || 'this inbox'}<input value={q} disabled={!!busy} onChange={e => { setQ(e.target.value); setShipmentId(''); }} placeholder="Search shipment number" className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2" /></label>
        <label className="block text-sm font-medium">Attach to shipment<select disabled={!!busy} value={shipmentId} onChange={e => setShipmentId(e.target.value)} className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2"><option value="">Choose a shipment — no selection yet</option>{[...new Map([...(q ? [] : candidateShipments), ...shipments].map(s => [s.id, s])).values()].map(s => <option key={s.id} value={s.id}>{s.shipmentNumber} · {s.importerName}</option>)}</select></label>
        <div className="flex flex-wrap items-center gap-3"><button className={`${button} bg-brand text-white hover:bg-brand/90`} disabled={!shipmentId || !!busy} onClick={() => decide('resolve')}>{busy === 'resolve' ? 'Attaching…' : 'Attach document'}</button><button className={`${button} text-red-700`} disabled={!!busy} onClick={() => setConfirm('discard')}>Discard…</button></div>
        <details className="border-t border-border pt-3"><summary className="cursor-pointer text-sm text-ink-muted">Wrong client?</summary><p className="my-2 text-sm text-ink-muted">Reassign within this workspace, then choose a shipment. The original email destination stays in the audit history.</p><select aria-label="Reassign client" className="rounded-lg border border-border p-2 text-sm" value={clientId} onChange={e => setClientId(e.target.value)}><option value="">Choose client</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button className={`${button} ml-2`} disabled={!clientId || clientId === selected.clientId || !!busy} onClick={() => setConfirm('reassign')}>Reassign…</button></details>
      </> : <div className="flex gap-3"><button className={`${button} bg-brand text-white`} disabled={!!busy} onClick={() => decide('approve')}>Approve email and scan attachments</button><button className={`${button} text-red-700`} disabled={!!busy} onClick={() => setConfirm('discard')}>Discard…</button></div>}
      {confirm && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm"><p>{confirm === 'discard' ? 'Discard this item? It will leave the review queue and will not be used for filing.' : `Move this document to ${clients.find(c => c.id === clientId)?.name}? It will be visible in that client’s documents.`}</p><div className="mt-3 flex gap-3"><button className={button} disabled={!!busy} onClick={() => decide(confirm)}>Confirm {confirm}</button><button className={button} disabled={!!busy} onClick={() => setConfirm('')}>Cancel</button></div></div>}
    </section>}
    {!selected && <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">Select a document to inspect its sender, preview, and shipment evidence.</div>}</div>
  </div>;
}
