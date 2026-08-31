"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Button, Input, Label } from "@/components/ui";

const PATHS = [
  { value: "STANDARD", label: "Standard", description: "Brand-new US importer, first time filing." },
  { value: "SWITCHING", label: "Switching brokers", description: "Importer has a CBP number and existing bond — we need POA." },
  { value: "NON_RESIDENT", label: "Non-resident", description: "Foreign entity, needs a CBP-assigned importer number." },
] as const;

interface Props {
  onClose: () => void;
}

export function NewCaseModal({ onClose }: Props) {
  const router = useRouter();
  const [path, setPath] = useState<string>("STANDARD");
  const [clientName, setClientName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!clientName.trim()) {
      setError("Client name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path,
          newClient: { name: clientName.trim(), contactEmail: contactEmail.trim() || undefined },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Failed to create case");
      router.push(`/app/onboarding/${data.case.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setSaving(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} closeDisabled={saving} titleId="new-case-modal-title">
      <h2 id="new-case-modal-title" className="text-lg font-semibold">Onboard an importer</h2>

      <div className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="clientName">Client name *</Label>
          <Input
            id="clientName"
            placeholder="Acme Corp"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="contactEmail">Contact email (optional)</Label>
          <Input
            id="contactEmail"
            type="email"
            placeholder="contact@example.com"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Onboarding path</Label>
          {PATHS.map((p) => (
            <label
              key={p.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                path === p.value ? "border-brand bg-brand/5" : "hover:bg-surface-muted"
              }`}
            >
              <input
                type="radio"
                name="path"
                value={p.value}
                checked={path === p.value}
                onChange={() => setPath(p.value)}
                className="mt-0.5"
              />
              <div>
                <div className="font-medium text-sm">{p.label}</div>
                <div className="text-xs text-ink-muted">{p.description}</div>
              </div>
            </label>
          ))}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? "Creating…" : "Start onboarding"}
        </Button>
      </div>
    </Modal>
  );
}
