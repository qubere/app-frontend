"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2, ChevronRight, FileCheck2, Files, ListChecks, Menu,
  Package, PanelLeftClose, PanelLeftOpen, ReceiptText, Truck,
  UserRound, X, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { QubereLogo } from "@/components/QubereLogo";

type NavItem = { label: string; href: string; icon: LucideIcon; activePaths?: string[] };
type NavSection = { id: string; label: string; items: NavItem[] };
interface PortalSidebarProps {
  hasCustomsAccess: boolean;
  hasTmsAccess: boolean;
  clients: { id: string; name: string }[];
  userName: string;
  userEmail: string;
}

const actions: NavItem = { label: "Actions", href: "/", icon: ListChecks, activePaths: ["/requests"] };
const profile: NavItem = { label: "Profile & security", href: "/settings/profile", icon: UserRound };
const matches = (pathname: string, item: NavItem) =>
  [item.href, ...(item.activePaths ?? [])].some(path => pathname === path || (path !== "/" && pathname.startsWith(`${path}/`)));

export function PortalSidebar({ hasCustomsAccess, hasTmsAccess, clients, userName, userEmail }: PortalSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const asideRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const sections: NavSection[] = [
    {
      id: "operations", label: "Operations", items: [
        ...(hasCustomsAccess ? [{ label: "Shipments", href: "/shipments", icon: Package }] : []),
        ...(hasTmsAccess ? [{ label: "Freight", href: "/freight", icon: Truck }] : []),
        { label: "Documents", href: "/documents", icon: Files },
      ],
    },
    ...(hasCustomsAccess ? [{
      id: "compliance", label: "Compliance", items: [
        { label: "Entry Proofs", href: "/compliance", icon: FileCheck2, activePaths: ["/entries"] },
      ],
    }] : []),
    { id: "billing", label: "Billing", items: [{ label: "Invoices", href: "/invoices", icon: ReceiptText }] },
    ...(hasCustomsAccess ? [{
      id: "company", label: "Your company", items: [
        { label: "Your setup", href: "/setup", icon: Building2, activePaths: ["/onboarding"] },
      ],
    }] : []),
  ];
  const activeSectionId = sections.find(section => section.items.some(item => matches(pathname, item)))?.id;
  const [expandedId, setExpandedId] = useState<string | null>(activeSectionId ?? "operations");
  const compact = collapsed && !mobileOpen;
  const clientLabel = clients.length === 1 ? clients[0].name : clients.length ? `${clients.length} client accounts` : "Client portal";

  useEffect(() => {
    setMobileOpen(false);
    setExpandedId(activeSectionId ?? "operations");
  }, [pathname, activeSectionId]);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem("qubere.portal.nav.collapsed") === "true"); } catch { /* Storage is optional. */ }
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setMobileOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMobileOpen(false); return; }
      if (event.key !== "Tab") return;
      const controls = Array.from(asideRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [])
        .filter(element => element.offsetParent !== null);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      menuButtonRef.current?.focus();
    };
  }, [mobileOpen]);

  function renderItem(item: NavItem) {
    const active = matches(pathname, item);
    const Icon = item.icon;
    return (
      <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
        aria-current={active ? "page" : undefined} aria-label={item.label}
        title={compact ? item.label : undefined}
        className={cn(
          "flex items-center rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
          compact ? "justify-center" : "gap-3",
          active ? "border border-border bg-white font-semibold text-brand shadow-sm" : "border border-transparent text-ink hover:bg-white/60 hover:text-brand",
        )}>
        <Icon aria-hidden="true" className={cn("h-4 w-4 shrink-0", active ? "text-brand" : "text-ink-muted")} />
        {!compact && <span className="truncate">{item.label}</span>}
      </Link>
    );
  }

  return (
    <>
      <button ref={menuButtonRef} type="button" onClick={() => setMobileOpen(true)}
        aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls="portal-navigation"
        className="fixed left-3 top-3 z-40 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-white text-ink shadow-sm lg:hidden">
        <Menu className="h-5 w-5" />
      </button>
      {mobileOpen && <div onClick={() => setMobileOpen(false)} aria-hidden="true" className="fixed inset-0 z-40 bg-black/30 lg:hidden" />}
      <aside ref={asideRef} id="portal-navigation" aria-label="Client navigation"
        role={mobileOpen ? "dialog" : undefined} aria-modal={mobileOpen || undefined}
        className={cn(
          "fixed inset-y-0 left-0 z-50 h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface-muted lg:sticky lg:top-0 lg:z-40",
          mobileOpen ? "flex" : "hidden lg:flex", compact ? "lg:w-20" : "lg:w-64",
        )}>
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
          <Link href="/" aria-label="Qubere client portal" onClick={() => setMobileOpen(false)}
            className="min-w-0 rounded-md transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
            <QubereLogo className="min-w-0 truncate text-xl text-ink" showWordmark={!compact} />
          </Link>
          <button ref={closeButtonRef} type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-white lg:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!compact && <div className="mx-3 my-4 rounded-xl border border-border bg-white px-3 py-3">
          <div className="flex items-center gap-2.5">
            <Building2 aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-muted" />
            <div className="min-w-0"><p className="truncate text-sm font-semibold text-ink" title={clientLabel}>{clientLabel}</p>
              <p className="mt-0.5 text-[11px] text-ink-muted">Client portal</p>
            </div>
          </div>
        </div>}

        <div className={cn("flex-1 space-y-4 overflow-y-auto px-3 py-2", compact && "pt-4")}>
          <nav aria-label="Actions">{renderItem(actions)}</nav>
          {sections.map(section => {
            const open = compact || expandedId === section.id;
            return <div key={section.id}>
              {!compact && <button type="button" onClick={() => setExpandedId(open ? null : section.id)}
                aria-expanded={open} aria-controls={`portal-nav-${section.id}`}
                className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-muted transition-colors hover:bg-white/60 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                {section.label}<ChevronRight aria-hidden="true" className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
              </button>}
              <nav id={`portal-nav-${section.id}`} aria-label={section.label} hidden={!open} className={cn("space-y-1", !compact && "mt-1")}>
                {section.items.map(renderItem)}
              </nav>
            </div>;
          })}
        </div>

        <div className="shrink-0 border-t border-border bg-white/40 p-3">
          {renderItem(profile)}
          {!compact && <div className="px-3 pb-2 pt-3">
            <p className="truncate text-xs font-semibold text-ink">{userName || "Your account"}</p>
            <p className="mt-0.5 truncate text-[11px] text-ink-muted">{userEmail}</p>
          </div>}
          <button type="button" onClick={() => setCollapsed(value => {
            const next = !value;
            try { localStorage.setItem("qubere.portal.nav.collapsed", String(next)); } catch { /* Storage is optional. */ }
            return next;
          })} aria-label={compact ? "Expand navigation" : "Collapse navigation"}
            className="mt-1 hidden w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-ink-muted transition-colors hover:bg-white hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand lg:flex">
            {compact ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!compact && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
