"use client";

import { useState } from "react";
import { ShieldAlert, LogOut, Clock } from "lucide-react";

interface ImpersonationBannerProps {
  actorUserName: string;
  effectiveUserName: string;
  accountName: string;
  reason?: string;
  expiresAt?: string | Date;
  onExit?: () => void;
}

export function ImpersonationBanner({
  actorUserName,
  effectiveUserName,
  accountName,
  reason,
  expiresAt,
  onExit,
}: ImpersonationBannerProps) {
  const [exiting, setExiting] = useState(false);

  const handleExit = async () => {
    setExiting(true);
    try {
      if (onExit) {
        onExit();
      } else {
        const res = await fetch("/api/platform-admin/impersonate/end", { method: "POST" });
        if (res.ok) {
          window.location.href = "/platform-admin";
        } else {
          alert("Failed to exit impersonation session");
        }
      }
    } catch (err) {
      console.error(err);
      alert("Error exiting impersonation session");
    } finally {
      setExiting(false);
    }
  };

  return (
    <div className="bg-amber-600 border-b border-amber-700 text-white px-4 py-2.5 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm font-semibold z-50">
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-800/80 text-white ring-2 ring-amber-300/40 animate-pulse">
          <ShieldAlert className="h-4 w-4" />
        </span>
        <div>
          <span className="font-extrabold uppercase tracking-wide bg-amber-800/90 px-2 py-0.5 rounded text-[11px] mr-2">
            IMPERSONATING {effectiveUserName}
          </span>
          <span className="text-amber-100">
            Admin: <strong className="text-white font-bold">{actorUserName}</strong> &bull; Organization: <strong className="text-white font-bold">{accountName}</strong>
          </span>
          {reason && (
            <span className="hidden md:inline text-amber-200/90 ml-2 italic text-xs">
              (&quot;{reason}&quot;)
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {expiresAt && (
          <span className="hidden lg:flex items-center gap-1 text-xs text-amber-100 bg-amber-800/50 px-2.5 py-1 rounded">
            <Clock className="h-3.5 w-3.5" />
            Expires {new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <button
          onClick={handleExit}
          disabled={exiting}
          className="inline-flex items-center gap-1.5 bg-white text-amber-950 hover:bg-amber-50 active:bg-amber-100 font-extrabold px-3 py-1.5 rounded text-xs shadow transition-all cursor-pointer disabled:opacity-50"
        >
          <LogOut className="h-3.5 w-3.5" />
          {exiting ? "EXITING..." : "EXIT IMPERSONATION"}
        </button>
      </div>
    </div>
  );
}
