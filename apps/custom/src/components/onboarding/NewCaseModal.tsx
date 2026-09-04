"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Check, UserRoundPlus } from "lucide-react";
import { Modal, ModalBody, ModalFooter, ModalHeader, Button, Input, Label } from "@/components/ui";
import { ClientPicker, type ClientOption } from "./ClientPicker";

const PATHS = [
  { value: "STANDARD", label: "New US importer", description: "Needs complete filing setup" },
  { value: "SWITCHING", label: "Switching brokers", description: "Has a CBP number and bond" },
  { value: "NON_RESIDENT", label: "Non-resident importer", description: "Needs a CBP-assigned number" },
] as const;

interface Props {
  onClose: () => void;
  initialClient?: ClientOption;
  lockClient?: boolean;
}

export function NewCaseModal({ onClose, initialClient, lockClient = false }: Props) {
  const router = useRouter();
  const [path, setPath] = useState<string>("STANDARD");
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [client, setClient] = useState<ClientOption | null>(initialClient ?? null);
  const [clientName, setClientName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    if (clientMode === "existing" ? !client : !clientName.trim()) {
      setError(clientMode === "existing" ? "Choose a client" : "Client name is required");
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
          ...(clientMode === "existing" ? { clientId: client!.id } : { newClient: { name: clientName.trim(), contactEmail: contactEmail.trim() || undefined } }),
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
      <ModalHeader
        titleId="new-case-modal-title"
        title="Onboard an importer"
        subtitle="Create the filing identity under the right client."
        icon={<UserRoundPlus className="h-4 w-4" />}
        onClose={onClose}
        closeDisabled={saving}
      />

      <form onSubmit={handleSubmit} className="contents">
        <ModalBody className="space-y-5 pr-1">
          {!lockClient && <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-ink">Where should this importer live?</legend>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: "existing", label: "Existing client", detail: "Add to a client portfolio", icon: Building2 },
                { value: "new", label: "New client", detail: "Create client and importer", icon: UserRoundPlus },
              ] as const).map((mode) => {
                const selected = clientMode === mode.value;
                const Icon = mode.icon;
                return (
                  <label
                    key={mode.value}
                    className={`relative cursor-pointer rounded-xl border p-3 transition-colors ${selected ? "border-brand bg-brand/5 ring-1 ring-brand/20" : "border-border hover:bg-surface-muted"}`}
                  >
                    <input
                      type="radio"
                      name="client-mode"
                      value={mode.value}
                      checked={selected}
                      onChange={() => {
                        setClientMode(mode.value);
                        setError(null);
                      }}
                      disabled={saving}
                      className="sr-only"
                    />
                    <span className="flex items-start gap-2.5">
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${selected ? "text-brand" : "text-ink-muted"}`} />
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-ink">{mode.label}</span>
                        <span className="mt-0.5 block text-[11px] leading-4 text-ink-muted">{mode.detail}</span>
                      </span>
                      {selected && <Check className="ml-auto h-4 w-4 shrink-0 text-brand" />}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>}

          {clientMode === "existing" ? (
            lockClient && initialClient ? (
              <div className="rounded-xl border border-brand/20 bg-brand/5 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Client</p>
                <p className="mt-1 text-sm font-bold text-ink">{initialClient.name}</p>
                <p className="mt-0.5 text-[11px] text-ink-muted">The importer will be added to this client portfolio.</p>
              </div>
            ) : (
              <ClientPicker value={client} onChange={(nextClient) => { setClient(nextClient); setError(null); }} disabled={saving} />
            )
          ) : (
            <div className="grid gap-4 rounded-xl border border-border bg-surface-muted/40 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="clientName">Client name *</Label>
                <Input
                  id="clientName"
                  placeholder="e.g. Northwind Trade Group"
                  value={clientName}
                  onChange={(event) => { setClientName(event.target.value); setError(null); }}
                  disabled={saving}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contactEmail">Primary contact email <span className="font-normal text-ink-muted">(optional)</span></Label>
                <Input
                  id="contactEmail"
                  type="email"
                  placeholder="operations@company.com"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
          )}

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-ink">What is the filing situation?</legend>
            <div className="space-y-2">
              {PATHS.map((option) => {
                const selected = path === option.value;
                return (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors ${selected ? "border-brand bg-brand/5 ring-1 ring-brand/20" : "border-border hover:bg-surface-muted"}`}
                  >
                    <input
                      type="radio"
                      name="path"
                      value={option.value}
                      checked={selected}
                      onChange={() => setPath(option.value)}
                      disabled={saving}
                      className="h-4 w-4 accent-brand"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-ink">{option.label}</span>
                      <span className="mt-0.5 block text-[11px] text-ink-muted">{option.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {error && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs font-medium text-red-700">
              {error}
            </div>
          )}
        </ModalBody>

        <ModalFooter className="border-t border-border pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Creating importer…" : <>Start onboarding <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></>}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
