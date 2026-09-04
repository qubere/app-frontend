"use client";

import { useState } from "react";
import { ExternalLink, HelpCircle } from "lucide-react";

export function HelpMenu() {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenGuideInNewTab = () => {
    window.open("/guide", "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="relative flex items-center shrink-0"
      onKeyDown={(e) => {
        if (e.key === "Escape") setIsOpen(false);
      }}
    >
      <button
        onClick={() => {
          handleOpenGuideInNewTab();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setIsOpen((prev) => !prev);
        }}
        className="p-2 rounded-full hover:bg-surface-muted transition-colors cursor-pointer text-ink-muted hover:text-brand"
        aria-label="TMS User Guide & Feature Index (Opens in new tab)"
        title="Open TMS User Guide & How-To (Opens in new tab)"
      >
        <HelpCircle className="w-5 h-5" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div
            role="menu"
            aria-label="Help Options"
            className="absolute right-0 top-full mt-2 w-64 bg-white border border-border rounded-2xl shadow-lg z-20 overflow-hidden p-1.5 space-y-1"
          >
            <a
              role="menuitem"
              href="/guide"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-bold text-ink hover:bg-brand/10 hover:text-brand transition-colors cursor-pointer"
            >
              <span>TMS User Guide & How-To</span>
              <ExternalLink className="w-3.5 h-3.5 text-brand shrink-0" aria-hidden="true" />
            </a>

            <a
              role="menuitem"
              href="/admin/integrations/api-docs"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-medium text-ink hover:bg-surface-muted transition-colors cursor-pointer"
            >
              <span>API Docs & Webhooks</span>
              <ExternalLink className="w-3.5 h-3.5 text-ink-muted shrink-0" aria-hidden="true" />
            </a>

            <a
              role="menuitem"
              href="https://qubere.ai"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-medium text-ink hover:bg-surface-muted transition-colors cursor-pointer"
            >
              <span>About Qubere Platform</span>
              <ExternalLink className="w-3.5 h-3.5 text-ink-muted shrink-0" aria-hidden="true" />
            </a>
          </div>
        </>
      )}
    </div>
  );
}
