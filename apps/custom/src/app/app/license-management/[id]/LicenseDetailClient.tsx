"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Upload, RefreshCw, XCircle } from "lucide-react";
import { Card, CardHeader, CardHeaderIcon, Button, Badge, Input, Select, Label, FormField, Modal } from "@/components/ui";
import { ShieldCheck } from "lucide-react";

interface LicenseLine {
  id: string;
  lineNumber: number;
  classificationType: string | null;
  classificationNumber: string | null;
  licensedQuantity: string | null;
  licensedValue: string | null;
  committedQuantity: string;
  committedValue: string;
  shippedQuantity: string;
  shippedValue: string;
  adjustedQuantity: string;
  adjustedValue: string;
}
interface LicenseParty {
  id: string;
  role: string;
  party: { id: string; name: string };
}
interface LicenseDocument {
  id: string;
  documentType: string;
  fileName: string;
  verified: boolean;
}
interface LicenseNote {
  id: string;
  content: string;
  createdAt: string;
}
interface LicenseDetail {
  id: string;
  licenseNumber: string;
  licenseType: string;
  agency: string | null;
  jurisdiction: string | null;
  status: string;
  effectiveDate: string;
  expirationDate: string | null;
  description: string | null;
  lines: LicenseLine[];
  parties: LicenseParty[];
  documents: LicenseDocument[];
  licenseNotes: LicenseNote[];
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: init?.body instanceof FormData ? init.headers : { "Content-Type": "application/json", ...init?.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message ?? body?.error ?? `Request failed (${res.status})`);
  return body as T;
}

function remaining(licensed: string | null, committed: string, shipped: string, adjusted: string): string | null {
  if (licensed == null) return null;
  const remainder = Number(licensed) - Number(committed) - Number(shipped) + Number(adjusted);
  return remainder.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function LicenseDetailClient({
  licenseId,
  canUpdate,
  canClose,
  canPostEvents,
  canAdjust,
  canAllocate,
  canManageDocuments,
  canManageParties,
}: {
  licenseId: string;
  canUpdate: boolean;
  canClose: boolean;
  canPostEvents: boolean;
  canAdjust: boolean;
  canAllocate: boolean;
  canManageDocuments: boolean;
  canManageParties: boolean;
}) {
  const [license, setLicense] = useState<LicenseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lineModalOpen, setLineModalOpen] = useState(false);
  const [eventModal, setEventModal] = useState<{ lineId: string } | null>(null);
  const [adjustmentModal, setAdjustmentModal] = useState<{ lineId: string } | null>(null);
  const [allocationModal, setAllocationModal] = useState<{ lineId: string } | null>(null);
  const [partyModalOpen, setPartyModalOpen] = useState(false);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newLine, setNewLine] = useState({ lineNumber: "", classificationType: "ECCN", classificationNumber: "", licensedQuantity: "", licensedValue: "" });
  const [eventForm, setEventForm] = useState({ eventType: "SHIPMENT", quantityDelta: "", valueDelta: "", reason: "" });
  const [adjustmentForm, setAdjustmentForm] = useState({ adjustmentType: "CORRECTION", quantityDelta: "", valueDelta: "", reason: "" });
  const [allocationForm, setAllocationForm] = useState({ quantity: "", value: "", shipmentId: "" });
  const [partyForm, setPartyForm] = useState({ partyId: "", role: "END_USER" });
  const [documentForm, setDocumentForm] = useState({ documentType: "AUTHORIZATION" });
  const [closeReason, setCloseReason] = useState("");

  const load = () => {
    fetchJson<{ license: LicenseDetail }>(`/api/compliance/licenses/${licenseId}`)
      .then((data) => setLicense(data.license))
      .catch((err) => setError(err.message));
  };

  useEffect(load, [licenseId]);

  const addLine = async () => {
    setBusy(true);
    setError(null);
    try {
      await fetchJson(`/api/compliance/licenses/${licenseId}/lines`, {
        method: "POST",
        body: JSON.stringify({
          ...newLine,
          lineNumber: Number(newLine.lineNumber),
          licensedQuantity: newLine.licensedQuantity || undefined,
          licensedValue: newLine.licensedValue || undefined,
        }),
      });
      setLineModalOpen(false);
      setNewLine({ lineNumber: "", classificationType: "ECCN", classificationNumber: "", licensedQuantity: "", licensedValue: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add line.");
    } finally {
      setBusy(false);
    }
  };

  const postEvent = async () => {
    if (!eventModal) return;
    setBusy(true);
    setError(null);
    try {
      await fetchJson(`/api/compliance/license-lines/${eventModal.lineId}/events`, {
        method: "POST",
        body: JSON.stringify(eventForm),
      });
      setEventModal(null);
      setEventForm({ eventType: "SHIPMENT", quantityDelta: "", valueDelta: "", reason: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post event.");
    } finally {
      setBusy(false);
    }
  };

  const postAdjustment = async () => {
    if (!adjustmentModal) return;
    setBusy(true);
    setError(null);
    try {
      await fetchJson(`/api/compliance/license-lines/${adjustmentModal.lineId}/adjustments`, {
        method: "POST",
        body: JSON.stringify(adjustmentForm),
      });
      setAdjustmentModal(null);
      setAdjustmentForm({ adjustmentType: "CORRECTION", quantityDelta: "", valueDelta: "", reason: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post adjustment.");
    } finally {
      setBusy(false);
    }
  };

  const reserveAllocation = async () => {
    if (!allocationModal) return;
    setBusy(true);
    setError(null);
    try {
      await fetchJson(`/api/compliance/license-lines/${allocationModal.lineId}/allocate`, {
        method: "POST",
        body: JSON.stringify({
          quantity: allocationForm.quantity || undefined,
          value: allocationForm.value || undefined,
          shipmentId: allocationForm.shipmentId || undefined,
        }),
      });
      setAllocationModal(null);
      setAllocationForm({ quantity: "", value: "", shipmentId: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reserve allocation.");
    } finally {
      setBusy(false);
    }
  };

  const attachParty = async () => {
    setBusy(true);
    setError(null);
    try {
      await fetchJson(`/api/compliance/licenses/${licenseId}/parties`, {
        method: "POST",
        body: JSON.stringify(partyForm),
      });
      setPartyModalOpen(false);
      setPartyForm({ partyId: "", role: "END_USER" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to attach party.");
    } finally {
      setBusy(false);
    }
  };

  const uploadDocument = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("documentType", documentForm.documentType);
      await fetchJson(`/api/compliance/licenses/${licenseId}/documents`, { method: "POST", body });
      setDocumentModalOpen(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload document.");
    } finally {
      setBusy(false);
    }
  };

  const closeLicense = async () => {
    setBusy(true);
    setError(null);
    try {
      await fetchJson(`/api/compliance/licenses/${licenseId}`, {
        method: "DELETE",
        body: JSON.stringify({ reason: closeReason || undefined }),
      });
      setCloseConfirmOpen(false);
      setCloseReason("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close license.");
    } finally {
      setBusy(false);
    }
  };

  if (!license) {
    return (
      <Card>
        {error ? <p className="text-sm text-red-700">{error}</p> : <p className="text-sm text-ink-muted">Loading license…</p>}
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/app/license-management" className="inline-flex items-center gap-1 text-sm text-brand hover:underline">
        <ArrowLeft className="w-4 h-4" /> Back to License Management
      </Link>

      <Card>
        <CardHeader>
          <CardHeaderIcon>
            <ShieldCheck className="w-5 h-5" />
          </CardHeaderIcon>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-ink">{license.licenseNumber}</h1>
            <p className="text-sm text-ink-muted">
              {license.licenseType} {license.agency ? `· ${license.agency}` : ""} {license.jurisdiction ? `· ${license.jurisdiction}` : ""}
            </p>
          </div>
          <Badge variant={license.status === "ACTIVE" ? "success" : license.status === "DRAFT" ? "neutral" : "warning"}>{license.status}</Badge>
          {canClose && license.status !== "CLOSED" && (
            <Button variant="secondary" size="sm" onClick={() => setCloseConfirmOpen(true)}>
              <XCircle className="w-4 h-4" /> Close License
            </Button>
          )}
        </CardHeader>

        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-6">
          <div>
            <div className="text-xs text-ink-muted">Effective</div>
            <div>{new Date(license.effectiveDate).toLocaleDateString()}</div>
          </div>
          <div>
            <div className="text-xs text-ink-muted">Expires</div>
            <div>{license.expirationDate ? new Date(license.expirationDate).toLocaleDateString() : "—"}</div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-ink">Licensed Lines</h2>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={load}>
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
            {canUpdate && (
              <Button size="sm" onClick={() => setLineModalOpen(true)}>
                <Plus className="w-4 h-4" /> Add Line
              </Button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-ink-muted border-b border-border">
                <th className="py-2 pr-4">Line</th>
                <th className="py-2 pr-4">Classification</th>
                <th className="py-2 pr-4">Licensed Qty</th>
                <th className="py-2 pr-4">Remaining Qty</th>
                <th className="py-2 pr-4">Licensed Value</th>
                <th className="py-2 pr-4">Remaining Value</th>
                {(canPostEvents || canAdjust || canAllocate) && <th className="py-2 pr-4">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {license.lines.map((line) => (
                <tr key={line.id} className="border-b border-border/60">
                  <td className="py-2 pr-4">{line.lineNumber}</td>
                  <td className="py-2 pr-4">
                    {line.classificationType ? `${line.classificationType}: ${line.classificationNumber ?? ""}` : "—"}
                  </td>
                  <td className="py-2 pr-4">{line.licensedQuantity ?? "—"}</td>
                  <td className="py-2 pr-4">{remaining(line.licensedQuantity, line.committedQuantity, line.shippedQuantity, line.adjustedQuantity) ?? "—"}</td>
                  <td className="py-2 pr-4">{line.licensedValue ?? "—"}</td>
                  <td className="py-2 pr-4">{remaining(line.licensedValue, line.committedValue, line.shippedValue, line.adjustedValue) ?? "—"}</td>
                  {(canPostEvents || canAdjust || canAllocate) && (
                    <td className="py-2 pr-4 space-x-2">
                      {canPostEvents && (
                        <Button variant="secondary" size="sm" onClick={() => setEventModal({ lineId: line.id })}>
                          Post Event
                        </Button>
                      )}
                      {canAdjust && (
                        <Button variant="secondary" size="sm" onClick={() => setAdjustmentModal({ lineId: line.id })}>
                          Adjust
                        </Button>
                      )}
                      {canAllocate && (
                        <Button variant="secondary" size="sm" onClick={() => setAllocationModal({ lineId: line.id })}>
                          Allocate
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {license.lines.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-ink-muted">
                    No licensed lines yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-ink">Parties</h2>
              {canManageParties && (
                <Button variant="secondary" size="sm" onClick={() => setPartyModalOpen(true)}>
                  <Plus className="w-4 h-4" /> Attach Party
                </Button>
              )}
            </div>
            <ul className="text-sm space-y-1">
              {license.parties.map((p) => (
                <li key={p.id}>
                  {p.party.name} <span className="text-ink-muted">({p.role})</span>
                </li>
              ))}
              {license.parties.length === 0 && <li className="text-ink-muted">No parties attached.</li>}
            </ul>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-ink">Documents</h2>
              {canManageDocuments && (
                <Button variant="secondary" size="sm" onClick={() => setDocumentModalOpen(true)}>
                  <Upload className="w-4 h-4" /> Upload
                </Button>
              )}
            </div>
            <ul className="text-sm space-y-1">
              {license.documents.map((d) => (
                <li key={d.id}>
                  {d.fileName} <span className="text-ink-muted">({d.documentType})</span>
                </li>
              ))}
              {license.documents.length === 0 && <li className="text-ink-muted">No documents uploaded.</li>}
            </ul>
          </div>
        </div>
      </Card>

      <Modal isOpen={lineModalOpen} onClose={() => setLineModalOpen(false)}>
        <h2 id="modal-title" className="text-lg font-bold text-ink">
          Add Licensed Line
        </h2>
        <div className="space-y-3">
          <FormField>
            <Label>Line Number</Label>
            <Input type="number" value={newLine.lineNumber} onChange={(e) => setNewLine((f) => ({ ...f, lineNumber: e.target.value }))} />
          </FormField>
          <FormField>
            <Label>Classification Type</Label>
            <Select value={newLine.classificationType} onChange={(e) => setNewLine((f) => ({ ...f, classificationType: e.target.value }))}>
              {["ECCN", "USML", "HTS", "SCHEDULE_B", "ICN"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField>
            <Label>Classification Number</Label>
            <Input value={newLine.classificationNumber} onChange={(e) => setNewLine((f) => ({ ...f, classificationNumber: e.target.value }))} />
          </FormField>
          <FormField>
            <Label>Licensed Quantity</Label>
            <Input value={newLine.licensedQuantity} onChange={(e) => setNewLine((f) => ({ ...f, licensedQuantity: e.target.value }))} />
          </FormField>
          <FormField>
            <Label>Licensed Value</Label>
            <Input value={newLine.licensedValue} onChange={(e) => setNewLine((f) => ({ ...f, licensedValue: e.target.value }))} />
          </FormField>
          <Button onClick={addLine} disabled={busy || !newLine.lineNumber}>
            Add Line
          </Button>
        </div>
      </Modal>

      <Modal isOpen={!!eventModal} onClose={() => setEventModal(null)}>
        <h2 id="modal-title" className="text-lg font-bold text-ink">
          Post Utilization Event
        </h2>
        <div className="space-y-3">
          <FormField>
            <Label>Event Type</Label>
            <Select value={eventForm.eventType} onChange={(e) => setEventForm((f) => ({ ...f, eventType: e.target.value }))}>
              {["ORDER_COMMITMENT", "SHIPMENT", "ASSIGNMENT", "RELEASE", "REVERSAL", "RENEWAL", "EXPIRATION", "UPDATE", "OPENING_BALANCE"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField>
            <Label>Quantity Delta</Label>
            <Input value={eventForm.quantityDelta} onChange={(e) => setEventForm((f) => ({ ...f, quantityDelta: e.target.value }))} />
          </FormField>
          <FormField>
            <Label>Value Delta</Label>
            <Input value={eventForm.valueDelta} onChange={(e) => setEventForm((f) => ({ ...f, valueDelta: e.target.value }))} />
          </FormField>
          <FormField>
            <Label>Reason</Label>
            <Input value={eventForm.reason} onChange={(e) => setEventForm((f) => ({ ...f, reason: e.target.value }))} />
          </FormField>
          <Button onClick={postEvent} disabled={busy}>
            Post Event
          </Button>
        </div>
      </Modal>

      <Modal isOpen={!!adjustmentModal} onClose={() => setAdjustmentModal(null)}>
        <h2 id="modal-title" className="text-lg font-bold text-ink">
          Post Adjustment
        </h2>
        <div className="space-y-3">
          <FormField>
            <Label>Adjustment Type</Label>
            <Select value={adjustmentForm.adjustmentType} onChange={(e) => setAdjustmentForm((f) => ({ ...f, adjustmentType: e.target.value }))}>
              {["INCREASE", "DECREASE", "CORRECTION", "OPENING_BALANCE"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField>
            <Label>Quantity Delta</Label>
            <Input value={adjustmentForm.quantityDelta} onChange={(e) => setAdjustmentForm((f) => ({ ...f, quantityDelta: e.target.value }))} />
          </FormField>
          <FormField>
            <Label>Value Delta</Label>
            <Input value={adjustmentForm.valueDelta} onChange={(e) => setAdjustmentForm((f) => ({ ...f, valueDelta: e.target.value }))} />
          </FormField>
          <FormField>
            <Label>Reason (required)</Label>
            <Input value={adjustmentForm.reason} onChange={(e) => setAdjustmentForm((f) => ({ ...f, reason: e.target.value }))} />
          </FormField>
          <Button onClick={postAdjustment} disabled={busy || !adjustmentForm.reason}>
            Post Adjustment
          </Button>
        </div>
      </Modal>

      <Modal isOpen={!!allocationModal} onClose={() => setAllocationModal(null)}>
        <h2 id="modal-title" className="text-lg font-bold text-ink">
          Reserve Allocation
        </h2>
        <div className="space-y-3">
          <FormField>
            <Label>Quantity</Label>
            <Input value={allocationForm.quantity} onChange={(e) => setAllocationForm((f) => ({ ...f, quantity: e.target.value }))} />
          </FormField>
          <FormField>
            <Label>Value</Label>
            <Input value={allocationForm.value} onChange={(e) => setAllocationForm((f) => ({ ...f, value: e.target.value }))} />
          </FormField>
          <FormField>
            <Label>Shipment ID (optional)</Label>
            <Input value={allocationForm.shipmentId} onChange={(e) => setAllocationForm((f) => ({ ...f, shipmentId: e.target.value }))} />
          </FormField>
          <Button onClick={reserveAllocation} disabled={busy || (!allocationForm.quantity && !allocationForm.value)}>
            Reserve
          </Button>
        </div>
      </Modal>

      <Modal isOpen={partyModalOpen} onClose={() => setPartyModalOpen(false)}>
        <h2 id="modal-title" className="text-lg font-bold text-ink">
          Attach Party
        </h2>
        <div className="space-y-3">
          <FormField>
            <Label>Party ID</Label>
            <Input value={partyForm.partyId} onChange={(e) => setPartyForm((f) => ({ ...f, partyId: e.target.value }))} />
          </FormField>
          <FormField>
            <Label>Role</Label>
            <Select value={partyForm.role} onChange={(e) => setPartyForm((f) => ({ ...f, role: e.target.value }))}>
              {["PURCHASER", "END_USER", "CONSIGNEE", "LICENSEE", "OTHER"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </FormField>
          <Button onClick={attachParty} disabled={busy || !partyForm.partyId}>
            Attach
          </Button>
        </div>
      </Modal>

      <Modal isOpen={documentModalOpen} onClose={() => setDocumentModalOpen(false)}>
        <h2 id="modal-title" className="text-lg font-bold text-ink">
          Upload Document
        </h2>
        <div className="space-y-3">
          <FormField>
            <Label>Document Type</Label>
            <Select value={documentForm.documentType} onChange={(e) => setDocumentForm((f) => ({ ...f, documentType: e.target.value }))}>
              {["AUTHORIZATION", "AMENDMENT", "CONDITIONS", "CORRESPONDENCE", "SUPPORTING_EVIDENCE"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField>
            <Label>File</Label>
            <input ref={fileInputRef} type="file" className="block w-full text-sm" />
          </FormField>
          <Button onClick={uploadDocument} disabled={busy}>
            Upload
          </Button>
        </div>
      </Modal>

      <Modal isOpen={closeConfirmOpen} onClose={() => setCloseConfirmOpen(false)}>
        <h2 id="modal-title" className="text-lg font-bold text-ink">
          Close License
        </h2>
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">
            Closing this license marks it CLOSED and prevents further utilization events or allocations. This cannot be undone.
          </p>
          <FormField>
            <Label>Reason (optional)</Label>
            <Input value={closeReason} onChange={(e) => setCloseReason(e.target.value)} />
          </FormField>
          <Button onClick={closeLicense} disabled={busy}>
            Confirm Close
          </Button>
        </div>
      </Modal>
    </div>
  );
}
