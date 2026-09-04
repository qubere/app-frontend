'use client';
import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import Link from 'next/link';
type Item = {
    id: string;
    type: string;
    message: string;
    read: boolean;
};
export function PortalNotifications() { const [items, setItems] = useState<Item[]>([]), [open, setOpen] = useState(false); useEffect(() => { fetch('/api/notifications').then(r => r.ok ? r.json() : []).then(setItems).catch(() => { }); }, []); const unread = items.filter(n => !n.read).length; return <div className="relative"><button aria-label={`Notifications, ${unread} unread`} aria-expanded={open} onClick={() => setOpen(!open)} className="p-2"><Bell className="w-4 h-4"/>{unread > 0 && <span className="absolute -top-1 -right-1 text-xs bg-red-600 text-white rounded-full px-1">{unread}</span>}</button>{open && <div className="absolute right-0 top-10 w-80 max-h-96 overflow-auto rounded-xl border bg-white shadow-lg z-50 p-3"><h2 className="font-semibold text-sm p-2">Notifications</h2>{!items.length ? <p className="text-sm text-slate-500 p-2">You’re up to date.</p> : items.map(n => <Link key={n.id} href={n.type === 'INBOUND_EMAIL_RECEIVED' ? '/documents' : n.type === 'ENTRY_PROOF_PUBLISHED' ? '/compliance' : n.type === 'INVOICE_ISSUED' ? '/invoices' : ['POA_SIGNED', 'FORM_5106_ACCEPTED', 'ACCOUNT_ACTIVATED'].includes(n.type) ? '/setup' : '/shipments'} className={`block rounded-lg p-3 text-sm ${n.read ? 'text-slate-500' : 'bg-blue-50'}`} onClick={() => { fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: n.id }) }); setItems(items.map(i => i.id === n.id ? { ...i, read: true } : i)); setOpen(false); }}>{n.message}</Link>)}</div>}</div>; }
