"use client";

import { useState } from "react";
import { X, Mail, CheckCircle2, ShieldAlert, Send, Sparkles } from "lucide-react";

export interface ExceptionSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  exception: {
    id: string;
    type: string;
    severity: "CRITICAL" | "WARNING" | "INFO";
    shipmentNumber: string;
    importerName: string;
    description: string;
    lineItemDescription?: string;
    aiRecommendation?: string;
    status: string;
  } | null;
  onResolved?: (id: string) => void;
}

export function ExceptionSlideOver({ isOpen, onClose, exception, onResolved }: ExceptionSlideOverProps) {
  const [activeTab, setActiveTab] = useState<"DETAILS" | "EMAIL" | "RESOLUTION">("DETAILS");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [resolutionReason, setResolutionReason] = useState("Carrier Accepted Rate Adjustment");
  const [isResolving, setIsResolving] = useState(false);

  if (!isOpen || !exception) return null;

  const initEmailTemplates = () => {
    setRecipientEmail(`dispatch@${exception.importerName.toLowerCase().replace(/\s+/g, "")}.com`);
    setEmailSubject(`[Action Required] Exception Alert for Shipment #${exception.shipmentNumber}: ${exception.type}`);
    setEmailBody(
      `Dear Operations Team,\n\nWe have flagged an operational exception regarding Shipment #${exception.shipmentNumber}:\n\nIssue: ${exception.description}\n\nRecommended Action: ${exception.aiRecommendation || "Please review and confirm resolution."}\n\nPlease update dispatch status or reply with confirmation.\n\nBest regards,\nQubere Logistics Operations`
    );
  };

  const handleSendEmail = () => {
    setEmailSent(true);
    setTimeout(() => {
      setEmailSent(false);
      setActiveTab("DETAILS");
    }, 1500);
  };

  const handleResolve = () => {
    setIsResolving(true);
    setTimeout(() => {
      setIsResolving(false);
      if (onResolved) onResolved(exception.id);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end">
      <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-250">
        {/* Slide-over Header */}
        <div className="p-6 border-b border-border bg-surface-muted/60 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
              exception.severity === "CRITICAL" ? "bg-red-100 text-red-700 border border-red-200" : "bg-amber-100 text-amber-800 border border-amber-200"
            }`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-sm text-ink">{exception.type}</span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                  exception.severity === "CRITICAL" ? "bg-red-100 text-red-900 border-red-300" : "bg-amber-100 text-amber-900 border-amber-300"
                }`}>
                  {exception.severity}
                </span>
              </div>
              <p className="text-xs text-ink-muted mt-0.5">Shipment <strong className="text-brand font-mono">#{exception.shipmentNumber}</strong> • {exception.importerName}</p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 rounded-full text-ink-muted hover:text-ink hover:bg-white border border-border/40 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-6 pt-4 pb-2 border-b border-border flex items-center space-x-2 shrink-0 bg-white">
          <button
            onClick={() => setActiveTab("DETAILS")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "DETAILS" ? "bg-brand text-white shadow-2xs" : "bg-surface-muted text-ink hover:bg-white"
            }`}
          >
            Issue & Evidence
          </button>
          <button
            onClick={() => {
              setActiveTab("EMAIL");
              initEmailTemplates();
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === "EMAIL" ? "bg-brand text-white shadow-2xs" : "bg-surface-muted text-ink hover:bg-white"
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email Third Party</span>
          </button>
          <button
            onClick={() => setActiveTab("RESOLUTION")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "RESOLUTION" ? "bg-brand text-white shadow-2xs" : "bg-surface-muted text-ink hover:bg-white"
            }`}
          >
            Resolve / Close
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 p-6 overflow-y-auto space-y-5">
          {activeTab === "DETAILS" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-border bg-surface-muted/30 space-y-2 text-xs">
                <span className="text-[10px] font-extrabold uppercase text-ink-muted tracking-wider block">Affected Component / Line Item</span>
                <p className="font-bold text-brand">{exception.lineItemDescription || "Shipment Delivery & Telematics"}</p>
              </div>

              <div className="p-4 rounded-xl border border-border bg-white space-y-2 text-xs shadow-2xs">
                <span className="text-[10px] font-extrabold uppercase text-ink-muted tracking-wider block">Incident Description</span>
                <p className="font-semibold text-ink leading-relaxed">{exception.description}</p>
              </div>

              <div className="p-4 rounded-xl border border-brand/30 bg-brand/5 space-y-2 text-xs">
                <div className="flex items-center space-x-1.5 text-brand">
                  <Sparkles className="w-4 h-4" />
                  <span className="font-extrabold">AI Recommended Action</span>
                </div>
                <p className="font-bold text-ink leading-relaxed">{exception.aiRecommendation || "Review shipment details and confirm resolution."}</p>
              </div>

              <div className="pt-2 border-t border-border space-y-2">
                <span className="text-[10px] font-extrabold uppercase text-ink-muted tracking-wider block">Audit History</span>
                <div className="space-y-1.5 text-[11px] font-mono text-ink-muted">
                  <p>• Exception raised by Qubere Telematics Monitor (10m ago)</p>
                  <p>• AI Recommendation generated with 96% confidence (9m ago)</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "EMAIL" && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-900 flex items-center space-x-2">
                <Mail className="w-4 h-4 text-brand shrink-0" />
                <span>Email third-party carrier, broker, or consignee directly with pre-filled context.</span>
              </div>

              <div>
                <label className="block font-bold text-ink mb-1">Recipient Email</label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-surface-muted text-ink font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-ink mb-1">Subject</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border text-ink font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-ink mb-1">Email Body</label>
                <textarea
                  rows={8}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full p-3 rounded-xl border border-border text-ink font-medium text-xs leading-relaxed focus:outline-none focus:border-brand"
                />
              </div>

              {emailSent && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Email sent successfully to third-party dispatch!</span>
                </div>
              )}

              <button
                onClick={handleSendEmail}
                className="w-full py-2.5 rounded-xl bg-brand text-white font-bold hover:bg-brand-hover flex items-center justify-center space-x-2 cursor-pointer shadow-xs"
              >
                <Send className="w-4 h-4" />
                <span>Send Email to Third Party</span>
              </button>
            </div>
          )}

          {activeTab === "RESOLUTION" && (
            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-ink mb-1">Resolution Category & Reason Code</label>
                <select
                  value={resolutionReason}
                  onChange={(e) => setResolutionReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border font-semibold text-ink bg-surface-muted"
                >
                  <option value="Carrier Accepted Rate Adjustment">Carrier Accepted Rate Adjustment</option>
                  <option value="Drayage Appointment Rescheduled">Drayage Appointment Rescheduled</option>
                  <option value="Customs Entry Released by CBP">Customs Entry Released by CBP</option>
                  <option value="Proof of Delivery Uploaded">Proof of Delivery Uploaded</option>
                  <option value="Manually Waived by Supervisor">Manually Waived by Supervisor</option>
                </select>
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-end space-x-2">
                <button onClick={onClose} className="px-4 py-2 rounded-xl border border-border text-ink font-semibold">
                  Cancel
                </button>
                <button
                  onClick={handleResolve}
                  disabled={isResolving}
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isResolving ? "Resolving..." : "Confirm & Close Issue"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
