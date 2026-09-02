'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProofBadge } from '@/components/entry-proof/EntryProofView';
type Row = {
    filingId: string;
    entryNumber: string;
    shipmentNumber: string;
    publishedAt: string;
    scoreOverall: number;
    scoreBand: string;
    dutyAndFeesUsd: number;
    dutySavingsIdentifiedUsd: number;
    openQuestionCount: number;
};
export default function CompliancePage() {
    const [rows, setRows] = useState<Row[] | null>(null), [error, setError] = useState(''), [sort, setSort] = useState<'scoreOverall' | 'publishedAt' | 'dutySavingsIdentifiedUsd'>('publishedAt');
    useEffect(() => {
        fetch('/api/proofs').then(async (r) => {
            if (!r.ok)
                throw new Error('Could not load compliance proofs.');
            return r.json();
        }).then(setRows).catch(e => setError(e.message));
    }, []);
    return <div className="space-y-6"><div><p className="text-xs text-slate-500 uppercase tracking-widest">Compliance</p><h1 className="text-3xl font-bold mt-2">Proof behind every entry</h1><p className="text-sm text-slate-500 mt-2">Published entry reviews, duty savings, and the questions that need attention.</p></div>{error ? <p role="alert">{error}</p> : rows === null ? <p>Loading proofs…</p> : !rows.length ? <div className="rounded-2xl bg-white p-10 border border-slate-200"><h2 className="font-semibold">Your first Entry Proof will appear here</h2><p className="text-sm text-slate-500 mt-2">Once your broker publishes an entry review, you can inspect every line and ask questions.</p></div> : <><label className="text-sm">Sort by <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} className="rounded-lg border p-2 ml-2"><option value="publishedAt">Most recent</option><option value="scoreOverall">Lowest score</option><option value="dutySavingsIdentifiedUsd">Largest savings</option></select></label><div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr>{['Entry / shipment', 'Score', 'Duty and fees', 'Savings identified', 'Questions'].map(h => <th key={h} className="p-4 font-medium">{h}</th>)}</tr></thead><tbody>{[...rows].sort((a, b) => sort === 'publishedAt' ? b.publishedAt.localeCompare(a.publishedAt) : sort === 'scoreOverall' ? a[sort] - b[sort] : b[sort] - a[sort]).map(r => <tr key={r.filingId} className="border-t border-slate-100"><td className="p-4"><Link className="text-[#0071E3] font-semibold" href={`/entries/${r.filingId}`}>{r.entryNumber}</Link><p className="text-xs text-slate-500 mt-1">{r.shipmentNumber}</p></td><td className="p-4"><span className="font-semibold mr-2">{r.scoreOverall}</span><ProofBadge state={r.scoreBand}/></td><td className="p-4">${r.dutyAndFeesUsd.toLocaleString()}</td><td className="p-4">${r.dutySavingsIdentifiedUsd.toLocaleString()}</td><td className="p-4">{r.openQuestionCount}</td></tr>)}</tbody></table></div></>}</div>;
}
