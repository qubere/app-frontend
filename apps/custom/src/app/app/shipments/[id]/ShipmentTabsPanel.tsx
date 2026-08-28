"use client";

import { useCallback, useState, useEffect, type ReactNode } from "react";
import { Activity, FileText, Layers, Route, UserCheck } from "lucide-react";

type ShipmentTab = "workspace" | "tracking" | "client-actions" | "filing" | "audit";

interface ShipmentTabsPanelProps {
  initialTab: string;
  auditCount: number;
  clientActionCount?: number;
  workspaceContent: ReactNode;
  trackingContent: ReactNode;
  clientActionsContent: ReactNode;
  filingContent: ReactNode;
  auditContent: ReactNode;
}

function normalizeTab(tab: string): ShipmentTab {
  if (tab === "tracking" || tab === "client-actions" || tab === "filing" || tab === "audit") {
    return tab;
  }
  if (
    tab === "line-items" ||
    tab === "lineItems" ||
    tab === "line_items" ||
    tab === "verified-line-items"
  ) {
    return "filing";
  }
  return "workspace";
}

/**
 * Switches between the shipment detail page's tabs client-side.
 */
export function ShipmentTabsPanel({
  initialTab,
  auditCount,
  clientActionCount = 0,
  workspaceContent,
  trackingContent,
  clientActionsContent,
  filingContent,
  auditContent,
}: ShipmentTabsPanelProps) {
  const [activeTab, setActiveTab] = useState<ShipmentTab>(() => normalizeTab(initialTab));

  const selectTab = useCallback((tab: ShipmentTab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("view", tab);
    window.history.replaceState(null, "", url);
  }, []);

  useEffect(() => {
    const handleSwitchTab = (e: Event) => {
      const customEvent = e as CustomEvent<{ tab: ShipmentTab; scrollId?: string }>;
      if (customEvent.detail?.tab) {
        selectTab(customEvent.detail.tab);
        if (customEvent.detail.scrollId) {
          setTimeout(() => {
            const el = document.getElementById(customEvent.detail.scrollId!);
            if (el) {
              el.scrollIntoView({ behavior: "smooth" });
            }
          }, 50);
        }
      }
    };

    window.addEventListener("qubere:switch-tab", handleSwitchTab);
    return () => {
      window.removeEventListener("qubere:switch-tab", handleSwitchTab);
    };
  }, [selectTab]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
        <button
          type="button"
          onClick={() => selectTab("workspace")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === "workspace" ? "bg-brand text-white" : "bg-slate-100 text-ink-muted hover:text-ink"
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Operational Workspace</span>
        </button>

        <button
          type="button"
          onClick={() => selectTab("tracking")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === "tracking" ? "bg-brand text-white" : "bg-slate-100 text-ink-muted hover:text-ink"
          }`}
        >
          <Route className="w-3.5 h-3.5" />
          <span>Tracking</span>
        </button>

        {/* Client Actions Pill right next to Tracking */}
        <button
          type="button"
          onClick={() => selectTab("client-actions")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === "client-actions"
              ? "bg-brand text-white"
              : clientActionCount > 0
              ? "bg-amber-100 text-amber-900 border border-amber-300 font-extrabold hover:bg-amber-200"
              : "bg-slate-100 text-ink-muted hover:text-ink"
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Client Actions {clientActionCount > 0 && `(${clientActionCount})`}</span>
        </button>

        <button
          type="button"
          onClick={() => selectTab("filing")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === "filing" ? "bg-brand text-white" : "bg-slate-100 text-ink-muted hover:text-ink"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Filing Data</span>
        </button>

        <button
          type="button"
          onClick={() => selectTab("audit")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === "audit" ? "bg-brand text-white" : "bg-slate-100 text-ink-muted hover:text-ink"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Agent Executions & Audit Log ({auditCount})</span>
        </button>
      </div>

      <div key={activeTab} className="space-y-6">
        {activeTab === "filing"
          ? filingContent
          : activeTab === "tracking"
            ? trackingContent
            : activeTab === "client-actions"
              ? clientActionsContent
              : activeTab === "workspace"
                ? workspaceContent
                : auditContent}
      </div>
    </div>
  );
}
