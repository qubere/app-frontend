"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X, Building, Users, ShieldCheck, Settings2, Plug, Mail, Shield, Check, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type PanelItemId = "account" | "users" | "roles" | "settings" | "documentEmail" | "integrations";

export interface ManageAccountPanelItem {
  id: PanelItemId;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  endpoint?: string;
}

export interface ManageAccountExternalItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

interface ManageAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountName: string;
  items?: ManageAccountPanelItem[];
  externalItems?: ManageAccountExternalItem[];
}

const DEFAULT_ITEMS: ManageAccountPanelItem[] = [
  { id: "account", name: "Account Profile", icon: Building, description: "Company details & TMS preferences" },
  { id: "users", name: "User Management", icon: Users, description: "Dispatchers, drivers, finance & invitation grants" },
  { id: "roles", name: "Roles & Permissions", icon: ShieldCheck, description: "Role definitions & permission levels" },
  { id: "settings", name: "System Settings", icon: Settings2, description: "Configuration, dispatch rules & audit logs" },
  { id: "integrations", name: "Integrations & APIs", icon: Plug, description: "Provider catalog, connections, webhooks, and health" },
  { id: "documentEmail", name: "Inbound Email Routing", icon: Mail, description: "Automated document ingestion email addresses" },
];

export function ManageAccountModal({
  isOpen,
  onClose,
  accountName,
  items = DEFAULT_ITEMS,
  externalItems = [{ name: "Qubere Freight Console", href: "/platform-admin", icon: Shield, description: "Cross-tenant administration" }],
}: ManageAccountModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<PanelItemId>("account");

  // Account Profile Form State
  const [companyName, setCompanyName] = useState(accountName);
  const [scac, setScac] = useState("QBR-FREIGHT-8821");
  const [autoTenderProtocol, setAutoTenderProtocol] = useState("Lowest Rate First (Waterfall Routing)");
  const [contactEmail, setContactEmail] = useState("dispatch@qubere.ai");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"success" | "error" | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setCompanyName(accountName);
  }, [accountName]);

  async function handleSaveAccountProfile(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus(null);
    setErrorMessage("");

    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: companyName,
          scac,
          autoTenderProtocol,
          contactEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update account profile");
      }

      setSaveStatus("success");
      router.refresh();
      setTimeout(() => {
        setSaveStatus(null);
      }, 4000);
    } catch (err: any) {
      console.error("Save Account Profile error:", err);
      setSaveStatus("error");
      setErrorMessage(err?.message || "An unexpected error occurred while saving account profile.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end transition-opacity">
      <div className="relative w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="h-16 px-6 border-b border-border flex items-center justify-between bg-surface-muted/50">
          <div>
            <h2 className="text-base font-bold text-ink">Account & Governance Settings</h2>
            <p className="text-xs text-ink-muted">{companyName || accountName} — Freight OS</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-ink-muted hover:text-ink hover:bg-white border border-border/40 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body: Sidebar + Main Panel */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Navigation Sidebar */}
          <div className="w-64 border-r border-border bg-surface-muted/30 p-3 space-y-1 overflow-y-auto shrink-0">
            <div className="px-3 py-1.5 text-[10px] font-bold text-ink-muted uppercase tracking-wider">
              Management & Controls
            </div>
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "w-full flex items-start space-x-3 p-2.5 rounded-xl text-left transition-all cursor-pointer",
                    isActive
                      ? "bg-white text-brand shadow-2xs border border-border font-semibold"
                      : "text-ink hover:bg-white/60 hover:text-brand"
                  )}
                >
                  <Icon className={cn("w-4 h-4 shrink-0 mt-0.5", isActive ? "text-brand" : "text-ink-muted")} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{item.name}</p>
                    <p className="text-[10px] text-ink-muted line-clamp-1">{item.description}</p>
                  </div>
                </button>
              );
            })}

            {externalItems.length > 0 && (
              <>
                <div className="px-3 pt-4 pb-1.5 text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                  Platform Admin
                </div>
                {externalItems.map((ext) => {
                  const Icon = ext.icon;
                  return (
                    <a
                      key={ext.name}
                      href={ext.href}
                      className="flex items-start space-x-3 p-2.5 rounded-xl text-amber-900 bg-amber-500/10 hover:bg-amber-500/20 transition-all border border-amber-500/20"
                    >
                      <Icon className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{ext.name}</p>
                        <p className="text-[10px] text-amber-800 line-clamp-1">{ext.description}</p>
                      </div>
                    </a>
                  );
                })}
              </>
            )}
          </div>

          {/* Active Tab Panel */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === "account" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-ink">Account Profile</h3>
                  <p className="text-xs text-ink-muted">Organization identity and TMS dispatch preferences</p>
                </div>

                <form onSubmit={handleSaveAccountProfile} className="space-y-4 max-w-lg">
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">Company Name</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-border text-xs bg-white focus:outline-none focus:border-brand font-medium text-ink"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">SCAC / DOT Carrier Number</label>
                    <input
                      type="text"
                      value={scac}
                      onChange={(e) => setScac(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-border text-xs bg-white focus:outline-none focus:border-brand font-medium text-ink"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">Default Auto-Tender Protocol</label>
                    <select
                      value={autoTenderProtocol}
                      onChange={(e) => setAutoTenderProtocol(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-border text-xs bg-white focus:outline-none focus:border-brand font-medium text-ink"
                    >
                      <option value="Lowest Rate First (Waterfall Routing)">Lowest Rate First (Waterfall Routing)</option>
                      <option value="Highest On-Time Performance (KPI Routing)">Highest On-Time Performance (KPI Routing)</option>
                      <option value="Broadcast to All Contracted Carriers">Broadcast to All Contracted Carriers</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">Dispatch Contact Email</label>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-border text-xs bg-white focus:outline-none focus:border-brand font-medium text-ink"
                    />
                  </div>

                  {saveStatus === "success" && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center space-x-2 font-medium">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Account profile saved successfully!</span>
                    </div>
                  )}

                  {saveStatus === "error" && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center space-x-2 font-medium">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>{errorMessage || "Failed to save account profile."}</span>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-5 py-2.5 bg-brand text-white rounded-xl text-xs font-bold shadow-xs hover:bg-brand-hover transition-colors flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
                    >
                      {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>{isSaving ? "Saving Changes..." : "Save Account Profile"}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === "users" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-ink">User & Member Management</h3>
                    <p className="text-xs text-ink-muted">Manage team members, grant role privileges (e.g. Billing), and invite new users.</p>
                  </div>
                  <a href="/admin/users" className="px-3 py-1.5 bg-brand text-white rounded-xl text-xs font-bold hover:bg-brand-hover shadow-xs transition-colors">
                    Full User Management Page →
                  </a>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs space-y-2">
                  <p className="font-bold text-amber-900 flex items-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Granting Module Privileges (e.g. Billing, Dispatch, Rate Cards)</span>
                  </p>
                  <p className="text-amber-800 leading-relaxed">
                    To grant a team member access to Billing or special modules, assign them the <span className="font-bold">OWNER</span>, <span className="font-bold">ADMIN</span>, or <span className="font-bold">TMS_BILLING_MANAGER</span> role on the Full User Management Page.
                  </p>
                </div>

                <div className="border border-border rounded-xl overflow-hidden bg-white shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-muted border-b border-border font-semibold text-ink">
                      <tr>
                        <th className="p-3">User & Email</th>
                        <th className="p-3">Assigned Role</th>
                        <th className="p-3">Module Access</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr>
                        <td className="p-3">
                          <p className="font-bold text-ink">Platform Admin / Owner</p>
                          <p className="text-[11px] text-ink-muted font-mono">admin@qubere.ai</p>
                        </td>
                        <td className="p-3 font-semibold text-brand">OWNER</td>
                        <td className="p-3 text-emerald-700 font-medium">All Modules (Full Access)</td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">Active</span></td>
                      </tr>
                      <tr>
                        <td className="p-3">
                          <p className="font-bold text-ink">Freight Finance Team</p>
                          <p className="text-[11px] text-ink-muted font-mono">finance@qubere.ai</p>
                        </td>
                        <td className="p-3 font-semibold text-ink">TMS_BILLING_MANAGER</td>
                        <td className="p-3 text-ink-muted">Billing, Invoices, Rate Cards</td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">Active</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "roles" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-ink">Roles & Permissions</h3>
                  <p className="text-xs text-ink-muted">Role definitions and fine-grained authorization levels</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-border bg-white">
                    <h4 className="font-bold text-xs text-ink mb-1">OWNER / DISPATCHER</h4>
                    <p className="text-[11px] text-ink-muted mb-3">Full administrative access to dispatching, rate negotiations, and billing.</p>
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">All Permissions Granted</span>
                  </div>
                  <div className="p-4 rounded-xl border border-border bg-white">
                    <h4 className="font-bold text-xs text-ink mb-1">FINANCE & AUDITOR</h4>
                    <p className="text-[11px] text-ink-muted mb-3">Access to 3-way invoice matching, billing approval, and audit logs.</p>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[10px] font-bold">Finance & Billing Only</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "settings" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-ink">System Settings & Audit Log</h3>
                  <p className="text-xs text-ink-muted">Audit trail of all autonomous dispatch actions and rate approvals</p>
                </div>
                <div className="border border-border rounded-xl p-4 bg-white space-y-3">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-border">
                    <span className="font-semibold text-ink">Auto-Approve Rate Quotes below Target +5%</span>
                    <input type="checkbox" defaultChecked className="rounded border-border text-brand" />
                  </div>
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-border">
                    <span className="font-semibold text-ink">Automated 3-Way Invoice Audit Tolerance</span>
                    <span className="text-xs font-bold text-brand">$15.00 Threshold</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "integrations" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-ink">Carrier & System Integrations</h3>
                    <p className="text-xs text-ink-muted">Manage real provider connections and operational health</p>
                  </div>
                  <a href="/admin/integrations" className="px-3 py-1.5 bg-brand text-white rounded-xl text-xs font-bold hover:bg-brand-hover">
                    Manage All Integrations →
                  </a>
                </div>
                <div className="rounded-xl border border-dashed border-border bg-surface-muted/50 p-5">
                  <p className="text-xs font-bold text-ink">Connection status comes from the integration database.</p>
                  <p className="mt-1 text-[11px] leading-5 text-ink-muted">Open the integrations workspace to view configured providers, tenant/client scope, callback URLs, secret references, freshness, and errors.</p>
                </div>
              </div>
            )}

            {activeTab === "documentEmail" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-ink">Inbound Freight Email Ingestion</h3>
                  <p className="text-xs text-ink-muted">Automated AI extraction for incoming Rate Confirmation & BOL emails</p>
                </div>
                <div className="p-4 rounded-xl border border-border bg-surface-muted/50">
                  <p className="text-xs font-bold text-ink mb-1">Your Dedicated Inbound Email Address:</p>
                  <code className="text-xs font-mono bg-white px-3 py-2 rounded-lg border border-border block text-brand select-all">
                    freight-docs-acme@inbound.qubere.ai
                  </code>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
