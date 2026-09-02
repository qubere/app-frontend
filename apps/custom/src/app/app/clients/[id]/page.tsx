'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
type Data = {
    id: string;
    name: string;
    clientStakeholders: {
        id: string;
        name: string;
        email: string;
        role: string;
        loginStatus: string;
    }[];
    clientDocuments: {
        id: string;
        title: string;
        kind: string;
        status: string;
    }[];
    onboardingCases: {
        status: string;
        currentStep: number;
    }[];
};
export default function ClientSetupPage() { const { id } = useParams<{
    id: string;
}>(); const [data, setData] = useState<Data | null>(null), [error, setError] = useState(''), [url, setUrl] = useState(''); useEffect(() => { fetch(`/api/broker/clients/${id}/setup`).then(async (r) => { if (!r.ok)
    throw new Error('Unable to load client setup'); return r.json(); }).then(setData).catch(e => setError(e.message)); }, [id]); return <div className="space-y-5"><Link href="/app/clients" className="text-brand text-sm">← Clients and Importers</Link><h1 className="text-2xl font-bold">{data?.name || 'Client'} · Portal & setup</h1>{error && <p role="alert" className="text-red-700">{error}</p>}{data && <><p className="text-sm text-ink-muted">Onboarding: {data.onboardingCases[0]?.status || 'Not started'} · Step {data.onboardingCases[0]?.currentStep || 1}</p><section className="rounded-xl border border-border p-5"><h2 className="font-semibold">Stakeholders</h2>{data.clientStakeholders.map(p => <div key={p.id} className="flex flex-wrap justify-between gap-3 border-b border-border py-3 text-sm"><div><strong>{p.name}</strong><p>{p.email} · {p.role}</p></div><span>{p.loginStatus}</span><button className="text-brand" onClick={async () => { setError(''); const r = await fetch('/api/broker/portal-invitations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: id, email: p.email, roleName: p.role === 'IMPORTER_ADMIN' ? 'CUSTOMER_ADMIN' : p.role === 'VIEWER' ? 'CUSTOMER_VIEWER' : 'CUSTOMER_USER' }) }); const d = await r.json(); if (!r.ok)
    setError(d.error || 'Invitation failed');
else
    setUrl(d.inviteUrl); }}>Create invitation</button></div>)}{url && <p role="status" className="mt-3 text-sm break-all">Invitation ready: <a href={url} className="text-brand">{url}</a></p>}</section><section className="rounded-xl border border-border p-5"><h2 className="font-semibold">Documents on file</h2>{data.clientDocuments.length ? data.clientDocuments.map(d => <p key={d.id} className="text-sm py-3 border-b border-border">{d.title} · {d.status}</p>) : <p className="text-sm text-ink-muted mt-3">No promoted documents yet.</p>}</section></>}</div>; }
