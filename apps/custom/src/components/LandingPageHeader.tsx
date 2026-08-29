"use client";

import { useState } from "react";
import Link from "next/link";
import { Code2, Bot } from "lucide-react";
import { ApiStatusDrawer } from "./ApiStatusDrawer";
import { QubereLogo } from "./QubereLogo";

import { useLanguage } from "@/lib/i18n/LanguageContext";

export function LandingPageHeader() {
  const [isApiDrawerOpen, setIsApiDrawerOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <>
      <header className="sticky top-0 z-50 bg-surface-muted/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            aria-label="Qubere home"
            className="flex items-center rounded-md transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <QubereLogo
              className="text-xl text-ink"
              markClassName="h-9 w-9"
            />
          </Link>

          <nav className="flex items-center space-x-3">
            <button
              onClick={() => setIsApiDrawerOpen(true)}
              className="px-4 py-2 text-sm font-bold bg-white hover:bg-slate-50 text-brand border border-border rounded-full shadow-2xs transition-all flex items-center space-x-1.5 cursor-pointer hover:scale-105"
            >
              <Code2 className="w-4 h-4" />
              <span>{t.header.apiButton}</span>
            </button>

            <Link
              href="/agents"
              className="px-4 py-2 text-sm font-bold bg-white hover:bg-slate-50 text-brand border border-border rounded-full shadow-2xs transition-all flex items-center space-x-1.5 cursor-pointer hover:scale-105"
            >
              <Bot className="w-4 h-4" />
              <span>{t.header.agentsButton}</span>
            </Link>

            <Link
              href="/sign-in"
              className="px-4 py-2 text-sm font-medium bg-brand hover:bg-brand-hover text-white rounded-full shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {t.header.signIn}
            </Link>
          </nav>
        </div>
      </header>

      <ApiStatusDrawer isOpen={isApiDrawerOpen} onClose={() => setIsApiDrawerOpen(false)} />
    </>
  );
}
