"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldCheck,
  LayoutDashboard,
  Inbox,
  Scale,
  FileCheck2,
  Globe,
  Building2,
  Users,
  Settings,
  Shield,
  FileText,
  Files,
  Contact2,
  Package,
  Landmark,
  Menu,
  TriangleAlert,
  ListChecks,
  ChevronRight,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Coins,
  ReceiptText,
  Database,
  FileSignature,
  BookOpen,
  DollarSign,
  FileBarChart2,
  ClipboardList,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AccountSwitcher } from "./AccountSwitcher";
import { QubereLogo } from "./QubereLogo";
import { activeNavHref, visibleNavigation, type NavIcon } from "@/lib/navigation";
import { usePolling } from "@/lib/hooks/usePolling";

import { useLanguage } from "@/lib/i18n/LanguageContext";
import { dataModeFooterLabel, type DataMode } from "@/lib/dataMode";

const ICONS: Record<NavIcon, LucideIcon> = {
  inbox: Inbox,
  dashboard: LayoutDashboard,
  shipments: FileText,
  products: Package,
  parties: Landmark,
  clients: Contact2,
  importersOfRecord: Building2,
  bonds: ShieldCheck,
  poa: FileSignature,
  documents: Files,
  tradeRepository: Database,
  actions: ListChecks,
  decisions: Scale,
  exceptions: TriangleAlert,
  filing: FileCheck2,
  regulatory: Globe,
  account: Building2,
  users: Users,
  roles: ShieldCheck,
  settings: Settings,
  platform: Shield,
  vault: Coins,
  compliance: Scale,
  simulator: Scale,
  classification: Scale,
  postEntry: ReceiptText,
  tradeData: Database,
  tariffs: BookOpen,
  billing: DollarSign,
  reports: FileBarChart2,
  licenses: ShieldCheck,
  onboarding: ClipboardList,
  brokerCompliance: ShieldCheck,
  support: LifeBuoy,
};

interface SidebarProps {
  currentAccountId: string;
  accountName?: string;
  accountType?: string;
  roleNames?: string[];
  isPlatformAdmin?: boolean;
  permissions?: string[];
  dataMode?: DataMode;
  memberships?: Array<{
    accountId: string;
    accountName: string;
    accountType: string;
    dataMode?: string;
    roleNames: string[];
  }>;
  isImpersonating?: boolean;
  actorUserName?: string;
  effectiveUserName?: string;
  effectiveEmail?: string;
}

export function Sidebar({
  currentAccountId,
  accountName = "Personal Workspace",
  accountType = "INDIVIDUAL",
  // Deny by default -- these gate what the user can see, so an absent prop must
  // never widen access (a former ["OWNER"] default showed non-owners nothing,
  // then briefly showed a propless render everything).
  roleNames = [],
  isPlatformAdmin = false,
  permissions = [],
  dataMode = "PRODUCTION",
  memberships = [],
  isImpersonating = false,
  actorUserName,
  effectiveUserName,
  effectiveEmail,
}: SidebarProps) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [pendingClassificationCount, setPendingClassificationCount] = useState(0);
  const [todayCount, setTodayCount] = useState(0);

  const fetchPendingClassification = useCallback(async () => {
    try {
      const res = await fetch("/api/documents/pending-classification", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setPendingClassificationCount(typeof data.count === "number" ? data.count : 0);
    } catch {
      // Silent — a failed poll just tries again next interval.
    }
  }, []);

  const fetchTodayCount = useCallback(async () => {
    try {
      const res = await fetch("/api/today/summary", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setTodayCount(typeof data.total === "number" ? data.total : 0);
    } catch {
      // Silent — a failed poll just tries again next interval.
    }
  }, []);

  usePolling(fetchPendingClassification, 60_000);
  usePolling(fetchTodayCount, 60_000);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const sections = visibleNavigation({ roleNames, permissions, isPlatformAdmin });

  const activeHref = activeNavHref(
    pathname,
    sections.flatMap((section) => section.items.map((item) => item.href))
  );

  const labels = t.nav as Record<string, string>;

  // --- Accordion: exactly one collapsible workspace open at a time ---------
  const collapsibleIds = sections.filter((s) => s.collapsible).map((s) => s.id);
  const collapsibleKey = collapsibleIds.join(",");
  const activeSectionId =
    sections.find((s) => s.collapsible && s.items.some((i) => i.href === activeHref))?.id ?? null;

  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    // The workspace holding the current route always wins. Otherwise keep the
    // user's last choice, then fall back to the first workspace.
    if (activeSectionId) {
      setExpandedId(activeSectionId);
      return;
    }
    setExpandedId((prev) => {
      if (prev && collapsibleIds.includes(prev)) return prev;
      try {
        const stored = window.localStorage.getItem("qubere.nav.expanded");
        if (stored && collapsibleIds.includes(stored)) return stored;
      } catch {
        // localStorage unavailable (private mode, SSR) -- use the default.
      }
      return collapsibleIds[0] ?? null;
    });
    // collapsibleKey stands in for the (stable) list of collapsible section ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSectionId, collapsibleKey]);

  const toggleSection = useCallback((id: string) => {
    setExpandedId((prev) => {
      const next = prev === id ? null : id;
      try {
        if (next) window.localStorage.setItem("qubere.nav.expanded", next);
      } catch {
        // Non-fatal -- the choice just will not persist across reloads.
      }
      return next;
    });
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
        aria-expanded={mobileOpen}
        aria-controls="primary-navigation"
        className="lg:hidden fixed top-3 left-3 z-50 w-10 h-10 rounded-xl bg-white border border-border shadow-sm flex items-center justify-center text-ink"
      >
        <Menu className="w-5 h-5" />
      </button>

      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-black/30"
          aria-hidden="true"
        />
      )}

      <aside
        id="primary-navigation"
        aria-label="Primary"
        className={cn(
          "bg-surface-muted border-r border-border flex flex-col h-screen z-40 transition-transform duration-200",
          "fixed inset-y-0 left-0 lg:sticky lg:top-0 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "w-20" : "w-64"
        )}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-border">
          <a
            href="/deck/index.html"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMobileOpen(false)}
            aria-label="Open Qubere pitch deck"
            className="flex items-center min-w-0 rounded-md transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            title="Open Qubere pitch deck"
          >
            <QubereLogo
              className="text-xl text-ink truncate min-w-0"
              markClassName="h-9 w-9"
              showWordmark={!collapsed}
            />
          </a>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
            className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:bg-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className={cn("px-3", collapsed ? "mt-4" : "mt-4")}>
          <Link
            href="/chat"
            onClick={() => setMobileOpen(false)}
            title={collapsed ? (labels.askQubere ?? "Ask Qubere") : undefined}
            className={cn(
              "group relative flex items-center rounded-xl bg-gradient-to-r from-brand to-[#5AC8FA] text-white shadow-sm shadow-brand/25 transition-all hover:shadow-md hover:shadow-brand/30 hover:-translate-y-px",
              collapsed ? "justify-center w-11 h-11 mx-auto" : "px-3 py-2.5 space-x-2.5"
            )}
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            {!collapsed && (
              <span className="text-sm font-semibold truncate">{labels.askQubere ?? "Ask Qubere"}</span>
            )}
          </Link>
        </div>

        {!collapsed && (
          <div className="px-3 my-4">
            <AccountSwitcher
              currentAccountId={currentAccountId}
              currentAccountName={accountName}
              currentAccountType={accountType}
              currentDataMode={dataMode}
              currentRoleNames={roleNames}
              memberships={
                memberships.length > 0
                  ? memberships
                  : [{ accountId: currentAccountId, accountName, accountType, dataMode, roleNames }]
              }
              isImpersonating={isImpersonating}
              actorUserName={actorUserName}
              effectiveUserName={effectiveUserName}
              effectiveEmail={effectiveEmail}
            />
          </div>
        )}

        <div className="flex-1 px-3 space-y-3 overflow-y-auto py-2">
          {sections.map((section) => {
            const sectionLabel = labels[section.labelKey] ?? section.labelKey;
            // Accordion only applies in the full-width rail. In the icon rail
            // every item shows as a flat, tooltipped list with no headers.
            const isAccordion = Boolean(section.collapsible) && !collapsed;
            const isOpen = !isAccordion || expandedId === section.id;
            const showHeader = !section.hideLabel && !collapsed;

            const itemList = (
              <nav className={cn("space-y-1", showHeader && isAccordion && "mt-1")}>
                {section.items.map((item) => {
                  const isActive = activeHref === item.href;
                  const Icon = ICONS[item.icon];
                  const label = labels[item.labelKey] ?? item.labelKey;
                  const badgeCount =
                    item.id === "documents"
                      ? pendingClassificationCount
                      : item.id === "actions"
                        ? todayCount
                        : (item.badge ?? 0);
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      aria-current={isActive ? "page" : undefined}
                      title={collapsed ? label : undefined}
                      className={cn(
                        "flex items-center px-3 py-2 rounded-xl text-sm font-medium transition-all",
                        collapsed ? "justify-center" : "space-x-3",
                        isActive
                          ? "bg-white text-brand shadow-sm border border-border font-semibold"
                          : "text-ink hover:text-brand hover:bg-white/60"
                      )}
                    >
                      <span className="relative shrink-0">
                        <Icon
                          className={cn("w-4 h-4", isActive ? "text-brand" : "text-ink-muted")}
                        />
                        {badgeCount > 0 && (
                          <span className="absolute -top-1 -right-1.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                            {badgeCount > 99 ? "99+" : badgeCount}
                          </span>
                        )}
                      </span>
                      {!collapsed && (
                        <span className="flex-1 flex items-center justify-between min-w-0">
                          <span className="truncate">{label}</span>
                          {badgeCount > 0 && (
                            <span className="ml-1.5 shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500/15 text-amber-700 text-[10px] font-bold flex items-center justify-center">
                              {badgeCount > 99 ? "99+" : badgeCount}
                            </span>
                          )}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            );

            return (
              <div key={section.id}>
                {showHeader &&
                  (isAccordion ? (
                    <button
                      type="button"
                      onClick={() => toggleSection(section.id)}
                      aria-expanded={isOpen}
                      className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider text-ink-muted hover:text-brand hover:bg-white/60 transition-colors"
                    >
                      <span className="truncate">{sectionLabel}</span>
                      <ChevronRight
                        className={cn(
                          "w-3.5 h-3.5 shrink-0 transition-transform",
                          isOpen && "rotate-90"
                        )}
                      />
                    </button>
                  ) : (
                    <p className="px-3 text-[11px] font-bold uppercase tracking-wider mb-2 text-ink-muted">
                      {sectionLabel}
                    </p>
                  ))}

                {isOpen && itemList}
              </div>
            );
          })}
        </div>

        <div className="p-3 border-t border-border bg-white/40">
          {!collapsed && (
            <div className="px-2 pb-2 text-xs text-ink-muted">
              <p className="font-semibold text-ink">Qubere AI Trade Platform</p>
              <p className="text-[11px] text-ink-muted">{dataModeFooterLabel(dataMode)}</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            className="hidden lg:flex w-full items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-ink-muted hover:text-brand hover:bg-white transition-colors"
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Persistent quick-access launcher — opens in a new tab so the
          current page (and any in-progress work) stays put. */}
      <a
        href="/chat"
        target="_blank"
        rel="noopener noreferrer"
        title={labels.askQubere ?? "Ask Qubere"}
        aria-label={labels.askQubere ?? "Ask Qubere"}
        className="group fixed bottom-5 right-5 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-brand to-[#5AC8FA] text-white shadow-lg shadow-brand/30 hover:shadow-xl hover:shadow-brand/40 hover:scale-105 transition-all"
      >
        <Sparkles className="w-6 h-6" />
        <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-lg bg-ink text-white text-xs font-medium px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {labels.askQubere ?? "Ask Qubere"}
        </span>
      </a>
    </>
  );
}
