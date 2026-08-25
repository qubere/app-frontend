"use client";

import { useState } from "react";
import { Modal, ModalHeader, Button } from "@/components/ui";
import { CheckCircle2 } from "lucide-react";
import type { WorkQueueItem } from "@/modules/operations/services/operationsSummaryService";

interface ModifyDecisionModalProps {
  item: WorkQueueItem | null;
  isOpen: boolean;
  onClose: () => void;
  onApproveModified: (itemId: string, modifiedInstruction: string) => Promise<void>;
}

export function ModifyDecisionModal({
  item,
  isOpen,
  onClose,
  onApproveModified,
}: ModifyDecisionModalProps) {
  const [modifiedNote, setModifiedNote] = useState("");
  const [selectedOption, setSelectedOption] = useState("default");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!item || !isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const finalInstruction =
        modifiedNote.trim() ||
        `Modified action approved for ${item.shipmentNumber} (Option: ${selectedOption})`;
      await onApproveModified(item.id, finalInstruction);
      onClose();
    } catch (err) {
      console.error("Failed to approve modified action:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader title="Modify Qubere Action Plan" onClose={onClose} />
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="p-3 bg-surface-muted rounded-xl border border-border space-y-1">
          <span className="font-extrabold text-ink block">{item.operationalTitle}</span>
          <p className="text-ink-muted">
            Shipment: <strong className="font-mono text-brand">{item.shipmentNumber}</strong> • {item.customerName}
          </p>
        </div>

        <div className="space-y-2">
          <label className="font-extrabold text-ink block uppercase text-[10px]">
            Qubere Recommendation
          </label>
          <div className="p-3 bg-blue-50/60 border border-brand/20 rounded-xl text-ink font-medium">
            {item.qubereRecommends}
          </div>
        </div>

        {/* Option Selection */}
        <div className="space-y-2">
          <label className="font-extrabold text-ink block uppercase text-[10px]">
            Select Modification Option
          </label>
          <div className="grid grid-cols-1 gap-2">
            <label className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
              selectedOption === "default" ? "border-brand bg-blue-50/30 ring-1 ring-brand/30" : "border-border bg-white"
            }`}>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="option"
                  value="default"
                  checked={selectedOption === "default"}
                  onChange={() => setSelectedOption("default")}
                  className="text-brand focus:ring-brand"
                />
                <div>
                  <span className="font-bold text-ink block">Proceed with Modified Parameters</span>
                  <span className="text-ink-muted block text-[11px]">Apply custom instructions to standard workflow.</span>
                </div>
              </div>
            </label>

            <label className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
              selectedOption === "escalate" ? "border-brand bg-blue-50/30 ring-1 ring-brand/30" : "border-border bg-white"
            }`}>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="option"
                  value="escalate"
                  checked={selectedOption === "escalate"}
                  onChange={() => setSelectedOption("escalate")}
                  className="text-brand focus:ring-brand"
                />
                <div>
                  <span className="font-bold text-ink block">Escalate to Senior Operations Lead</span>
                  <span className="text-ink-muted block text-[11px]">Require manual sign-off prior to dispatch/filing.</span>
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Operator Note */}
        <div className="space-y-1.5">
          <label className="font-extrabold text-ink block uppercase text-[10px]">
            Custom Instructions / Operator Note
          </label>
          <textarea
            value={modifiedNote}
            onChange={(e) => setModifiedNote(e.target.value)}
            placeholder="e.g. Approved with Carrier C override at $2,150 rate limit..."
            rows={3}
            className="w-full p-3 rounded-xl border border-border bg-surface-muted text-ink focus:outline-none focus:border-brand focus:bg-white text-xs font-medium"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            <span>{isSubmitting ? "Submitting..." : "Approve Modified Action"}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}
