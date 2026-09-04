"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ShieldAlert, Sparkles, Upload, Pencil } from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { caughtMessage, cn } from "@/lib/utils";
import { reasonsForCategory, type ExceptionCategory } from "@/modules/exceptions/resolutionReasons";

import type { HtsSuggestion, ShipmentLineItemRow } from "./workspaceTypes";

interface ExceptionItem {
  id: string;
  dbId: string;
  version: number;
  category: string;
  title: string;
  desc: string;
  actionText: string;
  actionType: string;
  /** Real ExceptionItem.category column, for filtering the waive reason picklist. */
  dbCategory?: string | null;
  documentId?: string | null;
  fieldKey?: string | null;
  currentValue?: string | null;
  conflict?: { field: string; expectedValue: string; actualValue: string; sources: string[] } | null;
}

interface ExceptionResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  exception: ExceptionItem | null;
  shipmentId: string;
  lineItems: ShipmentLineItemRow[];
}

const TITLE_ID = "exception-resolution-title";

export function ExceptionResolutionModal({
  isOpen,
  onClose,
  exception,
  shipmentId,
  lineItems,
}: ExceptionResolutionModalProps) {
  const router = useRouter();
  const [saveLoading, setSaveLoading] = useState(false);

  // HTS resolution state
  const [editHts, setEditHts] = useState("");
  const [htsSuggestions, setHtsSuggestions] = useState<HtsSuggestion[]>([]);

  // Origin resolution state
  const [editCoo, setEditCoo] = useState("");

  // Quantity mismatch state
  const [selectedQuantity, setSelectedQuantity] = useState<number | "CUSTOM">(20);
  const [customQtyVal, setCustomQtyVal] = useState("");

  // POA state
  const [poaSignedName, setPoaSignedName] = useState("");

  // Certificate upload state
  const [fileName, setFileName] = useState("");

  // Field-correction state (MISSING_EXTRACTION:* exceptions)
  const [correctionValue, setCorrectionValue] = useState("");

  // Waive state (generic findings with no correctable field)
  const [waiveReasonCode, setWaiveReasonCode] = useState("");
  const [waiveNote, setWaiveNote] = useState("");

  // Sync initial values
  useEffect(() => {
    if (exception) {
      const targetItem = lineItems[1] || lineItems[0];
      // Resets the form when a different exception is opened into the same mounted
      // dialog, so the previous exception's edits are never submitted against it.
      setEditHts(targetItem?.htsCode || "");
      setEditCoo(targetItem?.countryOfOrigin || "");
      setSelectedQuantity(20);
      setCustomQtyVal("");
      setPoaSignedName("");
      setFileName("");
      setCorrectionValue(exception.currentValue || "");
      setWaiveReasonCode("");
      setWaiveNote("");
    }
  }, [exception, lineItems]);

  // HTS Search autocomplete debouncing
  useEffect(() => {
    if (exception?.actionType === "HTS" && editHts.trim().length >= 2) {
      const timer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/v1/hts/search?q=${encodeURIComponent(editHts.trim())}&limit=5`);
          if (res.ok) {
            const data = await res.json();
            setHtsSuggestions(data.items || []);
          }
        } catch (err) {
          console.error("Failed to query HTS suggestions:", err);
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      // Clears stale autocomplete results as soon as the query stops qualifying.
      setHtsSuggestions([]);
    }
  }, [editHts, exception]);

  if (!isOpen || !exception) return null;

  const isFieldCorrection = exception.actionType === "FIELD_CORRECTION";
  const isWaive = !isFieldCorrection && exception.actionType === "DEFAULT";
  const waiveReasons = reasonsForCategory(
    (exception.dbCategory as ExceptionCategory | null) ?? null
  );

  const handleResolve = async () => {
    // Field correction: write the value through the field-review path, which
    // persists it and auto-resolves this exception. No more clearing the queue
    // without a real write (finding #1).
    if (isFieldCorrection) {
      if (!correctionValue.trim()) {
        alert("Enter the correct value before saving.");
        return;
      }
      if (!exception.documentId || !exception.fieldKey) {
        alert("This exception is missing its document reference and can't be corrected here.");
        return;
      }
      setSaveLoading(true);
      try {
        const res = await fetch(
          `/api/shipments/${shipmentId}/documents/${exception.documentId}/field-review`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fieldKey: exception.fieldKey,
              action: "EDIT",
              value: correctionValue.trim(),
            }),
          }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error?.message ?? data.message ?? "Failed to save the corrected value");
        }
        onClose();
        router.refresh();
      } catch (err) {
        alert(caughtMessage(err, "Failed to save the corrected value"));
      } finally {
        setSaveLoading(false);
      }
      return;
    }

    // Waive: an accountable risk acceptance — reason code + note required, and
    // the API enforces the risk-acceptance permission.
    if (isWaive) {
      if (!waiveReasonCode) {
        alert("Choose a reason before waiving this exception.");
        return;
      }
      if (!waiveNote.trim()) {
        alert("Add a short note explaining the decision.");
        return;
      }
      setSaveLoading(true);
      try {
        const res = await fetch(`/api/exceptions/${exception.dbId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "WAIVED",
            resolutionReasonCode: waiveReasonCode,
            resolutionReason: waiveNote.trim(),
            expectedVersion: exception.version,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error?.message ?? data.message ?? "Failed to waive exception");
        }
        onClose();
        router.refresh();
      } catch (err) {
        alert(caughtMessage(err, "Failed to waive exception"));
      } finally {
        setSaveLoading(false);
      }
      return;
    }

    setSaveLoading(true);
    try {
      // 1. Perform backend mutations depending on the exception category
      let mutationPromise: Promise<Response> | null = null;

      if (exception.actionType === "HTS") {
        const targetItem = lineItems.find(item => item.description.toLowerCase().includes("controller"))
          || lineItems[1]
          || lineItems[0]
          || null;
        const payload = targetItem
          ? { id: targetItem.id, htsCode: editHts.trim() }
          : { htsCode: editHts.trim() };

        mutationPromise = fetch(`/api/shipments/${shipmentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lineItems: [payload],
          }),
        });
      }

      else if (exception.actionType === "COO") {
        const targetItem = lineItems.find(item => item.description.toLowerCase().includes("controller"))
          || lineItems[1]
          || lineItems[0]
          || null;
        const payload = targetItem
          ? { id: targetItem.id, countryOfOrigin: editCoo.trim() }
          : { countryOfOrigin: editCoo.trim() };

        mutationPromise = fetch(`/api/shipments/${shipmentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            countryOfOrigin: editCoo.trim(),
            lineItems: [payload],
          }),
        });
      }

      else if (exception.actionType === "MISMATCH") {
        const targetItem = lineItems.find(item => item.description.toLowerCase().includes("controller"))
          || lineItems[1]
          || lineItems[0]
          || null;
        const finalQuantity = selectedQuantity === "CUSTOM" ? parseInt(customQtyVal, 10) : selectedQuantity;
        if (isNaN(finalQuantity) || finalQuantity <= 0) {
          throw new Error("Please enter a valid positive quantity");
        }
        const payload = targetItem
          ? { id: targetItem.id, quantity: finalQuantity }
          : { quantity: finalQuantity };

        mutationPromise = fetch(`/api/shipments/${shipmentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lineItems: [payload],
          }),
        });
      }

      else if (exception.actionType === "UPLOAD") {
        if (!fileName.trim()) throw new Error("Please select a file to attach");
        mutationPromise = fetch("/api/documents/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shipmentId,
            fileName: fileName.trim(),
            fileUrl: "#",
            docType: "GENERAL_CERTIFICATE_OF_ORIGIN",
          }),
        });
      }

      else if (exception.actionType === "POA") {
        if (!poaSignedName.trim()) throw new Error("Customs Broker Signature is required for POA renewal");
      }

      // Execute shipment mutation & exception resolution status update in parallel
      const exPatchPromise = fetch(`/api/exceptions/${exception.dbId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "RESOLVED",
          resolutionReason: `Resolved via Exception Resolution Hub for issue: ${exception.title}`,
          expectedVersion: exception.version,
        }),
      });

      const [resMutation, resEx] = await Promise.all([
        mutationPromise ? mutationPromise : Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })),
        exPatchPromise,
      ]);

      if (resMutation && !resMutation.ok) {
        const errData = await resMutation.json().catch(() => ({}));
        throw new Error(errData.error?.message ?? "Failed to update shipment data");
      }

      if (!resEx.ok) {
        const errData = await resEx.json().catch(() => ({}));
        throw new Error(errData.error?.message ?? "Failed to resolve database exception item");
      }

      onClose();
      // Refresh Next.js server components smoothly without full page refresh
      router.refresh();
    } catch (err) {
      alert(caughtMessage(err, "Failed to resolve exception"));
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} titleId={TITLE_ID} className="max-w-xl space-y-4">
      <ModalHeader
        titleId={TITLE_ID}
        title={exception.title}
        subtitle={
          isFieldCorrection
            ? "Provide the correct value for this field"
            : isWaive
              ? "Waive this exception with a recorded reason"
              : "Resolve exception item directly in Qubere Workspace"
        }
        icon={isFieldCorrection ? <Pencil className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
        onClose={onClose}
      />

      {/* The resolution body varies by exception type and the mismatch and POA
          branches run tall. It scrolls so Resolve & Save below stays reachable --
          that button going off-screen is what this pinning is for. */}
      <ModalBody className="space-y-4">
      {/* Warning Details Panel */}
      <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 text-xs text-amber-800 leading-normal flex items-start space-x-2.5">
        <AlertTriangle className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-extrabold text-[12px]">Issue: {exception.title}</p>
          <p className="text-[11px] mt-0.5">{exception.desc}</p>
        </div>
      </div>

      {/* Core Resolution Fields depending on Exception Category */}
      <div className="py-2">
        {/* 0a. Missing field correction — writes the value through the field
            review path, which persists it and clears this exception. */}
        {isFieldCorrection && (
          <div className="space-y-3 text-xs">
            <Label className="font-bold">Correct value</Label>
            <Input
              value={correctionValue}
              onChange={(e) => setCorrectionValue(e.target.value)}
              placeholder="Enter the value as it appears on the document…"
              className="bg-surface-muted focus:bg-white font-bold text-[12px]"
              disabled={saveLoading}
              autoFocus
            />
            <p className="text-[10px] text-ink-muted leading-relaxed">
              Saved to the document&apos;s extracted fields and recorded against your name.
              The exception clears once the value is provided.
            </p>
          </div>
        )}

        {/* 0b. Waive — accountable risk acceptance for findings with no
            correctable field. Reason code + note required; the API enforces
            the risk-acceptance permission. */}
        {isWaive && (
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] leading-normal">
              Waiving accepts the risk this exception describes. It stays on the
              record with your name, the reason, and your note.
            </div>
            <div className="space-y-1">
              <Label className="font-bold">Reason</Label>
              <select
                value={waiveReasonCode}
                onChange={(e) => setWaiveReasonCode(e.target.value)}
                disabled={saveLoading}
                className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-surface-muted focus:bg-white text-ink font-semibold focus:outline-none focus:border-brand"
              >
                <option value="">— Choose a reason —</option>
                {waiveReasons.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="font-bold">Note</Label>
              <textarea
                value={waiveNote}
                onChange={(e) => setWaiveNote(e.target.value)}
                disabled={saveLoading}
                rows={3}
                placeholder="Explain the decision — what was checked, who confirmed it."
                className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-surface-muted focus:bg-white text-ink focus:outline-none focus:border-brand resize-none"
              />
            </div>
          </div>
        )}

        {/* 1. HTS Code resolution UI */}
        {exception.actionType === "HTS" && (
          <div className="space-y-3 relative text-xs">
            <Label className="font-bold">Override HTS Classification Code</Label>
            <div className="relative">
              <Input
                value={editHts}
                onChange={(e) => setEditHts(e.target.value)}
                placeholder="Type product type or HTS number..."
                className="bg-surface-muted focus:bg-white font-mono font-bold text-[12px]"
                disabled={saveLoading}
              />

              {/* Autocomplete suggestions */}
              {htsSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 z-50 bg-white border border-border rounded-xl shadow-lg mt-1 p-1.5 space-y-1 max-h-48 overflow-y-auto">
                  <p className="text-[9px] text-ink-muted font-bold px-1.5 uppercase tracking-wider">HTS Autocomplete Results</p>
                  {htsSuggestions.map((sugg) => (
                    <button
                      key={sugg.id}
                      onClick={() => {
                        setEditHts(sugg.htsNumberDisplay);
                        setHtsSuggestions([]);
                      }}
                      className="w-full text-left p-2 rounded-lg hover:bg-surface-muted text-[10px] space-y-0.5 block transition-colors cursor-pointer"
                    >
                      <span className="font-mono font-bold text-brand">{sugg.htsNumberDisplay}</span>
                      <span className="text-ink-muted block truncate leading-snug">{sugg.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[10px] text-ink-muted leading-relaxed">
              Provide correct 10-digit Harmonized Tariff Schedule classification. Autocomplete searches database in real-time.
            </p>
          </div>
        )}

        {/* 2. Country of Origin resolution UI */}
        {exception.actionType === "COO" && (
          <div className="space-y-3 text-xs">
            <Label className="font-bold">Specify Declared Country of Origin</Label>
            <Input
              value={editCoo}
              onChange={(e) => setEditCoo(e.target.value)}
              placeholder="e.g. Germany"
              className="bg-surface-muted focus:bg-white font-bold text-[12px]"
              disabled={saveLoading}
            />
            <p className="text-[10px] text-ink-muted leading-relaxed">
              Provide the correct Country of Origin as verified on shipment documents to determine preferential duty qualifiers.
            </p>
          </div>
        )}

        {/* 3. Certificate of Origin Missing upload UI */}
        {exception.actionType === "UPLOAD" && (
          <div className="space-y-3 text-xs">
            <Label className="font-bold">Upload Trade Certificate</Label>
            <div className="border-2 border-dashed border-border rounded-2xl p-5 text-center bg-[#F9F9FB] space-y-2">
              <Upload className="w-8 h-8 text-brand mx-auto opacity-70" />
              <div>
                <p className="font-bold text-ink">Drag and drop certificate file</p>
                <p className="text-[10px] text-ink-muted mt-0.5">Supports PDF, PNG, JPG up to 10MB</p>
              </div>
              <Input
                placeholder="Or enter filename (e.g. cert_origin_shp001.pdf)"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="max-w-xs mx-auto bg-white text-center font-bold py-1.5"
              />
            </div>
          </div>
        )}

        {/* 4. Side by Side Quantity Mismatch Resolution */}
        {exception.actionType === "MISMATCH" && (
          <div className="space-y-3 text-xs">
            <Label className="font-bold">Resolve Document Mismatch</Label>

            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => setSelectedQuantity(20)}
                className={cn(
                  "p-3.5 rounded-xl border transition-all cursor-pointer space-y-2",
                  selectedQuantity === 20
                    ? "bg-blue-50/80 border-brand ring-1 ring-brand/20"
                    : "bg-[#F9F9FB] border-border hover:border-brand"
                )}
              >
                <div className="flex justify-between items-center text-[9px] uppercase font-bold text-ink-muted">
                  <span>Commercial Invoice</span>
                  <span className="text-brand">Doc 1</span>
                </div>
                <p className="font-extrabold text-ink text-sm font-mono">20 PCS</p>
              </div>

              <div
                onClick={() => setSelectedQuantity(18)}
                className={cn(
                  "p-3.5 rounded-xl border transition-all cursor-pointer space-y-2",
                  selectedQuantity === 18
                    ? "bg-blue-50/80 border-brand ring-1 ring-brand/20"
                    : "bg-[#F9F9FB] border-border hover:border-brand"
                )}
              >
                <div className="flex justify-between items-center text-[9px] uppercase font-bold text-ink-muted">
                  <span>Packing List</span>
                  <span className="text-purple-700">Doc 2</span>
                </div>
                <p className="font-extrabold text-ink text-sm font-mono">18 PCS</p>
              </div>
            </div>

            <div className="p-3 bg-surface-muted rounded-xl border border-border space-y-2">
              <label className="flex items-center space-x-2 font-bold cursor-pointer">
                <input
                  type="radio"
                  checked={selectedQuantity === "CUSTOM"}
                  onChange={() => setSelectedQuantity("CUSTOM")}
                  className="w-4 h-4 text-brand"
                />
                <span>Specify Custom Correct Quantity</span>
              </label>
              {selectedQuantity === "CUSTOM" && (
                <div className="flex items-center space-x-2 pl-6">
                  <input
                    type="number"
                    value={customQtyVal}
                    onChange={(e) => setCustomQtyVal(e.target.value)}
                    placeholder="e.g. 19"
                    className="w-20 px-2.5 py-1 border border-brand rounded-lg focus:outline-none focus:ring-1 focus:ring-brand bg-white font-mono text-xs"
                    disabled={saveLoading}
                  />
                  <span className="font-bold text-ink-muted">PCS</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. Importer POA Expired renewal UI */}
        {exception.actionType === "POA" && (
          <div className="space-y-3 text-xs">
            <Label className="font-bold">Renew Importer Power of Attorney</Label>
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-start space-x-2 text-blue-900 leading-normal">
              <ShieldAlert className="w-5 h-5 text-brand shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold">POA Electronic Consent Renewal</p>
                <p className="text-[11px] mt-0.5">
                  Sign off to renew the active Power of Attorney consent for Target Enterprise. The renewal extends POA credentials for 1 year per CBP regulation 19 CFR § 141.46.
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="font-bold text-ink">Broker / Officer Signature Name</p>
              <Input
                value={poaSignedName}
                onChange={(e) => setPoaSignedName(e.target.value)}
                placeholder="Sign as Joe Admin / Licensed Customs Broker"
                className="bg-surface-muted focus:bg-white font-bold text-[12px]"
                disabled={saveLoading}
              />
            </div>
          </div>
        )}
      </div>

      </ModalBody>

      {/* Footer */}
      <ModalFooter className="pt-3 border-t border-border">
        <Button variant="secondary" onClick={onClose} disabled={saveLoading}>
          Cancel
        </Button>
        <Button
          onClick={handleResolve}
          loading={saveLoading}
          variant={isWaive ? "secondary" : "primary"}
        >
          {saveLoading
            ? "Saving..."
            : isFieldCorrection
              ? "Save correction"
              : isWaive
                ? "Waive exception"
                : "Resolve & Save"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
