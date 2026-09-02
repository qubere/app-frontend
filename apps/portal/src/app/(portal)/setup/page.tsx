'use client';
import { useEffect, useState } from 'react';
import type { SetupSummary } from '@qubere/entry-proof';
export default function SetupPage() {
    const [data, setData] = useState<SetupSummary | null>(null), [clients, setClients] = useState<{
        id: string;
        name: string;
    }[]>([]), [selected, setSelected] = useState(''), [loading, setLoading] = useState(true), [error, setError] = useState(''), [invite, setInvite] = useState(false), [sent, setSent] = useState(false), [busy, setBusy] = useState(false);
    useEffect(() => {
        setLoading(true);
        setError('');
        fetch(`/api/setup${selected ? `?clientId=${encodeURIComponent(selected)}` : ''}`).then(async (r) => {
            if (!r.ok)
                throw new Error('Could not load your setup.');
            return r.json();
        }).then(d => { setClients(d.clients ?? []); setData(d.selectClient ? null : d); }).catch(e => setError(e.message)).finally(() => setLoading(false));
    }, [selected]);
    const section = 'rounded-2xl border border-slate-200 bg-white p-6';
    const field = (label: string, value: string | null | undefined) => <div className="py-2"><dt className="text-xs text-slate-500">{label}</dt><dd className="text-sm mt-1">{value || 'Not on file'}</dd></div>;
    return <div className="space-y-6"><header><p className="text-xs uppercase tracking-widest text-slate-500">Your setup</p><h1 className="text-3xl font-bold mt-2">Ready for what’s next</h1><p className="text-sm text-slate-500 mt-2">Registration, signed documents, and the people supporting your imports.</p></header>{clients.length > 1 && <label className="text-sm">Client <select value={selected} onChange={e => setSelected(e.target.value)} className="border rounded-lg p-2 ml-2"><option value="">Choose a client</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}{error && <p role="alert" className="text-red-700">{error}</p>}{loading ? <p>Loading your setup…</p> : !data ? <p>{clients.length ? 'Select a client to view their setup.' : 'No client setup is assigned to your login.'}</p> : <><section className={section}><div className="flex justify-between gap-3"><h2 className="text-lg font-semibold">{data.clientName}</h2><span className="text-sm rounded-full bg-blue-50 text-blue-800 px-3 py-1">{data.onboarding.status.replaceAll('_', ' ')}</span></div><ol className="grid gap-3 md:grid-cols-3 mt-5">{data.onboarding.steps.map(s => <li key={s.key} className={`rounded-xl p-3 text-sm ${s.state === 'done' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-600'}`}><span className="mr-2">{s.state === 'done' ? '✓' : '○'}</span>{s.label}</li>)}</ol>{data.onboarding.blockers.map(b => <p key={b} className="text-sm text-amber-800 mt-3">{b}</p>)}</section>
 <div className="grid gap-5 lg:grid-cols-2"><section className={section}><h2 className="font-semibold">Importer of record</h2><dl>{field('Legal name', data.importer?.legalName)}{field('EIN', data.importer?.ein)}{field('CBP importer number', data.importer?.cbpImporterNumber)}{field('Registration', data.importer?.registrationStatus)}</dl></section><section className={section}><h2 className="font-semibold">Customs bond</h2><dl>{field('Status', data.bond?.status)}{field('Surety', data.bond?.surety)}{field('Bond number', data.bond?.number)}{field('Type / amount', data.bond ? `${data.bond.type} · $${data.bond.amountUsd.toLocaleString()}` : null)}{field('Expiration', data.bond?.expirationDate ? new Date(data.bond.expirationDate).toLocaleDateString() : null)}</dl>{data.bond?.expirationDate && new Date(data.bond.expirationDate).getTime() - Date.now() < 90 * 86400000 && <p className="text-sm text-amber-800 mt-2">This bond expires within 90 days or has expired. Contact your broker.</p>}</section><section className={section}><h2 className="font-semibold">Power of Attorney</h2><dl>{field('Status', data.poa?.status)}{field('Signer', data.poa?.signerName)}{field('Execution method', data.poa?.executionMethod)}{field('Signed date', data.poa?.signedDate ? new Date(data.poa.signedDate).toLocaleDateString() : null)}</dl>{data.poa?.documentId && <a className="text-sm text-[#0071E3]" href={`/api/setup/documents/${data.poa.documentId}/download`}>View signed POA →</a>}</section><section className={section}><h2 className="font-semibold">Screening</h2><p className="text-sm mt-4">{data.screening.status}</p><p className="text-xs text-slate-500 mt-2">Your broker can answer questions about the screening disposition.</p><h2 className="font-semibold mt-7">Your broker team</h2>{data.brokerTeam.length ? data.brokerTeam.map(b => <p key={b.email} className="text-sm mt-3">{b.name} · {b.role}<a href={`mailto:${b.email}`} className="block text-[#0071E3] mt-1">{b.email}</a></p>) : <p className="text-sm text-slate-500 mt-3">{data.brokerName} · Team assignment pending</p>}</section></div>
 <section className={section}><h2 className="font-semibold">Documents on file</h2>{data.documents.length ? <ul className="divide-y divide-slate-100 mt-3">{data.documents.map(d => <li key={d.id} className="py-3 flex justify-between gap-3 text-sm"><span>{d.title}</span><a className="text-[#0071E3]" href={`/api/setup/documents/${d.id}/download`}>Download</a></li>)}</ul> : <p className="text-sm text-slate-500 mt-3">Signed and accepted documents will appear here when available.</p>}</section>
 <section className={section}><div className="flex justify-between gap-3"><h2 className="font-semibold">People</h2><button onClick={() => setInvite(!invite)} className="text-sm text-[#0071E3]">Request access for someone</button></div><div className="overflow-x-auto"><table className="w-full text-sm text-left mt-4"><thead><tr>{['Name', 'Role', 'Signer', 'Login'].map(h => <th className="py-3 font-medium text-slate-500" key={h}>{h}</th>)}</tr></thead><tbody>{data.stakeholders.map((p, i) => <tr key={i} className="border-t border-slate-100"><td className="py-3">{p.name}{p.title && <span className="block text-xs text-slate-500">{p.title}</span>}</td><td>{p.role.replaceAll('_', ' ')}</td><td>{p.isSigner ? 'Yes' : '—'}</td><td><span className="text-xs rounded-full px-2 py-1 bg-slate-100">{p.loginStatus.replaceAll('_', ' ')}</span></td></tr>)}</tbody></table></div>{sent ? <p role="status" className="text-sm text-emerald-800 mt-3">Access request sent to your broker.</p> : invite && <form className="grid gap-3 mt-5 md:grid-cols-2" onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    setError('');
                    const f = new FormData(e.currentTarget);
                    try {
                        const r = await fetch('/api/setup/stakeholders/invite-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: data.clientId, name: f.get('name'), email: f.get('email'), role: f.get('role') }) });
                        if (!r.ok)
                            throw new Error(r.status === 404 ? 'Your role cannot request portal access. Ask your administrator.' : 'Access request failed.');
                        setSent(true);
                    }
                    catch (e) {
                        setError(e instanceof Error ? e.message : 'Request failed');
                    }
                    finally {
                        setBusy(false);
                    }
                }}><label className="text-sm">Name<input required name="name" className="block w-full border rounded-lg p-2 mt-1"/></label><label className="text-sm">Email<input required type="email" name="email" className="block w-full border rounded-lg p-2 mt-1"/></label><label className="text-sm">Role<select name="role" className="block w-full border rounded-lg p-2 mt-1">{['VIEWER', 'CUSTOMS_CONTACT', 'BILLING_CONTACT', 'OFFICER_SIGNER', 'SUPPLIER_CONTACT', 'IMPORTER_ADMIN'].map(r => <option key={r}>{r}</option>)}</select></label><div className="self-end"><button disabled={busy} className="bg-[#0071E3] text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50">{busy ? 'Sending…' : 'Request access'}</button></div></form>}</section></>}</div>;
}
