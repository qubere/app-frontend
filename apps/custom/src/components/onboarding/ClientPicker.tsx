"use client";

import { useEffect, useId, useState } from "react";

export type ClientOption = { id: string; name: string; contactEmail?: string | null };

export function ClientPicker({ value, onChange, disabled = false }: {
  value: ClientOption | null;
  onChange: (client: ClientOption | null) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        setError("");
        const response = await fetch(`/api/onboarding/clients?q=${encodeURIComponent(query)}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Could not load clients. Try searching again.");
        const data = await response.json();
        if (!controller.signal.aborted) setClients(data.clients);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Could not load clients.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);
  const options = value && !clients.some(c => c.id === value.id) ? [value, ...clients] : clients;
  return <div className="space-y-2">
    <label className="block text-sm" htmlFor={`${id}-search`}>Find an existing client</label>
    <input id={`${id}-search`} className="w-full rounded-lg border p-2 text-sm" placeholder="Search by client name" value={query} onChange={e => setQuery(e.target.value)} disabled={disabled} />
    <label className="block text-sm" htmlFor={`${id}-select`}>Client</label>
    <select id={`${id}-select`} className="w-full rounded-lg border p-2 text-sm" value={value?.id ?? ""} onChange={e => onChange(options.find(c => c.id === e.target.value) ?? null)} disabled={disabled || loading}>
      <option value="">{loading ? "Loading clients…" : "Choose a client"}</option>
      {options.map(c => <option key={c.id} value={c.id}>{c.name}{c.contactEmail ? ` · ${c.contactEmail}` : ""}</option>)}
    </select>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {!loading && !error && clients.length === 0 && <p className="text-sm text-ink-muted">No clients match this search.</p>}
    {clients.length === 50 && <p className="text-xs text-ink-muted">Showing the first 50 matches. Narrow your search if needed.</p>}
  </div>;
}
