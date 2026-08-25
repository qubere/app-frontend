"use client";

import { useState } from "react";
import { TmsSidebar } from "@/components/TmsSidebar";
import { TmsHeader } from "@/components/TmsHeader";
import { Plug, CheckCircle2, Key, ExternalLink, X, Check } from "lucide-react";
import { Card, Button } from "@/components/ui";

interface IntegrationItem {
  id: string;
  name: string;
  category: string;
  status: "Connected" | "Available";
  detail: string;
  lastSync: string;
  apiKey?: string;
}

const INITIAL_INTEGRATIONS: IntegrationItem[] = [
  { id: "int_01", name: "Project44 Visibility Platform", category: "GPS & Telemetry", status: "Connected", detail: "Real-time truck location and ETA forecasting", lastSync: "2 mins ago", apiKey: "p44_live_88a91c72" },
  { id: "int_02", name: "Samsara Fleet ELD", category: "Fleet & Driver HOS", status: "Connected", detail: "Driver logs, vehicle health, and geofencing", lastSync: "5 mins ago", apiKey: "samsara_prod_7712ba" },
  { id: "int_03", name: "FourKites Tracking", category: "Supply Chain Visibility", status: "Available", detail: "Multi-modal ocean and rail tracking integration", lastSync: "Not connected" },
  { id: "int_04", name: "QuickBooks Online / Enterprise", category: "Accounting & Freight Invoices", status: "Connected", detail: "Automated general ledger syncing for 3-way invoice matching", lastSync: "1 hour ago" },
  { id: "int_05", name: "NetSuite ERP Provider", category: "Enterprise ERP", status: "Available", detail: "Sync sales orders, customers, and inventory holds", lastSync: "Not connected" },
];

export function IntegrationsClient() {
  const [integrations, setIntegrations] = useState<IntegrationItem[]>(INITIAL_INTEGRATIONS);
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationItem | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [_isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState("");

  const handleOpenConfig = (item: IntegrationItem) => {
    setSelectedIntegration(item);
    setApiKeyInput(item.apiKey || "");
  };

  const handleToggleConnect = (item: IntegrationItem) => {
    const newStatus: "Connected" | "Available" = item.status === "Connected" ? "Available" : "Connected";
    const updated: IntegrationItem[] = integrations.map((i) =>
      i.id === item.id
        ? {
            ...i,
            status: newStatus,
            lastSync: newStatus === "Connected" ? "Just now" : "Not connected",
            apiKey: newStatus === "Connected" ? `key_${Date.now().toString().slice(-6)}` : undefined,
          }
        : i
    );
    setIntegrations(updated);
    setToastMessage(`${item.name} is now ${newStatus}`);
    setSelectedIntegration(null);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const handleGenerateKey = () => {
    setIsGeneratingKey(true);
    setTimeout(() => {
      const key = `qbr_secret_live_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
      setGeneratedKey(key);
      setIsGeneratingKey(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-surface-muted text-ink flex w-full">
      <TmsSidebar accountName="Enterprise Freight" />

      <div className="flex-1 flex flex-col min-w-0">
        <TmsHeader tenantName="Enterprise Freight" userName="Operations Lead" />

        <main className="flex-1 p-6 md:p-8 overflow-y-auto space-y-6 max-w-[1600px] mx-auto w-full">
          {toastMessage && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center space-x-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Header Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-border shadow-2xs">
            <div>
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center">
                  <Plug className="w-4 h-4 text-brand" />
                </div>
                <h1 className="text-xl font-black tracking-tight text-ink">Connected ERP & Carrier Integrations</h1>
              </div>
              <p className="text-xs text-ink-muted mt-1 font-medium">
                Manage telematics APIs, ERP connectors, accounting sync, and API webhooks.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Button onClick={handleGenerateKey} className="flex items-center space-x-2 bg-brand text-white hover:bg-brand-hover cursor-pointer">
                <Key className="w-4 h-4" />
                <span>Generate API Secret Key</span>
              </Button>
            </div>
          </div>

          {/* Secret Key Modal */}
          {generatedKey && (
            <div className="p-4 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-sm space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-emerald-400 font-mono uppercase">New API Key Generated</span>
                <button onClick={() => setGeneratedKey(null)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <code className="text-xs font-mono bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 block text-emerald-300 select-all">
                {generatedKey}
              </code>
              <p className="text-[10px] text-slate-400">Copy this secret key. It will not be shown again.</p>
            </div>
          )}

          {/* Integration Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {integrations.map((item) => (
              <Card key={item.id} className="p-6 bg-white border border-border space-y-4 shadow-2xs rounded-2xl">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <h3 className="font-extrabold text-sm text-ink">{item.name}</h3>
                    <p className="text-[11px] font-bold text-brand">{item.category}</p>
                  </div>
                  {item.status === "Connected" ? (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Connected</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-surface-muted text-ink-muted border border-border text-[10px] font-bold">
                      Available
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-muted leading-relaxed font-medium">{item.detail}</p>
                <div className="flex items-center justify-between text-xs pt-2">
                  <span className="text-[10px] text-ink-muted font-mono font-medium">Last sync: {item.lastSync}</span>
                  <button
                    onClick={() => handleOpenConfig(item)}
                    className="font-bold text-brand hover:underline flex items-center space-x-1 cursor-pointer"
                  >
                    <span>{item.status === "Connected" ? "Configure" : "Connect"}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </main>
      </div>

      {/* Integration Configuration Drawer/Modal */}
      {selectedIntegration && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-border rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-extrabold text-sm text-ink">{selectedIntegration.name}</h3>
                <p className="text-[11px] font-medium text-ink-muted">{selectedIntegration.category}</p>
              </div>
              <button onClick={() => setSelectedIntegration(null)} className="text-ink-muted hover:text-ink cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">API Key / Integration Secret</label>
              <input
                type="text"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="Enter API key or credential string"
                className="w-full px-3 py-2 rounded-xl border border-border text-xs focus:outline-none focus:border-brand font-mono"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                variant={selectedIntegration.status === "Connected" ? "outline" : "primary"}
                onClick={() => handleToggleConnect(selectedIntegration)}
                className={`cursor-pointer ${selectedIntegration.status === "Connected" ? "text-red-600 border-red-200 hover:bg-red-50" : "bg-brand text-white hover:bg-brand-hover"}`}
              >
                {selectedIntegration.status === "Connected" ? "Disconnect Integration" : "Connect Integration"}
              </Button>
              <Button variant="outline" onClick={() => setSelectedIntegration(null)} className="cursor-pointer">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
