"use client";

import { useEffect, useState } from "react";
import { Combobox, type ComboboxOption } from "@/components/ui";

export type ClientOption = { id: string; name: string; contactEmail?: string | null };

export function ClientPicker({ value, onChange, disabled = false }: {
  value: ClientOption | null;
  onChange: (client: ClientOption | null) => void;
  disabled?: boolean;
}) {
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
  const options = value && !clients.some((client) => client.id === value.id) ? [value, ...clients] : clients;
  const comboboxValue = value ? toComboboxOption(value) : null;

  return (
    <div className="space-y-1.5">
      <Combobox
        label="Client"
        value={comboboxValue}
        options={options.map(toComboboxOption)}
        onChange={(option) => onChange(option ? options.find((client) => client.id === option.id) ?? null : null)}
        onQueryChange={setQuery}
        placeholder="Search by client name or email"
        emptyMessage="No clients match this search"
        loading={loading}
        disabled={disabled}
        error={error}
        required
      />
      {clients.length === 50 && (
        <p className="text-xs text-ink-muted">Showing 50 matches. Type more to narrow the list.</p>
      )}
    </div>
  );
}

function toComboboxOption(client: ClientOption): ComboboxOption {
  return {
    id: client.id,
    label: client.name,
    description: client.contactEmail,
  };
}
