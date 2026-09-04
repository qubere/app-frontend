"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Contact2, Building2, ShieldCheck, FileSignature, ClipboardCheck } from "lucide-react";

export const CLIENT_NAV_ITEMS = [
  {
    label: "Clients",
    href: "/app/clients",
    icon: Contact2,
  },
  {
    label: "Importers",
    href: "/app/importers",
    icon: Building2,
    view: "importers",
  },
  {
    label: "Bonds",
    href: "/app/importers?view=bonds",
    icon: ShieldCheck,
    view: "bonds",
  },
  {
    label: "POAs",
    href: "/app/importers?view=poa",
    icon: FileSignature,
    view: "poa",
  },
  {
    label: "Onboarding",
    href: "/app/onboarding",
    icon: ClipboardCheck,
  },
];

export function ClientNavTabs({ activeView = "importers" }: { activeView?: "importers" | "bonds" | "poa" }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-surface-muted/90 border border-border rounded-2xl w-max max-w-full shadow-xs">
      {CLIENT_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive =
          (item.view
            ? pathname.startsWith("/app/importers") && item.view === activeView
            : pathname === item.href || (item.href !== "/app/clients" && pathname.startsWith(item.href)));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              isActive
                ? "bg-white text-brand shadow-xs border border-border/60 font-bold"
                : "text-ink-muted hover:text-ink hover:bg-white/60"
            }`}
          >
            <Icon className={`w-4 h-4 ${isActive ? "text-brand" : "text-ink-muted"}`} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
