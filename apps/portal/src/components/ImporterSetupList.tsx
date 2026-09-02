import React from 'react';
import { AlertCircle, Building2, Check, Clock3, FileCheck2, Landmark, ScanLine, ShieldCheck } from 'lucide-react';
import type { ImporterSetup } from '@qubere/entry-proof';
import { SetupStatusPill } from './SetupProgressRibbon';

const date = (value?: string | null) => value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null;
const field = (label: string, value?: string | null) => <div className="min-w-0"><dt className="text-[11px] text-slate-500">{label}</dt><dd className="mt-1 break-words text-xs font-medium text-ink">{value || 'Not on file'}</dd></div>;
const tile = 'min-w-0 rounded-xl border border-slate-200 bg-slate-50/60 p-4';
const heading = 'mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600';

export function ImporterSetupList({ importers }: { importers: ImporterSetup[] }) {
  return <section id="importers" aria-labelledby="importers-heading" className="scroll-mt-24 space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-2"><h2 id="importers-heading" className="text-sm font-semibold text-ink">Importers of record ({importers.length})</h2><p className="text-xs text-ink-muted">Registration and readiness for each legal entity</p></div>
    {!importers.length && <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center"><Building2 aria-hidden="true" className="mx-auto mb-3 size-7 text-slate-300" /><p className="text-sm font-medium">No importers on file</p><p className="mt-2 text-xs text-ink-muted">Importer records will appear here when your service provider adds them.</p></div>}
    {importers.map(i => {
      const download = i.poa?.documentId ? `/api/setup/documents/${i.poa.documentId}/download` : i.poa?.downloadUrl;
      const complete = i.onboarding.steps.filter(s => s.state === 'done' || s.state === 'waived').length;
      return <article key={i.id} aria-labelledby={`importer-${i.id}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-brand"><Building2 aria-hidden="true" className="size-5" /></span><div className="min-w-0"><h3 id={`importer-${i.id}`} className="break-words text-base font-semibold tracking-tight">{i.importer.legalName}</h3><p className="mt-1 text-[11px] text-ink-muted">Importer of record{i.onboardingCaseId ? ` · ${complete} of ${i.onboarding.steps.length} steps complete` : ' · On file'}</p></div></div>
          <SetupStatusPill status={i.onboarding.status} />
        </header>
        <div className="space-y-5 p-5 sm:p-6">
          {i.onboardingCaseId && <ol aria-label={`${i.importer.legalName} setup progress`} className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
            {i.onboarding.steps.map(s => {
              const done = s.state === 'done' || s.state === 'waived';
              return <li key={s.key} className="flex items-start gap-2 text-[11px]"><span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${done ? 'bg-emerald-500 text-white' : 'border border-slate-200 bg-slate-50 text-slate-400'}`}>{done ? <Check aria-hidden="true" className="size-3" /> : <Clock3 aria-hidden="true" className="size-3" />}</span><span className="leading-5 text-slate-600">{s.label}<span className="sr-only">: {s.state}</span>{s.state === 'waived' && <span className="block text-[10px] text-ink-muted">Waived</span>}</span></li>;
            })}
          </ol>}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <section className={tile}><h4 className={heading}><Landmark aria-hidden="true" className="size-3.5" />Importer registration</h4><dl className="space-y-3">{field('Legal name', i.importer.legalName)}{field('EIN', i.importer.ein)}{field('CBP importer number', i.importer.cbpImporterNumber)}</dl><div className="mt-4"><SetupStatusPill status={i.importer.registrationStatus} /></div></section>
            <section className={tile}><h4 className={heading}><FileCheck2 aria-hidden="true" className="size-3.5" />Power of Attorney</h4><div className="mb-4"><SetupStatusPill status={i.poa?.status} /></div><dl className="space-y-3">{field('Signer', i.poa?.signerName)}{field('Execution method', i.poa?.executionMethod?.replaceAll('_', ' '))}{field('Signed date', date(i.poa?.signedDate))}</dl>{download && <a className="mt-4 inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-brand transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" href={download}><FileCheck2 aria-hidden="true" className="size-3.5" />View signed POA<span className="sr-only"> for {i.importer.legalName}</span></a>}</section>
            <section className={tile}><h4 className={heading}><ShieldCheck aria-hidden="true" className="size-3.5" />Customs bond</h4><div className="mb-4"><SetupStatusPill status={i.bond?.status} /></div><dl className="space-y-3">{field('Surety', i.bond?.surety)}{field('Bond number', i.bond?.number)}{field('Type / amount', i.bond ? `${i.bond.type} · $${i.bond.amountUsd.toLocaleString()}` : null)}{field('Expiration', date(i.bond?.expirationDate))}</dl></section>
            <section className={tile}><h4 className={heading}><ScanLine aria-hidden="true" className="size-3.5" />Screening</h4><SetupStatusPill status={i.screening.status} /><p className="mt-4 text-xs leading-5 text-slate-500">Your broker can answer questions about this importer’s screening status.</p>{i.screening.lastRunAt && <dl className="mt-4">{field('Last checked', date(i.screening.lastRunAt))}</dl>}</section>
          </div>
          {i.onboarding.blockers.length > 0 && <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3"><AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-600" /><div><p className="text-xs font-semibold text-amber-900">Still needed for this importer</p><ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-amber-800">{i.onboarding.blockers.map(b => <li key={b}>{b}</li>)}</ul></div></div>}
        </div>
      </article>;
    })}
  </section>;
}
