'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MailCheck } from 'lucide-react';
export function InboundReceipts() {
  const [items, setItems] = useState<{ id: string; type: string; message: string }[]>([]);
  useEffect(() => { const controller = new AbortController(); fetch('/api/notifications', { signal: controller.signal }).then(r => r.ok ? r.json() : []).then(d => { if (Array.isArray(d)) setItems(d.filter(n => n.type === 'INBOUND_EMAIL_RECEIVED').slice(0, 3)); }).catch(() => {}); return () => controller.abort(); }, []);
  if (!items.length) return null;
  return <section aria-label="Documents received by email" className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4"><h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><MailCheck size={16} className="text-brand" />Documents received</h2>{items.map(i => <p key={i.id} className="mt-2 text-xs text-ink-muted">{i.message}</p>)}<Link href="/documents" className="mt-3 inline-block text-xs font-semibold text-brand">View documents →</Link></section>;
}
