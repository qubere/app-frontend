'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { EntryProofPayload, EntryProofLine, MeasureStatus } from '@qubere/entry-proof';
const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
const colors: Record<string, string> = { STRONG: 'bg-emerald-50 text-emerald-800', VERIFIED: 'bg-emerald-50 text-emerald-800', REVIEW: 'bg-amber-50 text-amber-900', AT_RISK: 'bg-rose-50 text-rose-800' };
export function ProofBadge({ state }: {
    state: string;
}) { return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${colors[state] ?? 'bg-slate-100 text-slate-700'}`}>{state.replaceAll('_', ' ')}</span>; }
export function MeasureChip({ status }: {
    status: MeasureStatus;
}) {
    const labels = { EVALUATED_APPLICABLE: 'Applies', EVALUATED_NOT_APPLICABLE: 'Does not apply', NOT_EVALUATED: 'Not evaluated', DATA_UNAVAILABLE: 'Data unavailable', REVIEW_REQUIRED: 'Review required' };
    return <span className={`text-xs rounded-full px-2 py-1 ${status.startsWith('EVALUATED') ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>{labels[status]}</span>;
}
export function AskAboutLine({ filingId, lineNumber }: {
    filingId: string;
    lineNumber?: number;
}) {
    const [open, setOpen] = useState(false), [body, setBody] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [href, setHref] = useState('');
    if (href)
        return <p role="status" className="text-sm text-emerald-800">Question sent. <Link className="underline" href={href}>Follow the conversation</Link></p>;
    return <div>{!open ? <button onClick={() => setOpen(true)} className="text-sm font-semibold text-[#0071E3]">{lineNumber ? `Ask about line ${lineNumber}` : 'Ask your broker about this entry'}</button> : <form className="space-y-3" onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                    const r = await fetch(`/api/entries/${filingId}/proof/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body, ...(lineNumber ? { lineNumber } : {}) }) });
                    const data = await r.json();
                    if (!r.ok)
                        throw new Error(r.status === 404 ? 'Your access does not allow questions on this entry.' : 'Could not send your question. Please try again.');
                    setHref(data.href);
                }
                catch (e) {
                    setError(e instanceof Error ? e.message : 'Request failed');
                }
                finally {
                    setBusy(false);
                }
            }}>
 <label className="block text-sm font-medium">{lineNumber ? `Question about line ${lineNumber}` : 'Question for your broker'}<textarea required maxLength={5000} value={body} onChange={e => setBody(e.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 p-3" rows={3}/></label>
 <button disabled={busy || !body.trim()} className="rounded-lg bg-[#0071E3] px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? 'Sending…' : 'Send question'}</button> <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-600">Cancel</button>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}</form>}</div>;
}
export function LineProofCard({ line, filingId }: {
    line: EntryProofLine;
    filingId: string;
}) {
    return <details className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
  <summary className="cursor-pointer p-5 flex flex-wrap items-center gap-4"><span className="text-xs font-semibold text-slate-500">LINE {line.lineNumber}</span><span className="flex-1 min-w-40"><strong className="block text-sm">{line.description}</strong><span className="text-xs text-slate-500">{line.htsCode || 'Classification missing'} · {line.countryOfOrigin || 'Origin unavailable'}</span></span><span className="text-sm tabular-nums">{usd(line.enteredValueUsd)}</span><ProofBadge state={line.verifyState}/></summary>
  <div className="border-t border-slate-100 p-5 space-y-6"><p className="text-sm text-slate-700">{line.verifyReason}</p>
   <div className="grid gap-6 lg:grid-cols-2"><section><h3 className="font-semibold mb-2">Classification</h3><p className="text-sm">{line.htsDescription || line.description}</p><p className="text-sm text-slate-600 mt-2">{line.whyThisCode || 'Your broker has not published a classification explanation yet.'}</p><p className="text-xs text-slate-500 mt-2">{line.classificationStatus.replaceAll('_', ' ')}{line.htsConfidence !== null ? ` · Confidence ${line.htsConfidence}%` : ''}</p>{line.griRulesApplied.length > 0 && <p className="text-xs mt-2">{line.griRulesApplied.join(' · ')}</p>}{line.classificationApprovedAt && <p className="text-xs mt-2">Approved {new Date(line.classificationApprovedAt).toLocaleDateString()}</p>}
   <h3 className="font-semibold mt-5 mb-2">Agency requirements</h3><p className="text-sm">{line.pgaAgencies.length ? line.pgaAgencies.join(', ') : 'No agency requirements included in this proof.'}</p>
   <h3 className="font-semibold mt-5 mb-2">Valuation</h3><p className="text-sm">Declared value {usd(line.valuation.transactionValueUsd)} · {line.valuation.relatedParty ? 'Related-party transaction' : 'No related-party transaction recorded'}</p>{!line.valuation.assistsDeclared && <p className="text-sm text-amber-800">Assists require review. Entry-wide estimate: {usd(line.valuation.assistsUndeclaredEstimateUsd)}.</p>}</section>
   <section><h3 className="font-semibold mb-3">Duty and fees</h3><div className="space-y-3">{line.dutyStack.map(d => <div key={d.key} className="flex flex-wrap gap-2 items-center border-b border-slate-100 pb-2"><span className="flex-1 text-sm">{d.label}<span className="block text-xs text-slate-500">{d.ratePct === null ? 'Rate unavailable' : `${d.ratePct}%`}</span></span><MeasureChip status={d.status}/><span className="text-sm tabular-nums">{['NOT_EVALUATED', 'DATA_UNAVAILABLE', 'REVIEW_REQUIRED'].includes(d.status) && d.amountUsd === 0 ? '—' : usd(d.amountUsd)}</span></div>)}</div><p className="text-xs text-slate-500 mt-2">Unavailable amounts are not a zero-duty determination.</p></section></div>
   {line.flags.map((f, i) => <div key={f.findingId ?? i} className="rounded-xl bg-amber-50 p-4"><strong className="text-sm">{f.title}</strong><p className="text-sm mt-1">{f.whatItMeans}</p></div>)}
   <section><h3 className="font-semibold mb-2">Evidence</h3>{line.evidence.length ? <ul className="flex flex-wrap gap-3 text-sm">{line.evidence.map((e, i) => <li key={i}>{e.portalHref ? <a className="text-[#0071E3] underline" href={e.portalHref}>{e.label}</a> : <span>{e.label}</span>}</li>)}</ul> : <p className="text-sm text-slate-500">No supporting evidence published.</p>}</section>
   <AskAboutLine filingId={filingId} lineNumber={line.lineNumber}/>
  </div></details>;
}
export function EntryProofView({ proof }: {
    proof: EntryProofPayload;
}) {
    const s = proof.scorecard;
    return <div className="space-y-6"><section className="rounded-2xl bg-white border border-slate-200 p-6"><div className="flex flex-wrap gap-6 items-center"><div className="relative w-24 h-24 shrink-0"><svg viewBox="0 0 100 100" aria-label={`Compliance score ${s.scoreOverall} out of 100`}><circle cx="50" cy="50" r="42" fill="none" stroke="#E5E5EA" strokeWidth="7"/><circle cx="50" cy="50" r="42" fill="none" stroke={s.scoreBand === 'STRONG' ? '#059669' : s.scoreBand === 'AT_RISK' ? '#e11d48' : '#d97706'} strokeWidth="7" pathLength="100" strokeDasharray={`${s.scoreOverall} 100`} transform="rotate(-90 50 50)"/></svg><strong className="absolute inset-0 flex items-center justify-center text-2xl">{s.scoreOverall}</strong></div><div className="flex-1"><p className="text-xs text-slate-500 uppercase tracking-widest">Entry Proof</p><h1 className="text-2xl font-bold mt-1">{proof.entryNumber}</h1><p className="text-sm text-slate-600 mt-1">{proof.importerName} · {s.linesVerified} of {s.linesTotal} lines verified</p><div className="mt-3"><ProofBadge state={s.scoreBand}/></div></div><a href={`/api/entries/${proof.filingId}/download`} className="text-sm font-medium text-[#0071E3]">Download 7501</a></div>
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mt-6 pt-5 border-t border-slate-100">{[['Entered value', usd(proof.totals.enteredValueUsd)], ['Duty and fees', usd(proof.totals.dutyAndFeesUsd)], ['Duty savings identified', usd(s.dutySavingsIdentifiedUsd)], ['Lines needing attention', String(s.linesReview + s.linesAtRisk)]].map(([k, v]) => <div key={k}><p className="text-xs text-slate-500">{k}</p><p className="text-xl font-semibold mt-1">{v}</p></div>)}</div><p className="text-xs text-slate-500 mt-5">Verified against {proof.htsReleaseLabel || 'unavailable tariff reference data'}{proof.referenceDataAsOf ? ` · Reference data retrieved ${new Date(proof.referenceDataAsOf).toLocaleDateString()}` : ''}. Snapshot generated {new Date(proof.generatedAt).toLocaleString()}.</p><p className="text-xs text-slate-500 mt-2">This score describes the published review coverage; it is not a guarantee of customs clearance. Potential savings require broker review.</p></section>
 {proof.coverageStatus.warnings.map(w => <p key={w} role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{w}</p>)}
 {proof.lines.map(l => <LineProofCard key={l.lineNumber} line={l} filingId={proof.filingId}/>)}
 {proof.findings.length > 0 && <section className="rounded-2xl bg-white border border-slate-200 p-6"><h2 className="font-semibold mb-3">Entry findings</h2>{proof.findings.map((f, i) => <div key={f.findingId ?? i} className="py-3"><strong className="text-sm">{f.title}</strong><p className="text-sm text-slate-600">{f.whatItMeans}</p></div>)}</section>}
 <section className="rounded-2xl bg-white border border-slate-200 p-6"><h2 className="font-semibold mb-3">Questions</h2><AskAboutLine filingId={proof.filingId}/><p className="text-xs text-slate-500 mt-3">Your broker receives a tracked request. You can follow replies in Actions.</p></section></div>;
}
