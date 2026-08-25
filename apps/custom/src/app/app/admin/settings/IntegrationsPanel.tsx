"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  Globe,
  Key,
  Layers,
  Loader2,
  Plug,
  Server,
  ShieldCheck,
  Truck,
  AlertTriangle,
  Zap,
  Code2,
  UserCheck,
  Building2,
} from "lucide-react";
import { PanelHeading } from "@/components/PanelHeading";
import { Badge } from "@/components/ui/Badge";

export interface ClientOptionItem {
  id: string;
  name: string;
}

export interface IntegrationConfigItem {
  id: string;
  category: "ERP" | "ACCOUNTING" | "SHIPMENT_TRACKING";
  provider: string;
  name: string;
  status: "ACTIVE" | "INACTIVE" | "ERROR";
  clientId: string | null;
  clientName: string | null;
  baseUrl: string;
  environment: "PRODUCTION" | "SANDBOX";
  apiKeyMasked: string;
  hasApiKey: boolean;
  configJson: Record<string, unknown>;
  lastSyncAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage?: string | null;
  payloadCount: number;
  createdAt: string;
}

export interface IntegrationsApiResponse {
  accountName: string;
  integrations: IntegrationConfigItem[];
  clients?: ClientOptionItem[];
}

interface ProviderOption {
  id: string;
  name: string;
  description: string;
  defaultBaseUrl: string;
  icon?: string;
  requiresSecret?: boolean;
}

interface CategoryGroup {
  id: "SHIPMENT_TRACKING" | "ERP" | "ACCOUNTING";
  title: string;
  description: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  providers: ProviderOption[];
}

const CATEGORIES: CategoryGroup[] = [
  {
    id: "SHIPMENT_TRACKING",
    title: "Shipment Tracking & Logistics Visibility",
    description: "Connect real-time ocean container, vessel, flight, and parcel tracking status feeds.",
    badge: "Tracking",
    icon: Truck,
    providers: [
      { id: "VIZION", name: "Vizion API", description: "Ocean container tracking & port terminal milestones", defaultBaseUrl: "https://api.vizionapi.com/v1" },
      { id: "PROJECT44", name: "project44", description: "Global ocean, air & truckload visibility platform", defaultBaseUrl: "https://api.project44.com/v4" },
      { id: "FOURKITES", name: "FourKites", description: "Real-time supply chain tracking & predictive ETAs", defaultBaseUrl: "https://api.fourkites.com/v2" },
      { id: "TERMINAL49", name: "Terminal49", description: "Ocean container & port terminal availability feed", defaultBaseUrl: "https://api.terminal49.com/v2" },
      { id: "EASYPOST", name: "EasyPost", description: "Parcel shipping & multi-carrier tracking API", defaultBaseUrl: "https://api.easypost.com/v2" },
      { id: "CUSTOM_TRACKING", name: "Custom Tracking REST Feed", description: "Connect any carrier REST endpoint or custom JSON API", defaultBaseUrl: "https://api.yourdomain.com/tracking" },
    ],
  },
  {
    id: "ERP",
    title: "ERP & Enterprise Systems",
    description: "Sync purchase orders, commercial invoices, master data, and inbound shipments.",
    badge: "Enterprise",
    icon: Server,
    providers: [
      { id: "SAP", name: "SAP S/4HANA / ECC", description: "OData / REST connector for SAP POs & logistics", defaultBaseUrl: "https://sap.yourcompany.com/sap/opu/odata/sap" },
      { id: "NETSUITE", name: "Oracle NetSuite", description: "SuiteTalk REST API connector for inventory & orders", defaultBaseUrl: "https://netsuite.api.com/v1" },
      { id: "DYNAMICS365", name: "Microsoft Dynamics 365", description: "Finance & Supply Chain Management OData feed", defaultBaseUrl: "https://yourorg.api.crm.dynamics.com/api/data/v9.2" },
      { id: "CUSTOM_ERP", name: "Custom Webhook / REST ERP", description: "Generic JSON intake API for proprietary ERP systems", defaultBaseUrl: "https://erp.yourdomain.com/api/v1" },
    ],
  },
  {
    id: "ACCOUNTING",
    title: "Accounting & Billing",
    description: "Sync customs duty expenses, commercial invoices, payments, and client billing.",
    badge: "Finance",
    icon: Layers,
    providers: [
      { id: "QUICKBOOKS", name: "QuickBooks Online", description: "Sync invoices, payments & customs duty expenses", defaultBaseUrl: "https://quickbooks.api.intuit.com/v3/company" },
      { id: "XERO", name: "Xero Accounting", description: "Accounting API integration for international billing", defaultBaseUrl: "https://api.xero.com/api.xro/2.0" },
      { id: "STRIPE", name: "Stripe Billing", description: "Automated billing & customs service fee collections", defaultBaseUrl: "https://api.stripe.com/v1" },
      { id: "CUSTOM_BILLING", name: "Custom Financial API", description: "Custom billing feed for customs duty reconciliation", defaultBaseUrl: "https://finance.yourdomain.com/api/v1" },
    ],
  },
];

export function IntegrationsPanel({
  accountName,
  integrations,
  clients = [],
  onSaved,
  compact = true,
}: {
  accountName: string;
  integrations: IntegrationConfigItem[];
  clients?: ClientOptionItem[];
  onSaved: () => void;
  compact?: boolean;
}) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>("SHIPMENT_TRACKING");
  const [selectedProviderId, setSelectedProviderId] = useState<string>("VIZION");
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  // Form State
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, _setApiSecret] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.vizionapi.com/v1");
  const [environment, setEnvironment] = useState<"PRODUCTION" | "SANDBOX">("PRODUCTION");
  const [configMetadata, setConfigMetadata] = useState("");

  // Testing & Save State
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    payload?: any;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeCategoryObj = CATEGORIES.find((c) => c.id === expandedCategory);
  const selectedProviderObj =
    activeCategoryObj?.providers.find((p) => p.id === selectedProviderId) ?? activeCategoryObj?.providers[0];

  const handleSelectProvider = (provId: string) => {
    setSelectedProviderId(provId);
    const prov = activeCategoryObj?.providers.find((p) => p.id === provId);
    if (prov) {
      setBaseUrl(prov.defaultBaseUrl);
    }
    setTestResult(null);
    setErrorMsg(null);
  };

  const handleCategoryClick = (catId: "SHIPMENT_TRACKING" | "ERP" | "ACCOUNTING") => {
    if (expandedCategory === catId) {
      setExpandedCategory(null);
      return;
    }
    setExpandedCategory(catId);
    const firstProv = CATEGORIES.find((c) => c.id === catId)?.providers[0];
    if (firstProv) {
      setSelectedProviderId(firstProv.id);
      setBaseUrl(firstProv.defaultBaseUrl);
    }
    setTestResult(null);
    setErrorMsg(null);
  };

  const handleTestConnection = async () => {
    if (!selectedProviderObj || !activeCategoryObj) return;
    setIsTesting(true);
    setTestResult(null);
    setErrorMsg(null);

    let parsedConfig: Record<string, unknown> = {};
    if (configMetadata.trim()) {
      try {
        parsedConfig = JSON.parse(configMetadata);
      } catch {
        setErrorMsg("Invalid JSON metadata string.");
        setIsTesting(false);
        return;
      }
    }

    try {
      const res = await fetch("/api/admin/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: activeCategoryObj.id,
          provider: selectedProviderObj.id,
          name: selectedProviderObj.name,
          clientId: selectedClientId || undefined,
          apiKey: apiKey || undefined,
          apiSecret: apiSecret || undefined,
          baseUrl: baseUrl || undefined,
          environment,
          configJson: parsedConfig,
          savePayload: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Failed to test connection.");
      } else {
        setTestResult({
          success: true,
          message: data.message || `Successfully connected to ${selectedProviderObj.name}!`,
          payload: data.payload,
        });
        onSaved();
      }
    } catch {
      setErrorMsg("Network error occurred while testing connection.");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveIntegration = async () => {
    if (!selectedProviderObj || !activeCategoryObj) return;
    setIsSaving(true);
    setErrorMsg(null);

    let parsedConfig: Record<string, unknown> = {};
    if (configMetadata.trim()) {
      try {
        parsedConfig = JSON.parse(configMetadata);
      } catch {
        setErrorMsg("Invalid JSON in custom metadata field.");
        setIsSaving(false);
        return;
      }
    }

    try {
      const res = await fetch("/api/admin/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: activeCategoryObj.id,
          provider: selectedProviderObj.id,
          name: selectedProviderObj.name,
          clientId: selectedClientId || undefined,
          apiKey: apiKey || undefined,
          apiSecret: apiSecret || undefined,
          baseUrl: baseUrl || undefined,
          environment,
          configJson: parsedConfig,
          status: "ACTIVE",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Failed to save integration configuration.");
      } else {
        setTestResult({
          success: true,
          message: `Saved ${selectedProviderObj.name} configuration for ${accountName}`,
        });
        onSaved();
      }
    } catch {
      setErrorMsg("Network error occurred while saving.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={compact ? "space-y-5" : "space-y-8 max-w-5xl mx-auto"}>
      {/* Header Banner matching App Theme */}
      <PanelHeading
        icon={Plug}
        title="Integrations & APIs"
        subtitle={`Configure account-wide or client-specific ERPs, financial software, and tracking feeds for ${accountName}`}
        compact={compact}
      />

      {/* Active Integrations Summary Cards */}
      {integrations.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">
            Configured Connections ({integrations.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {integrations.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl border border-border bg-white shadow-2xs hover:border-brand/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-xl bg-brand/10 text-brand flex items-center justify-center font-bold text-xs">
                      {item.provider.slice(0, 3)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-ink">{item.name}</p>
                      <div className="flex items-center space-x-1.5 mt-0.5">
                        <span className="text-[10px] text-ink-muted">{item.category} • {item.environment}</span>
                      </div>
                    </div>
                  </div>
                  <Badge variant={item.status === "ACTIVE" ? "success" : "danger"}>
                    {item.status}
                  </Badge>
                </div>

                <div className="mt-2.5 flex items-center space-x-1.5 text-[11px]">
                  {item.clientName ? (
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100 flex items-center space-x-1">
                      <UserCheck className="w-3 h-3" />
                      <span>Client: {item.clientName}</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-brand font-semibold border border-blue-100 flex items-center space-x-1">
                      <Building2 className="w-3 h-3" />
                      <span>Account-Wide</span>
                    </span>
                  )}
                </div>

                <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between text-[11px] text-ink-muted">
                  <div className="flex items-center space-x-1.5">
                    <Database className="w-3.5 h-3.5 text-brand" />
                    <span>{item.payloadCount} payloads stored</span>
                  </div>
                  {item.lastSyncAt && <span>Synced {new Date(item.lastSyncAt).toLocaleTimeString()}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accordion Categories matching App Design System */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">
          Available Integrations by Purpose
        </h4>

        <div className="space-y-2.5">
          {CATEGORIES.map((cat) => {
            const isExpanded = expandedCategory === cat.id;
            const Icon = cat.icon;
            const configuredCount = integrations.filter((i) => i.category === cat.id).length;

            return (
              <div key={cat.id} className="border border-border rounded-2xl bg-white overflow-hidden shadow-2xs">
                <button
                  type="button"
                  onClick={() => handleCategoryClick(cat.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-surface-muted transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-bold text-ink">{cat.title}</p>
                        {configuredCount > 0 && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 bg-blue-50 text-brand rounded-full border border-blue-100">
                            {configuredCount} Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink-muted truncate">{cat.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 text-ink-muted">
                    <span className="text-xs font-semibold px-2.5 py-0.5 bg-surface-muted rounded-full text-ink-muted">
                      {cat.badge}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-brand" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </div>
                </button>

                {/* Expanded Form Content matching App Aesthetics */}
                {isExpanded && (
                  <div className="p-5 border-t border-border bg-surface-muted/60 space-y-5">
                    {/* Customer / Client Binding & Provider Selectors */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Client Scope Binding */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-ink flex items-center space-x-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-brand" />
                          <span>Customer / Client Scope</span>
                        </label>
                        <div className="relative">
                          <select
                            value={selectedClientId}
                            onChange={(e) => setSelectedClientId(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-white border border-border rounded-xl text-xs font-semibold text-ink shadow-2xs focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none cursor-pointer appearance-none pr-9"
                          >
                            <option value="">Account-Wide (All Customers)</option>
                            {clients.map((cl) => (
                              <option key={cl.id} value={cl.id}>
                                Client: {cl.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-4 h-4 text-ink-muted absolute right-3 top-3 pointer-events-none" />
                        </div>
                        <p className="text-[10px] text-ink-muted">
                          Bind credentials to a specific customer/client portfolio or use Account-Wide.
                        </p>
                      </div>

                      {/* Provider Selector */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-ink">Select Provider Integration</label>
                        <div className="relative">
                          <select
                            value={selectedProviderId}
                            onChange={(e) => handleSelectProvider(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-white border border-border rounded-xl text-xs font-semibold text-ink shadow-2xs focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none cursor-pointer appearance-none pr-9"
                          >
                            {cat.providers.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} — {p.description}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-4 h-4 text-ink-muted absolute right-3 top-3 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    {/* Form Input Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-ink flex items-center space-x-1">
                          <Key className="w-3.5 h-3.5 text-ink-muted" />
                          <span>API Key / Secret Token</span>
                        </label>
                        <input
                          type="password"
                          placeholder="e.g. viz_live_98124791823"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-border rounded-xl text-xs font-mono text-ink shadow-2xs focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-ink flex items-center space-x-1">
                          <Globe className="w-3.5 h-3.5 text-ink-muted" />
                          <span>Base API / Schema Endpoint</span>
                        </label>
                        <input
                          type="text"
                          placeholder="https://api.provider.com/v1"
                          value={baseUrl}
                          onChange={(e) => setBaseUrl(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-border rounded-xl text-xs font-mono text-ink shadow-2xs focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-ink">Environment Mode</label>
                        <div className="flex items-center space-x-2 pt-0.5">
                          <button
                            type="button"
                            onClick={() => setEnvironment("PRODUCTION")}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                              environment === "PRODUCTION"
                                ? "bg-brand text-white shadow-2xs"
                                : "bg-white text-ink border border-border hover:bg-surface-muted"
                            }`}
                          >
                            Production
                          </button>
                          <button
                            type="button"
                            onClick={() => setEnvironment("SANDBOX")}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                              environment === "SANDBOX"
                                ? "bg-amber-500 text-white shadow-2xs"
                                : "bg-white text-ink border border-border hover:bg-surface-muted"
                            }`}
                          >
                            Sandbox / Staging
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-ink flex items-center space-x-1">
                          <Code2 className="w-3.5 h-3.5 text-ink-muted" />
                          <span>Custom JSON Metadata (Optional)</span>
                        </label>
                        <input
                          type="text"
                          placeholder='{"webhookSecret": "whsec_..."}'
                          value={configMetadata}
                          onChange={(e) => setConfigMetadata(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-border rounded-xl text-xs font-mono text-ink shadow-2xs focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                        />
                      </div>
                    </div>

                    {/* Alert Error Message */}
                    {errorMsg && (
                      <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                        <span>{errorMsg}</span>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <div className="text-[11px] text-ink-muted flex items-center space-x-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Encrypted API credentials stored securely per tenant</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={handleTestConnection}
                          disabled={isTesting || isSaving}
                          className="px-4 py-2 text-xs font-bold text-brand bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
                        >
                          {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                          <span>Test Connection & Fetch Data</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSaveIntegration}
                          disabled={isSaving || isTesting}
                          className="px-4 py-2 text-xs font-bold text-white bg-brand hover:bg-brand/90 rounded-xl transition-colors cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
                        >
                          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          <span>Save Integration</span>
                        </button>
                      </div>
                    </div>

                    {/* Payload Inspector Drawer */}
                    {testResult && (
                      <div className="mt-4 p-4 rounded-2xl bg-slate-900 border border-slate-800 text-white space-y-3 shadow-md animate-in fade-in duration-200">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <div className="flex items-center space-x-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs font-bold text-emerald-400">{testResult.message}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">Payload Stored in DB</span>
                        </div>

                        {testResult.payload && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                              Fetched JSON Payload Data:
                            </p>
                            <pre className="p-3 bg-slate-950 rounded-xl text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-48 scrollbar-thin">
                              {JSON.stringify(testResult.payload, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
