'use client';
import { useEffect, useState } from 'react';
import { Copy, Mail } from 'lucide-react';
type Address = { address: string; purpose: string; clientId: string; client: { name: string } };
export function InboundAddressCard({ clientId, initialAddresses }: { clientId?: string; initialAddresses?: Address[] }) {
  const [addresses, setAddresses] = useState<Address[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [copied, setCopied] = useState('');
  useEffect(() => {
    if (initialAddresses) { setAddresses(initialAddresses); setLoading(false); return; }
    const controller = new AbortController(); setLoading(true); setAddresses([]); setError('');
    fetch(`/api/inbound-address${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ''}`, { signal: controller.signal, cache: 'no-store' }).then(async r => { if (!r.ok) throw new Error('Email address unavailable. Ask your broker for the correct address.'); return r.json(); }).then(d => { if (!controller.signal.aborted) setAddresses(d.addresses); }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [clientId, initialAddresses]);
  if (!loading && !error && !addresses.length) return null;
  return <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><Mail className="size-4 text-brand" />Send us documents</h2><p className="mt-2 text-xs leading-relaxed text-ink-muted">Forward invoices, packing lists, and bills of lading to the address for your company. Include the shipment number. Clear matches attach automatically; your broker reviews anything uncertain.</p>
    {loading && <p role="status" className="mt-3 text-xs text-ink-muted">Loading your address…</p>}{error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
    {addresses.map(a => <div key={a.address} className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-blue-50/60 p-3"><div className="min-w-0"><p className="text-xs font-semibold text-ink">{a.client.name}</p><p className="mt-1 select-all break-all text-sm text-brand">{a.address}</p></div><button className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-brand" onClick={async () => { try { await navigator.clipboard.writeText(a.address); setCopied(a.address); } catch { setError('Select the address above and copy it.'); } }} aria-label={`Copy email address for ${a.client.name}`}><Copy size={14} />{copied === a.address ? 'Copied' : 'Copy address'}</button></div>)}
  </section>;
}
