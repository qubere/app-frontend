"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { Building2, Bot, Settings2, LogOut, UserCog } from "lucide-react";
import { ManageAccountModal } from "./ManageAccountModal";
import { HelpMenu } from "./HelpMenu";
import { NotificationBell } from "./NotificationBell";

interface TmsHeaderProps {
  tenantName?: string;
  userName?: string;
  isPlatformAdmin?: boolean;
  roleNames?: string[];
}

export function TmsHeader({
  tenantName = "Enterprise Freight",
  userName = "User",
  isPlatformAdmin: _isPlatformAdmin = false,
  roleNames: _roleNames = ["OWNER"],
}: TmsHeaderProps) {
  const router = useRouter();
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isManageAccountOpen, setIsManageAccountOpen] = useState(false);

  const menuActions = [
    { label: "Manage Account", icon: Settings2, onClick: () => setIsManageAccountOpen(true) },
    { label: "Profile & Security", icon: UserCog, onClick: () => openUserProfile() },
    { label: "AI Agents Roster & Testing", icon: Bot, onClick: () => router.push("/chat") },
  ];

  return (
    <header className="h-16 shrink-0 border-b border-border bg-surface-muted/80 backdrop-blur-md px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 z-30">
      {/* Left: Tenant Indicator */}
      <div className="flex items-center min-w-0">
        <div className="flex items-center space-x-2 text-ink-muted text-sm font-medium min-w-0">
          <Building2 className="w-4 h-4 shrink-0 text-brand" />
          <span className="text-ink font-semibold truncate" title={tenantName}>
            {tenantName}
          </span>
          <span className="text-ink-muted shrink-0">/</span>
          <span className="text-ink-muted text-xs px-2.5 py-0.5 rounded-full bg-white border border-border font-medium shadow-2xs shrink-0 whitespace-nowrap">
            Verified Organization
          </span>
        </div>
      </div>

      {/* Right: Help, Notifications & Avatar Dropdown */}
      <div className="flex items-center gap-1 shrink-0">
        <HelpMenu />
        <NotificationBell />

        <div className="relative flex items-center shrink-0">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center space-x-2.5 pl-1 pr-2.5 py-1 rounded-full hover:bg-white/70 transition-colors cursor-pointer"
          >
            {user?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.imageUrl}
                alt=""
                className="w-8 h-8 rounded-full border border-border shadow-xs object-cover"
              />
            ) : (
              <div
                aria-hidden="true"
                className="w-8 h-8 rounded-full border border-border shadow-xs bg-brand/10 text-brand flex items-center justify-center text-xs font-bold"
              >
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-xs font-semibold text-ink hidden sm:inline">{userName}</span>
            <span className="sr-only sm:hidden">{userName}</span>
          </button>

          {isMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-border rounded-2xl shadow-lg z-20 overflow-hidden">
                <div className="p-4 border-b border-border flex items-center space-x-3">
                  {user?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.imageUrl}
                      alt={userName}
                      className="w-10 h-10 rounded-full border border-border object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full border border-border bg-brand/10 text-brand flex items-center justify-center text-sm font-bold">
                      {userName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{userName}</p>
                    <p className="text-xs text-ink-muted truncate">
                      {user?.primaryEmailAddress?.emailAddress ?? "user@qubere.ai"}
                    </p>
                  </div>
                </div>

                <div className="p-1.5">
                  {menuActions.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => {
                        setIsMenuOpen(false);
                        action.onClick();
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-left text-sm font-medium text-ink hover:bg-surface-muted transition-colors cursor-pointer"
                    >
                      <action.icon className="w-4 h-4 text-brand" />
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>

                <div className="p-1.5 border-t border-border">
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      signOut(() => router.push("/"));
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-left text-sm font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <ManageAccountModal
        isOpen={isManageAccountOpen}
        onClose={() => setIsManageAccountOpen(false)}
        accountName={tenantName}
      />
    </header>
  );
}
