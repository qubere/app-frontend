'use client';
import { useEffect, useState } from 'react';
import type { SetupSummary } from '@qubere/entry-proof';
import { ImporterSetupList } from '@/components/ImporterSetupList';
export default function SetupPage() {
    const [data, setData] = useState<SetupSummary | null>(null), [clients, setClients] = useState<{
        id: string;
        name: string;
    }[]>([]), [selected, setSelected] = useState(''), [loading, setLoading] = useState(true), [error, setError] = useState(''), [invite, setInvite] = useState(false), [sent, setSent] = useState(false), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError('');
        setData(null);
        fetch(`/api/setup${selected ? `?clientId=${encodeURIComponent(selected)}` : ''}`, { signal: controller.signal, cache: 'no-store' }).then(async (r) => {
            if (!r.ok) {
                if (r.status === 404 || r.status === 403)
                    throw new Error('This setup is not available to your login. Ask your service provider to check your access and client assignment.');
                if (r.status === 401)
                    throw new Error('Your session has expired. Sign in again to view your setup.');
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
    const section = 'rounded-2xl border border-slate-200 bg-white p-6';
    return <div className="space-y-6"><header><p className="text-xs uppercase tracking-widest text-slate-500">Your setup</p><h1 className="text-3xl font-bold mt-2">Ready for what’s next</h1><p className="text-sm text-slate-500 mt-2">Registration, signed documents, and the people supporting your imports.</p><button disabled={loading} onClick={() => setRetry(n => n + 1)} className="text-sm text-[#0071E3] mt-3 disabled:opacity-50">Refresh setup</button></header>{clients.length > 1 && <label className="text-sm">Client <select value={selected} onChange={e => setSelected(e.target.value)} className="border rounded-lg p-2 ml-2"><option value="">Choose a client</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}{error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{error}</p>{!data && <button onClick={() => setRetry(n => n + 1)} className="mt-3 font-medium underline">Try again</button>}</div>}{loading ? <p>Loading your setup…</p> : !data ? !error && <p>{clients.length ? 'Select a client to view their setup.' : 'No client setup is assigned to your login.'}</p> : <><section className={section}><div className="flex justify-between gap-3"><h2 className="text-lg font-semibold">{data.clientName}</h2><span className="text-sm rounded-full bg-blue-50 text-blue-800 px-3 py-1">{data.onboarding.status === 'not_started' ? 'No importers on file' : data.onboarding.status.replaceAll('_', ' ')}</span></div><ol className="grid gap-3 md:grid-cols-3 mt-5">{data.onboarding.steps.map(s => <li key={s.key} className={`rounded-xl p-3 text-sm ${s.state === 'done' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-600'}`}><span className="mr-2">{s.state === 'done' ? '✓' : s.state === 'waived' ? '—' : '○'}</span>{s.label}{s.state === 'waived' && <span className="ml-2 text-xs">Waived</span>}</li>)}</ol>{data.onboarding.blockers.map(b => <p key={b} className="text-sm text-amber-800 mt-3">{b}</p>)}</section>
 <ImporterSetupList importers={data.importers} />
 <section className={section}><h2 className="font-semibold">Your broker team</h2>{data.brokerTeam.length ? data.brokerTeam.map(b => <p key={b.email} className="text-sm mt-3">{b.name} · {b.role}<a href={`mailto:${b.email}`} className="block text-[#0071E3] mt-1">{b.email}</a></p>) : <p className="text-sm text-slate-500 mt-3">{data.brokerName} · Team assignment pending</p>}</section>
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
