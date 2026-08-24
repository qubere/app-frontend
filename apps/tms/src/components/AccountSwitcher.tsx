"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Check, UserCheck, LogOut, Loader2, Building2 } from "lucide-react";

interface AccountSwitcherProps {
  currentAccountId?: string;
  currentAccountName?: string;
  currentAccountType?: string;
  currentDataMode?: string;
  currentRoleNames?: string[];
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

export function AccountSwitcher({
  currentAccountId = "",
  currentAccountName = "Enterprise Freight",
  currentAccountType = "ENTERPRISE",
  currentDataMode = "PRODUCTION",
  currentRoleNames = ["MEMBER"],
  memberships = [],
  isImpersonating = false,
  actorUserName = "Frank Multiaccount",
  effectiveUserName,
  effectiveEmail,
}: AccountSwitcherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isEndingImpersonation, setIsEndingImpersonation] = useState(false);

  // Filter out test-suite / scratch accounts so the list shows clean enterprise company workspaces
  const filteredMemberships = memberships.filter((m) => {
    const name = m.accountName.toLowerCase();
    return (
      !name.startsWith("acc_test") &&
      !name.startsWith("acc_cpe") &&
      !name.startsWith("acc_cta") &&
      !name.includes("test account") &&
      !name.includes("ssa test") &&
      !name.includes("cpe test") &&
      !name.includes("response tab") &&
      !name.includes("filing test") &&
      !name.includes("tenant a") &&
      !name.includes("tenant b")
    );
  });

  const availableMemberships = filteredMemberships.length > 0 ? filteredMemberships : memberships;

  const handleEndImpersonation = async () => {
    setIsEndingImpersonation(true);
    try {
      const res = await fetch("/api/platform-admin/impersonate/end", { method: "POST" });
      if (res.ok) {
        setIsOpen(false);
        router.refresh();
        window.location.reload();
      } else {
        window.location.reload();
      }
    } catch (err) {
      console.error("Failed to end impersonation session:", err);
    } finally {
      setIsEndingImpersonation(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2.5 bg-white border border-border rounded-2xl flex items-center justify-between hover:border-brand/50 shadow-2xs transition-all text-left cursor-pointer"
      >
        <div className="flex items-center space-x-3 overflow-hidden">
          <div
            className={`w-7 h-7 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 ${
              currentAccountType === "ENTERPRISE"
                ? "bg-blue-50 text-brand border border-blue-100"
                : "bg-purple-50 text-purple-600 border border-purple-100"
            }`}
          >
            {currentAccountName.slice(0, 2).toUpperCase()}
          </div>
          <div className="truncate">
            <p className="text-xs font-bold text-ink truncate">{currentAccountName}</p>
            <div className="flex items-center space-x-1.5 mt-0.5 flex-wrap gap-y-0.5">
              <span className="text-[10px] text-ink-muted font-mono uppercase">{currentAccountType}</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-50 text-brand font-semibold border border-blue-100">
                {currentRoleNames.join(", ")}
              </span>
              {isImpersonating && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-amber-50 text-amber-800 border border-amber-300 animate-pulse">
                  Impersonating
                </span>
              )}
            </div>
          </div>
        </div>
        <ChevronDown className="w-4 h-4 text-ink-muted shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 w-80 mt-2 bg-white border border-border rounded-2xl shadow-xl z-50 p-2.5 space-y-2">
          {/* Impersonation Session Section */}
          {isImpersonating && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 flex items-center space-x-1">
                  <UserCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Impersonation Session Active</span>
                </span>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
              </div>

              <div>
                <p className="text-xs font-black text-ink">
                  {effectiveUserName || "Impersonated User"}
                </p>
                {effectiveEmail && (
                  <p className="text-[11px] font-mono text-ink-muted">{effectiveEmail}</p>
                )}
              </div>

              <button
                type="button"
                onClick={handleEndImpersonation}
                disabled={isEndingImpersonation}
                className="w-full mt-1 px-3 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-colors flex items-center justify-center space-x-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
              >
                {isEndingImpersonation ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <LogOut className="w-3.5 h-3.5" />
                )}
                <span>Switch Back to {actorUserName || "Frank Multiaccount"}</span>
              </button>
            </div>
          )}

          {/* Workspaces List Section */}
          <div className="space-y-1">
            <p className="px-2 py-1 text-[10px] font-bold text-ink-muted uppercase tracking-wider flex items-center justify-between">
              <span>Your Enterprise Workspaces</span>
              <span className="text-[10px] font-mono text-brand font-bold bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100">
                {availableMemberships.length} Workspaces
              </span>
            </p>

            <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
              {availableMemberships.map((m) => {
                const isCurrent = m.accountId === currentAccountId || m.accountName === currentAccountName;
                return (
                  <button
                    key={m.accountId}
                    onClick={() => {
                      setIsOpen(false);
                      router.refresh();
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                      isCurrent ? "bg-blue-50 font-bold text-brand border border-blue-100" : "hover:bg-surface-muted text-ink"
                    }`}
                  >
                    <div className="truncate flex items-center space-x-2 min-w-0">
                      <Building2 className="w-3.5 h-3.5 text-brand shrink-0" />
                      <span className="truncate font-semibold">{m.accountName}</span>
                    </div>
                    {isCurrent && <Check className="w-4 h-4 text-brand shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
