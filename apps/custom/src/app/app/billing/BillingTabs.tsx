"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface BillingTab {
  name: string;
  href: string;
}

export function BillingTabs({ tabs }: { tabs: BillingTab[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Billing sections" className="flex items-center gap-1.5 border-b border-[#E5E5EA] pb-3 overflow-x-auto scrollbar-none">
      {tabs.map((tab) => {
        const isActive = tab.href === "/app/billing"
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 whitespace-nowrap ${
              isActive
                ? "bg-white text-ink shadow-sm border border-[#E5E5EA]"
                : "text-ink-muted hover:text-ink hover:bg-slate-100/60"
            }`}
          >
            {tab.name}
          </Link>
        );
      })}
    </nav>
  );
}
