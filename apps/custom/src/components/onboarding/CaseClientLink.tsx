"use client";

import { useState } from 'react';
import { ClientPicker, type ClientOption } from './ClientPicker';
import { Button } from '@/components/ui';

export function CaseClientLink({ caseId, client, onSaved }: { caseId: string; client: ClientOption | null; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(client);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  return <section className="border-b px-6 py-3 bg-white text-sm">
    <div className="flex items-center gap-3"><span>Portal client: <strong>{client?.name ?? 'Not linked'}</strong></span><button className="text-brand hover:underline" onClick={() => { setSelected(client); setOpen(!open); }} disabled={busy}>Update client link</button></div>
    {message && <p role="status" className="mt-2 text-emerald-700">{message}</p>}
    {open && <div className="max-w-lg mt-4 space-y-3">
      <p className="text-ink-muted">Choose the client assigned to the customer’s portal login. This publishes the case’s completed setup and signed documents to that client.</p>
      <ClientPicker value={selected} onChange={setSelected} disabled={busy} />
      {selected && <p>Save this setup under <strong>{selected.name}</strong>{selected.contactEmail ? ` (${selected.contactEmail})` : ''}.</p>}
      {error && <p role="alert" className="text-red-600">{error}</p>}
      <div className="flex gap-2"><Button disabled={!selected || busy} onClick={async () => {
        if (!selected) return;
        setBusy(true); setError(''); setMessage('');
        try {
          const res = await fetch(`/api/onboarding/cases/${caseId}/client`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: selected.id }) });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error?.message ?? 'Could not update the client link.');
          await onSaved(); setOpen(false); setMessage(`Setup published to ${selected.name}. Refresh Your setup in the portal.`);
        } catch (e) { setError(e instanceof Error ? e.message : 'Could not update the client link.'); }
        finally { setBusy(false); }
      }}>{busy ? 'Saving…' : 'Save client link'}</Button><Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button></div>
    </div>}
  </section>;
}
