"use client";
import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { dialogSurfaceProps, useDialogFocus } from "@/lib/useDialogFocus";

export function DrawerShell({ open, title, onClose, children, footer, busy = false, closeLabel = "Close drawer" }: {
  open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; busy?: boolean; closeLabel?: string;
}) {
  const titleId = useId();
  const ref = useDialogFocus<HTMLDivElement>(open, () => { if (!busy) onClose(); });
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = original; };
  }, [open]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/25">
      <div ref={ref} {...dialogSurfaceProps(titleId)} className="flex h-[100dvh] w-full max-w-2xl flex-col border-l border-border bg-white shadow-2xl outline-none">
        <header className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-ink">{title}</h2>
          <button type="button" aria-label={closeLabel} disabled={busy} onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100 disabled:opacity-40"><X size={20}/></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">{children}</div>
        {footer && <footer className="shrink-0 border-t border-border bg-white px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</footer>}
      </div>
    </div>, document.body,
  );
}
