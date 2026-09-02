import React from 'react';
import type { ImporterSetup } from '@qubere/entry-proof';

const displayStatus = (status?: string | null) => status ? status.replaceAll('_', ' ') : 'Not on file';
const field = (label: string, value?: string | null) => <div className="py-1"><dt className="text-xs text-slate-500">{label}</dt><dd className="text-sm mt-1">{value || 'Not on file'}</dd></div>;

export function ImporterSetupList({ importers }: { importers: ImporterSetup[] }) {
  return <section aria-labelledby="importers-heading" className="space-y-4">
    <h2 id="importers-heading" className="text-lg font-semibold">Importers of record ({importers.length})</h2>
    {!importers.length && <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No importer records are on file for this selection yet.</p>}
    {importers.map(i => <article key={i.id} aria-labelledby={`importer-${i.id}`} className="rounded-2xl border border-slate-200 bg-white p-6">
      <header className="flex justify-between items-start gap-3"><h3 id={`importer-${i.id}`} className="font-semibold">{i.importer.legalName}</h3><span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-800 capitalize">{displayStatus(i.onboarding.status)}</span></header>
      {i.onboardingCaseId && <ol aria-label={`${i.importer.legalName} setup progress`} className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 mt-4">
        {i.onboarding.steps.map(s => <li key={s.key} className={`rounded-lg p-2 text-xs ${s.state === 'done' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-600'}`}><span aria-hidden="true" className="mr-2">{s.state === 'done' ? '✓' : s.state === 'waived' ? '—' : '○'}</span>{s.label}<span className="sr-only">: {s.state}</span>{s.state === 'waived' && ' · Waived'}</li>)}
      </ol>}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4 mt-5">
        <div><h4 className="font-medium text-sm mb-2">Importer registration</h4><dl>{field('EIN', i.importer.ein)}{field('CBP importer number', i.importer.cbpImporterNumber)}{field('Registration', displayStatus(i.importer.registrationStatus))}</dl></div>
        <div><h4 className="font-medium text-sm mb-2">Power of Attorney</h4><dl>{field('Status', displayStatus(i.poa?.status))}{field('Signer', i.poa?.signerName)}{field('Execution method', i.poa?.executionMethod)}{field('Signed date', i.poa?.signedDate ? new Date(i.poa.signedDate).toLocaleDateString() : null)}</dl>{(i.poa?.documentId || i.poa?.downloadUrl) && <a className="inline-block mt-2 text-sm text-[#0071E3]" href={i.poa?.documentId ? `/api/setup/documents/${i.poa.documentId}/download` : i.poa?.downloadUrl ?? undefined}>View signed POA →</a>}</div>
        <div><h4 className="font-medium text-sm mb-2">Customs bond</h4><dl>{field('Status', displayStatus(i.bond?.status))}{field('Surety', i.bond?.surety)}{field('Bond number', i.bond?.number)}{field('Type / amount', i.bond ? `${i.bond.type} · $${i.bond.amountUsd.toLocaleString()}` : null)}{field('Expiration', i.bond?.expirationDate ? new Date(i.bond.expirationDate).toLocaleDateString() : null)}</dl></div>
        <div><h4 className="font-medium text-sm mb-2">Screening</h4><p className="text-sm capitalize">{displayStatus(i.screening.status)}</p><p className="text-xs text-slate-500 mt-2">Your broker can answer questions about this importer’s screening status.</p></div>
      </div>
      {i.onboarding.blockers.length > 0 && <ul className="mt-4 text-sm text-amber-800 space-y-1">{i.onboarding.blockers.map(b => <li key={b}>{b}</li>)}</ul>}
    </article>)}
  </section>;
}
