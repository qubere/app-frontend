import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { TmsSidebar } from "@/components/TmsSidebar";
import { TmsHeader } from "@/components/TmsHeader";
import { Settings, History, Mail, Sliders } from "lucide-react";
import { Card } from "@/components/ui";

export default async function AdminSettingsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const auditLogs = [
    { id: "log_01", timestamp: "2026-08-21 21:30:12", actor: "AI Dispatch Bot", action: "TENDER_DISPATCHED", detail: "Dispatched Shipment #SHP-9021 via Project44 API to carrier Western Logistics." },
    { id: "log_02", timestamp: "2026-08-21 20:15:00", actor: "Operations Lead", action: "ROLE_UPDATED", detail: "Granted DISPATCHER permission to user s.jenkins@enterprisefreight.com." },
    { id: "log_03", timestamp: "2026-08-21 18:45:22", actor: "AI Audit Engine", action: "INVOICE_MATCHED", detail: "Completed 3-way match for Freight Invoice #INV-88102 (Variance: $0.00)." },
    { id: "log_04", timestamp: "2026-08-21 16:10:04", actor: "System Webhook", actorType: "Inbound Email", action: "DOCUMENT_INGESTED", detail: "Parsed Rate Confirmation PDF from inbound email route freight-docs-acme@inbound.qubere.ai." },
  ];

  return (
    <div className="min-h-screen bg-surface-muted text-ink flex w-full">
      <TmsSidebar accountName="Enterprise Freight" />

      <div className="flex-1 flex flex-col min-w-0">
        <TmsHeader tenantName="Enterprise Freight" userName="Operations Lead" />

        <main className="flex-1 p-8 overflow-y-auto space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center">
                  <Settings className="w-4 h-4 text-brand" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-ink">System Settings & Audit Log</h1>
              </div>
              <p className="text-xs text-ink-muted mt-1">
                Configure automated dispatch parameters, document email ingestion, and inspect audit trails.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Configuration Controls */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="p-6 bg-white border border-border space-y-4">
                <div className="flex items-center space-x-2 border-b border-border pb-3">
                  <Mail className="w-4 h-4 text-brand" />
                  <h3 className="font-bold text-sm text-ink">Inbound Email Routing</h3>
                </div>
                <p className="text-xs text-ink-muted leading-relaxed">
                  Freight Rate Confirmations & Bills of Lading emailed to your inbound address are automatically parsed by Qubere AI.
                </p>
                <div className="p-3 bg-surface-muted rounded-xl border border-border">
                  <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block mb-1">Target Email Address</span>
                  <code className="text-xs font-mono text-brand font-bold select-all block">
                    freight-docs-acme@inbound.qubere.ai
                  </code>
                </div>
              </Card>

              <Card className="p-6 bg-white border border-border space-y-4">
                <div className="flex items-center space-x-2 border-b border-border pb-3">
                  <Sliders className="w-4 h-4 text-brand" />
                  <h3 className="font-bold text-sm text-ink">Invoice Audit Tolerances</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">Max Auto-Approve Price Variance</label>
                    <input type="text" defaultValue="$25.00" className="w-full px-3 py-2 text-xs bg-surface-muted border border-border rounded-xl font-bold text-ink" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">Detention Charge Verification</label>
                    <select className="w-full px-3 py-2 text-xs bg-surface-muted border border-border rounded-xl font-semibold text-ink">
                      <option>Cross-reference Geofence Telemetry</option>
                      <option>Require Manual Dispatch Approval</option>
                    </select>
                  </div>
                </div>
              </Card>
            </div>

            {/* Right: Audit Log Table */}
            <div className="lg:col-span-2">
              <Card className="bg-white border border-border overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <History className="w-4 h-4 text-brand" />
                    <h3 className="font-bold text-sm text-ink">Immutable Audit Trail</h3>
                  </div>
                  <span className="text-xs text-ink-muted font-mono">SOC2 Compliant Logging</span>
                </div>
                <div className="divide-y divide-border">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-4 hover:bg-surface-muted/30 transition-colors space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-ink">{log.actor}</span>
                        <span className="text-[10px] font-mono text-ink-muted">{log.timestamp}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[10px] font-bold">
                          {log.action}
                        </span>
                        <p className="text-xs text-ink-muted">{log.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
