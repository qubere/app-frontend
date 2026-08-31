"use client";

import { useState } from "react";
import { Button, Input, Label, Card, CardHeader } from "@/components/ui";

interface Props {
  caseId: string;
  client: { id: string; name: string; contactEmail?: string | null } | null;
  stepStatus: Record<string, unknown>;
  onSaved: () => void;
}

export function StepBilling({ caseId, client, stepStatus, onSaved }: Props) {
  const alreadyDone = stepStatus["step_6"] === "done";
  const [paymentTermsDays, setPaymentTermsDays] = useState<number>(30);
  const [billingContact, setBillingContact] = useState(client?.contactEmail ?? "");
  const [creditHold, setCreditHold] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (client) {
        await fetch(`/api/clients/${client.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentTermsDays, billingContactEmail: billingContact || undefined }),
        });
      }

      const res = await fetch(`/api/onboarding/cases/${caseId}/steps/6`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done", data: { paymentTermsDays, billingContact, creditHold } }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? "Failed to save");
      }
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Billing &amp; access</h2>
        <p className="text-sm text-ink-muted mt-1">
          Configure payment terms and optionally invite the importer to the customer portal.
        </p>
      </div>

      {alreadyDone && (
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          This step is already complete. You can update values below and re-save.
        </div>
      )}

      <Card>
        <CardHeader>Billing configuration</CardHeader>
        <div className="px-6 pb-6 space-y-4">
          <div className="space-y-1">
            <Label htmlFor="paymentTerms">Payment terms (days net)</Label>
            <Input
              id="paymentTerms"
              type="number"
              min={0}
              max={365}
              value={paymentTermsDays}
              onChange={(e) => setPaymentTermsDays(parseInt(e.target.value) || 30)}
              className="w-40"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="billingContact">Billing contact email</Label>
            <Input
              id="billingContact"
              type="email"
              placeholder="billing@importer.com"
              value={billingContact}
              onChange={(e) => setBillingContact(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="creditHold"
              checked={creditHold}
              onChange={(e) => setCreditHold(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="creditHold" className="cursor-pointer">
              Place on credit hold (blocks new shipments until removed)
            </Label>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>Customer portal access</CardHeader>
        <div className="px-6 pb-6 space-y-3">
          <p className="text-sm text-ink-muted">
            Invite the importer to the customer portal so they can track shipments and submit documents.
            You can invite them later from their client profile.
          </p>
          <Button variant="secondary" size="sm" disabled>
            Send portal invitation (configure after activation)
          </Button>
        </div>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save & continue to review"}
        </Button>
      </div>
    </div>
  );
}
