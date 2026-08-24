"use client";

import { useState, useEffect, type ReactNode } from "react";
import { Activity, FileText, Layers, Route } from "lucide-react";

type ShipmentTab = "workspace" | "tracking" | "filing" | "audit";

interface ShipmentTabsPanelProps {
  initialTab: string;
  auditCount: number;
  workspaceContent: ReactNode;
  trackingContent: ReactNode;
  filingContent: ReactNode;
  auditContent: ReactNode;
}

function normalizeTab(tab: string): ShipmentTab {
  if (tab === "tracking" || tab === "filing" || tab === "audit") {
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
 * Switches between the shipment detail page's four tabs entirely
 * client-side.
 */
export function ShipmentTabsPanel({
  initialTab,
  auditCount,
  workspaceContent,
  trackingContent,
  filingContent,
  auditContent,
}: ShipmentTabsPanelProps) {
  const [activeTab, setActiveTab] = useState<ShipmentTab>(() => normalizeTab(initialTab));

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
  }, []);

  const selectTab = (tab: ShipmentTab) => {
    setActiveTab(tab);
    // Keeps the URL shareable/deep-linkable without going through the
    // router -- a router navigation here is exactly the full-page
    // re-render this component exists to avoid.
    const url = new URL(window.location.href);
    url.searchParams.set("view", tab);
    window.history.replaceState(null, "", url);
  };

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
            : activeTab === "workspace"
              ? workspaceContent
              : auditContent}
      </div>
    </div>
  );
}


