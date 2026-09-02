'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowDownToLine, Building2, CheckCircle2, FileCheck2, Files, Mail, RefreshCw, UserRound, UserRoundPlus, Users } from 'lucide-react';
import type { SetupSummary } from '@qubere/entry-proof';
import { ImporterSetupList } from '@/components/ImporterSetupList';
import { SetupProgressRibbon, SetupStatusPill } from '@/components/SetupProgressRibbon';

const secondaryButton = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50';
const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-50';
const inputClass = 'mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-blue-100';
const panel = 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm';
const panelHeader = 'flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4';

export default function SetupPage() {
  const [data, setData] = useState<SetupSummary | null>(null);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [invite, setInvite] = useState(false), [sent, setSent] = useState(false), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  // Keep the current workspace visible during refresh, but never show a previous
  // company's data beneath a newly selected company label.
  const shown = data && (data.clientId ?? '') === selected ? data : null;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    fetch(`/api/setup${selected ? `?clientId=${encodeURIComponent(selected)}` : ''}`, { signal: controller.signal, cache: 'no-store' }).then(async r => {
      if (!r.ok) {
        if (r.status === 404 || r.status === 403) throw new Error('This setup is not available to your login. Ask your service provider to check your workspace access.');
        if (r.status === 401) throw new Error('Your session has expired. Sign in again to view your setup.');
        throw new Error('Could not load your setup. Please try again.');
      }
      return r.json();
    }).then(d => {
      if (!controller.signal.aborted) { setClients(d.clients ?? []); setData(d.selectClient ? null : d); }
    }).catch(e => {
      if (!controller.signal.aborted) setError(e.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [selected, retry]);

  useEffect(() => {
    const refresh = () => setRetry(n => n + 1);
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  return <div className="space-y-5 pb-6 text-ink">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">Your company</p><h1 className="mt-1 text-2xl font-bold tracking-tight">Your setup</h1><p className="mt-1 text-xs text-ink-muted">Registration, authorizations and readiness to file.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        {clients.length > 1 && <label className="text-xs text-slate-500"><span className="sr-only">Filter setup by company</span><select value={selected} onChange={e => { setSelected(e.target.value); setSent(false); setInvite(false); }} className="max-w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-ink outline-none focus:ring-2 focus:ring-brand"><option value="">All workspace setup</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
        <button disabled={loading} onClick={() => setRetry(n => n + 1)} className={secondaryButton}><RefreshCw aria-hidden="true" className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />{loading && shown ? 'Refreshing…' : 'Refresh setup'}</button>
      </div>
    </header>

    {error && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><AlertCircle aria-hidden="true" className="size-4 shrink-0" /><p className="flex-1">{error}</p><button onClick={() => setRetry(n => n + 1)} className="rounded px-2 py-1 text-xs font-semibold underline focus-visible:ring-2 focus-visible:ring-rose-500">Try again</button></div>}

    {!shown && loading ? <div role="status" aria-label="Loading your setup" className="space-y-5"><span className="sr-only">Loading your setup…</span><div className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white" /><div className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white" /></div> : !shown ? !error && <section className={`${panel} px-6 py-12 text-center`}><Building2 aria-hidden="true" className="mx-auto mb-3 size-8 text-slate-300" /><h2 className="text-sm font-semibold">No setup available</h2><p className="mt-2 text-xs text-ink-muted">Your service provider’s setup records will appear in this workspace.</p></section> : <div aria-busy={loading} className="space-y-5">
      <SetupProgressRibbon onboarding={shown.onboarding} />

      <section className={panel} aria-label="Workspace setup overview">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><h2 className="break-words text-xl font-bold tracking-tight">{shown.clientName}</h2><SetupStatusPill status={shown.onboarding.status} /></div><p className="mt-2 text-xs text-ink-muted">{shown.clientId ? 'Company setup' : 'Workspace setup'}<span aria-hidden="true" className="mx-2">·</span>{shown.importers.length} importer{shown.importers.length === 1 ? '' : 's'} of record</p></div>
          <div className="flex items-center gap-3 text-xs text-slate-500"><span className="inline-flex items-center gap-1.5"><Files aria-hidden="true" className="size-3.5" />{shown.documents.length} document{shown.documents.length === 1 ? '' : 's'}</span><span className="h-3 w-px bg-slate-200" /><span className="inline-flex items-center gap-1.5"><Users aria-hidden="true" className="size-3.5" />{shown.stakeholders.length} people</span></div>
        </div>
        <nav aria-label="Setup sections" className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3 sm:px-4">{[['#importers', 'Importers'], ['#setup-documents', 'Documents'], ['#setup-people', 'People'], ['#broker-team', 'Broker team']].map(([href, label]) => <a key={href} href={href} className="shrink-0 rounded-t-lg border-b-2 border-transparent px-3 py-3 text-xs font-medium text-slate-500 transition hover:border-brand hover:bg-blue-50/50 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand">{label}</a>)}</nav>
      </section>

      <ImporterSetupList importers={shown.importers} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <section id="setup-documents" aria-labelledby="setup-documents-title" className={`${panel} scroll-mt-24`}>
          <header className={panelHeader}><h2 id="setup-documents-title" className="flex items-center gap-2 text-sm font-semibold"><Files aria-hidden="true" className="size-4 text-slate-400" />Documents on file<span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{shown.documents.length}</span></h2></header>
          {shown.documents.length ? <ul className="divide-y divide-slate-100 px-5">{shown.documents.map(d => <li key={d.id} className="flex items-center gap-3 py-4"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-brand"><FileCheck2 aria-hidden="true" className="size-4" /></span><div className="min-w-0 flex-1"><p className="break-words text-xs font-semibold">{d.title}</p><p className="mt-1 text-[10px] text-ink-muted">{d.kind.replaceAll('_', ' ')}{d.expirationDate && ` · Expires ${new Date(d.expirationDate).toLocaleDateString()}`}</p></div><a className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold text-brand hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" aria-label={`Download ${d.title}`} href={d.downloadUrl ?? `/api/setup/documents/${d.id}/download`}><ArrowDownToLine aria-hidden="true" className="size-3.5" /><span className="hidden sm:inline">Download</span><span className="sr-only"> {d.title}</span></a></li>)}</ul> : <div className="px-5 py-8 text-center"><Files aria-hidden="true" className="mx-auto mb-3 size-6 text-slate-300" /><p className="text-xs text-ink-muted">Signed and accepted documents will appear here when available.</p></div>}
        </section>
        <section id="broker-team" aria-labelledby="broker-team-title" className={`${panel} scroll-mt-24`}>
          <header className={panelHeader}><h2 id="broker-team-title" className="flex items-center gap-2 text-sm font-semibold"><UserRound aria-hidden="true" className="size-4 text-slate-400" />Your broker team</h2></header>
          {shown.brokerTeam.length ? <ul className="divide-y divide-slate-100 px-5">{shown.brokerTeam.map(b => <li key={b.email} className="flex min-w-0 gap-3 py-4"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">{b.name.split(' ').slice(0, 2).map(n => n[0]).join('')}</span><div className="min-w-0"><p className="text-xs font-semibold">{b.name}</p><p className="mt-1 text-[11px] text-ink-muted">{b.role}</p><a href={`mailto:${b.email}`} className="mt-2 inline-flex max-w-full items-start gap-1.5 rounded text-xs text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand"><Mail aria-hidden="true" className="mt-0.5 size-3 shrink-0" /><span className="break-all">{b.email}</span></a></div></li>)}</ul> : <p className="px-5 py-6 text-xs leading-5 text-ink-muted">Your service provider’s assigned team will appear here.</p>}
        </section>
      </div>

      <section id="setup-people" aria-labelledby="setup-people-title" className={`${panel} scroll-mt-24`}>
        <header className={panelHeader}><h2 id="setup-people-title" className="flex items-center gap-2 text-sm font-semibold"><Users aria-hidden="true" className="size-4 text-slate-400" />People</h2><button aria-expanded={invite} aria-controls="setup-access-request" onClick={() => setInvite(!invite)} className={secondaryButton}><UserRoundPlus aria-hidden="true" className="size-3.5" />Request access for someone</button></header>
        {shown.stakeholders.length ? <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50/70 text-[10px] uppercase tracking-wide text-slate-500"><tr>{['Name', 'Role', 'Signer', 'Login'].map(h => <th scope="col" className="px-5 py-3 font-semibold" key={h}>{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{shown.stakeholders.map((p, index) => <tr key={index}><td className="px-5 py-4 font-medium">{p.name}{p.title && <span className="mt-1 block text-[11px] font-normal text-ink-muted">{p.title}</span>}</td><td className="px-5 py-4 capitalize text-slate-500">{p.role.toLowerCase().replaceAll('_', ' ')}</td><td className="px-5 py-4">{p.isSigner ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 aria-hidden="true" className="size-3.5" />Yes</span> : <span className="text-ink-muted">—</span>}</td><td className="px-5 py-4"><SetupStatusPill status={p.loginStatus} /></td></tr>)}</tbody></table></div> : <p className="px-5 py-6 text-xs text-ink-muted">No contacts on file. Request access to add someone from your team.</p>}
        {sent ? <p role="status" className="flex items-center gap-2 border-t border-emerald-100 bg-emerald-50 px-5 py-4 text-xs text-emerald-800"><CheckCircle2 aria-hidden="true" className="size-4" />Access request sent to your broker.</p> : invite && <form id="setup-access-request" className="grid gap-4 border-t border-slate-100 bg-slate-50/50 p-5 md:grid-cols-2" onSubmit={async e => {
          e.preventDefault(); setBusy(true); setError('');
          const form = new FormData(e.currentTarget);
          try {
            const response = await fetch('/api/setup/stakeholders/invite-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: shown.clientId ?? form.get('clientId'), name: form.get('name'), email: form.get('email'), role: form.get('role') }) });
            if (!response.ok) throw new Error(response.status === 404 ? 'Your role cannot request portal access. Ask your administrator.' : 'Access request failed.');
            setSent(true);
          } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); }
          finally { setBusy(false); }
        }}>
          {!shown.clientId && <label className="text-xs font-medium text-slate-600">Company<select required name="clientId" defaultValue={clients.length === 1 ? clients[0].id : ''} className={inputClass}><option value="" disabled>Choose a company</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
          <label className="text-xs font-medium text-slate-600">Name<input required name="name" className={inputClass} /></label>
          <label className="text-xs font-medium text-slate-600">Email<input required type="email" name="email" className={inputClass} /></label>
          <label className="text-xs font-medium text-slate-600">Role<select name="role" className={inputClass}>{['VIEWER', 'CUSTOMS_CONTACT', 'BILLING_CONTACT', 'OFFICER_SIGNER', 'SUPPLIER_CONTACT', 'IMPORTER_ADMIN'].map(role => <option key={role} value={role}>{role.toLowerCase().replaceAll('_', ' ')}</option>)}</select></label>
          <div className="flex items-center gap-2 md:col-span-2"><button disabled={busy} className={primaryButton}><UserRoundPlus aria-hidden="true" className="size-3.5" />{busy ? 'Sending…' : 'Request access'}</button><button type="button" onClick={() => setInvite(false)} className={secondaryButton}>Cancel</button></div>
        </form>}
      </section>
    </div>}
  </div>;
}
