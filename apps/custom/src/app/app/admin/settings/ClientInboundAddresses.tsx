'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Copy, Mail, RefreshCw } from 'lucide-react';
type Address = { id: string; clientId: string | null; address: string; status: string; senderPolicy: string; autoReplyEnabled: boolean; activeKey: string | null; graceUntil: string | null; client: { name: string } | null; inboundEmails: { receivedAt: string }[] };
const button = 'inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-surface-muted disabled:opacity-40';
export function ClientInboundAddresses({ clientId }: { clientId?: string }) {
  const [addresses, setAddresses] = useState<Address[]>([]), [clients, setClients] = useState<{ id: string; name: string }[]>([]), [enabled, setEnabled] = useState(false), [loading, setLoading] = useState(true);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(''), [expanded, setExpanded] = useState(''), [confirmation, setConfirmation] = useState(''), [sender, setSender] = useState('');
  const [approvedSenders, setApprovedSenders] = useState<{ id: string; displaySenderEmail: string; clientId: string | null }[]>([]);

  const loadSenders = useCallback(async (targetClientId?: string | null) => {
    try {
      const url = targetClientId ? `/api/settings/inbound-senders?clientId=${encodeURIComponent(targetClientId)}` : '/api/settings/inbound-senders';
      const r = await fetch(url);
      if (r.ok) {
        const d = await r.json();
        setApprovedSenders(d.routes || []);
      }
    } catch {
      // ignore
    }
  }, []);

  const load = useCallback(async () => { try { const r = await fetch(`/api/settings/inbound-addresses${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ''}`); if (!r.ok) throw new Error('Could not load document addresses.'); const d = await r.json(); setEnabled(d.enabled); setAddresses(d.addresses); setClients(d.clients); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } }, [clientId]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (expanded) {
      const addr = addresses.find(a => a.id === expanded);
      void loadSenders(addr?.clientId);
    }
  }, [expanded, addresses, loadSenders]);

  async function removeSender(id: string, currentClientId?: string | null) {
    setBusy(id);
    try {
      const r = await fetch(`/api/settings/inbound-senders/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Could not remove approved sender.');
      setNotice('Sender removed.');
      await loadSenders(currentClientId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }

  async function mutate(id: string, action: string, fields: Record<string, unknown> = {}) {
    setBusy(id); setError('');
    try { const r = await fetch(`/api/settings/inbound-addresses${action === 'ISSUE' ? '' : `/${id}`}`, { method: action === 'ISSUE' ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action === 'ISSUE' ? fields : { action, ...fields }) }); if (!r.ok) throw new Error('Could not save the address. Check permissions and refresh.'); await load(); setConfirmation(''); setNotice(action === 'ROTATE' ? 'New address ready. The previous address forwards for 30 days.' : 'Document address updated.'); } catch (e) { setError((e as Error).message); } finally { setBusy(''); }
  }
  if (loading) return <p className="text-sm text-ink-muted">Loading document addresses…</p>;
  if (!enabled && !error) return null;
  const missing = clients.filter(c => !addresses.some(a => a.clientId === c.id && a.activeKey));
  return <section className="rounded-xl border border-border bg-surface p-5 space-y-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-semibold"><Mail size={19} className="text-brand" />Send documents by email</h2><p className="mt-1 text-sm text-ink-muted">Each address identifies a client. Uncertain matches wait for broker review.</p></div><Link className={`${button} text-brand`} href={`/app/documents/inbound-review${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ""}`}>Open email review →</Link></div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}{notice && <p role="status" className="text-sm text-blue-700">{notice}</p>}
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase tracking-wide text-ink-muted"><tr><th className="py-3 pr-4">Client / address</th><th className="pr-4">Status</th><th className="pr-4">Sender policy</th><th className="pr-4">Last received</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{addresses.map(a => <tr key={a.id} className="border-t border-border"><td className="py-3 pr-4"><p className="font-medium">{a.client?.name || 'Operations inbox'}</p><p className="mt-1 break-all text-xs text-ink-muted">{a.address}</p></td><td className="pr-4"><span className={`rounded-full px-2 py-1 text-xs ${a.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{a.graceUntil ? 'Forwarding · 30-day grace' : a.status === 'ACTIVE' ? 'Active' : 'Suspended'}</span></td><td className="pr-4">{a.senderPolicy === 'REVIEW' ? 'Review new senders' : a.senderPolicy === 'ALLOWLIST' ? 'Approved senders only' : 'Any sender'}</td><td className="pr-4 whitespace-nowrap text-ink-muted">{a.inboundEmails[0] ? new Date(a.inboundEmails[0].receivedAt).toLocaleDateString() : 'Not yet'}</td><td><div className="flex gap-2"><button className={button} aria-label={`Copy ${a.client?.name || 'operations'} address`} onClick={async () => { try { await navigator.clipboard.writeText(a.address); setNotice('Address copied.'); } catch { setError('Clipboard unavailable. Select and copy the address.'); } }}><Copy size={15} /></button>{a.activeKey && <button className={button} onClick={() => { setExpanded(expanded === a.id ? '' : a.id); setConfirmation(''); }}>Manage</button>}</div></td></tr>)}</tbody></table></div>
    {addresses.filter(a => a.id === expanded).map(a => <div key={a.id} className="rounded-lg border border-blue-200 bg-blue-50/30 p-4 space-y-3"><h3 className="font-medium">{a.client?.name || 'Operations inbox'}</h3><label className="block text-sm">Sender policy<select className="ml-3 rounded-lg border border-border bg-surface p-2" value={a.senderPolicy} disabled={!!busy} onChange={e => mutate(a.id, 'POLICY', { senderPolicy: e.target.value })}><option value="REVIEW">Review new senders</option><option value="ALLOWLIST">Approved senders only</option><option value="OPEN">Any sender</option></select></label><p className="text-xs text-ink-muted">Review: store clean documents for review. Approved only: hold unknown senders before download. Any sender: process clean documents; ambiguous matches still need review.</p><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={a.autoReplyEnabled} disabled={!!busy} onChange={e => mutate(a.id, 'POLICY', { autoReplyEnabled: e.target.checked })} />Send receipt confirmation when automatic replies are enabled</label>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2">Approved Senders for {a.client?.name || 'Operations'}</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {approvedSenders.length === 0 ? (
            <p className="text-xs text-ink-muted italic">No approved senders added yet for this client.</p>
          ) : (
            approvedSenders.map(s => (
              <span key={s.id} className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
                {s.displaySenderEmail}
                <button type="button" title="Remove approved sender" className="hover:text-emerald-950 font-bold ml-1" onClick={() => removeSender(s.id, a.clientId)}>×</button>
              </span>
            ))
          )}
        </div>
      </div>

      <form className="flex flex-wrap gap-2" onSubmit={async e => { e.preventDefault(); setBusy(a.id); setError(''); try { const r = await fetch('/api/settings/inbound-senders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: sender, clientId: a.clientId }) }); if (!r.ok) throw new Error('Could not approve sender. Check whether the sender is blocked.'); setSender(''); setNotice('Sender approved for this destination.'); await loadSenders(a.clientId); } catch (e) { setError((e as Error).message); } finally { setBusy(''); } }}><input type="email" required aria-label="Approved sender email" value={sender} onChange={e => setSender(e.target.value)} placeholder="sender@company.com" className="rounded-lg border border-border px-3 py-2 text-sm" /><button className={button} disabled={!!busy}>Add approved sender</button></form>
      <div className="flex flex-wrap gap-2"><button className={button} disabled={!!busy} onClick={() => setConfirmation('ROTATE')}><RefreshCw size={15} />Regenerate address…</button><button className={button} disabled={!!busy} onClick={() => a.status === 'ACTIVE' ? setConfirmation('SUSPEND') : mutate(a.id, 'RESUME')}>{a.status === 'ACTIVE' ? 'Suspend…' : 'Resume'}</button><button className={`${button} text-red-700`} disabled={!!busy} onClick={() => setConfirmation('REVOKE')}>Revoke…</button></div>
      {confirmation && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><p>{confirmation === 'ROTATE' ? 'Create a new address? The previous address will continue accepting documents for 30 days.' : confirmation === 'SUSPEND' ? 'Suspend this address? New emails will be rejected until you resume it.' : 'Permanently revoke this address? New emails to it will be rejected.'}</p><div className="mt-3 flex gap-2"><button className={button} disabled={!!busy} onClick={() => mutate(a.id, confirmation)}>Confirm</button><button className={button} disabled={!!busy} onClick={() => setConfirmation('')}>Cancel</button></div></div>}
    </div>)}
    {(!clientId && !addresses.some(a => !a.clientId && a.activeKey)) && <button className={button} disabled={!!busy} onClick={() => mutate('ops', 'ISSUE', { clientId: null })}>Create operations address</button>}
    {!!missing.length && <div className="flex flex-wrap items-center gap-2"><span className="text-sm text-ink-muted">Create address:</span>{missing.map(c => <button key={c.id} className={button} disabled={!!busy} onClick={() => mutate(c.id, 'ISSUE', { clientId: c.id })}>{c.name}</button>)}</div>}
  </section>;
}
