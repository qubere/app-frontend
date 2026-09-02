'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { EntryProofPayload } from '@qubere/entry-proof';
import { EntryProofView } from '@/components/entry-proof/EntryProofView';
export default function EntryProofPage() {
    const { id } = useParams<{
        id: string;
    }>();
    const [proof, setProof] = useState<EntryProofPayload | null>(null), [error, setError] = useState('');
    useEffect(() => {
        let active = true;
        fetch(`/api/entries/${id}/proof`).then(async (r) => {
            if (!r.ok)
                throw new Error(r.status === 404 ? 'No published Entry Proof is available for this entry.' : 'Could not load Entry Proof.');
            return r.json();
        }).then(p => {
            if (active)
                setProof(p);
        }).catch(e => {
            if (active)
                setError(e.message);
        });
        return () => { active = false; };
    }, [id]);
    return <div className="space-y-5"><Link href="/compliance" className="text-sm text-[#0071E3]">← Compliance</Link>{error ? <p role="alert" className="rounded-xl bg-white p-8">{error}</p> : proof ? <EntryProofView proof={proof}/> : <p role="status">Loading Entry Proof…</p>}</div>;
}
