"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import {
  ShieldCheck,
  Building2,
  Bell,
  HelpCircle,
  Sparkles,
  LayoutDashboard,
  FileText,
  Truck,
  Files,
  Receipt,
  LogOut,
  UserCheck,
  ChevronDown,
} from "lucide-react";

interface UserProfile {
  name: string;
  email: string;
}

interface Capability {
  hasPorterView: boolean;
  hasCustomsAccess: boolean;
  hasTmsAccess: boolean;
  canUploadDocuments: boolean;
  canRespondRequests: boolean;
}

interface ClientScope {
  id: string;
  name: string;
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [accountId, setAccountId] = useState<string>("");
  const [capabilities, setCapabilities] = useState<Capability>({
    hasPorterView: true,
    hasCustomsAccess: true,
    hasTmsAccess: true,
    canUploadDocuments: true,
    canRespondRequests: true,
  });
  const [clients, setClients] = useState<ClientScope[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientScope | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          if (data.account?.id) setAccountId(data.account.id);
          if (data.capabilities) setCapabilities(data.capabilities);
          if (data.clients && data.clients.length > 0) {
            setClients(data.clients);
            setSelectedClient(data.clients[0]);
          }
        }
      })
      .catch(() => {});
  }, []);

  const userName = clerkUser?.fullName || clerkUser?.primaryEmailAddress?.emailAddress || user?.name || "Porter User";
  const userEmail = clerkUser?.primaryEmailAddress?.emailAddress || user?.email || "porter@client.com";

  const navItems = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard, visible: true },
    { label: "Customs Shipments", href: "/shipments", icon: FileText, visible: capabilities.hasCustomsAccess },
    { label: "TMS Freight", href: "/freight", icon: Truck, visible: capabilities.hasTmsAccess },
    { label: "Documents", href: "/documents", icon: Files, visible: true },
    { label: "Invoices", href: "/invoices", icon: Receipt, visible: true },
  ];

  return (
    <div className="min-h-screen flex bg-[#F5F5F7] text-[#1D1D1F]">
      {/* Qubere Left Sidebar Panel */}
      <aside className="w-64 bg-white border-r border-[#E5E5EA] flex flex-col justify-between shrink-0 fixed inset-y-0 left-0 z-40">
        <div>
          {/* Logo Section */}
          <div className="h-16 px-5 flex items-center border-b border-[#E5E5EA]">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="w-9 h-9 rounded-xl bg-[#0071E3] flex items-center justify-center text-white shadow-md shadow-[#0071E3]/20 group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-[#1D1D1F]">
                Qubere
              </span>
            </Link>
          </div>

          {/* Ask Qubere AI Button */}
          <div className="p-4">
            <button
              onClick={() => alert("Qubere AI Trade Compliance Assistant active.")}
              className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-[#0071E3] to-[#38bdf8] text-white font-semibold text-xs shadow-xs hover:shadow-md transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-white shrink-0" />
              <span>Ask Qubere</span>
            </button>
          </div>

          {/* Vertical Navigation Items */}
          <nav className="px-3 py-2 space-y-1">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#86868B]">
              Navigation
            </div>
            {navItems
              .filter((item) => item.visible)
              .map((item) => {
                const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-[#0071E3]/10 text-[#0071E3] font-bold"
                        : "text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#F5F5F7]"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-[#0071E3]" : "text-[#86868B]"}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
          </nav>
        </div>

        {/* User Context Footer in Sidebar */}
        <div className="p-4 border-t border-[#E5E5EA] bg-[#F5F5F7]/40">
          <div className="flex items-center space-x-3">
            {clerkUser?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={clerkUser.imageUrl}
                alt={userName}
                className="w-8 h-8 rounded-full border border-[#E5E5EA] shadow-xs object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#1D1D1F] truncate">{userName}</p>
              <p className="text-[10px] text-[#86868B] truncate">{userEmail}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Right Area */}
      <div className="flex-1 pl-64 flex flex-col min-w-0">
        {/* Qubere Top Navigation Header */}
        <header className="h-16 bg-white border-b border-[#E5E5EA] px-6 flex items-center justify-between sticky top-0 z-30">
          {/* Account Context & Isolation Badge */}
          <div className="flex items-center space-x-2 text-xs">
            <Building2 className="w-4 h-4 text-[#0071E3]" />
            {clients.length > 1 ? (
              <select
                value={selectedClient?.id || ""}
                onChange={(e) => {
                  const found = clients.find((c) => c.id === e.target.value);
                  if (found) setSelectedClient(found);
                }}
                className="font-bold text-[#1D1D1F] bg-transparent border-0 focus:outline-none cursor-pointer"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-bold text-[#1D1D1F]">
                {selectedClient?.name || "Target Corporation"}
              </span>
            )}
            <span className="text-[#86868B] font-light">/</span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium text-[#86868B] bg-[#F5F5F7] border border-[#E5E5EA]">
              Account Isolated
            </span>
          </div>

          {/* Right Header Utilities: Help, Notifications, Clerk User Avatar */}
          <div className="flex items-center space-x-4">
            {/* Help Menu */}
            <button
              onClick={() => alert("Qubere Customer Portal Knowledge Base & Support.")}
              aria-label="Help & Documentation"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition cursor-pointer"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                aria-label="Notifications"
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white font-bold text-[9px] flex items-center justify-center border-2 border-white">
                  4
                </span>
              </button>
            </div>

            {/* Clerk Avatar & User Menu Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center space-x-2.5 pl-1 pr-2 py-1 rounded-full hover:bg-[#F5F5F7] transition cursor-pointer"
              >
                {clerkUser?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={clerkUser.imageUrl}
                    alt={userName}
                    className="w-8 h-8 rounded-full border border-[#E5E5EA] shadow-xs object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-semibold text-[#1D1D1F] hidden md:inline">{userName}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#86868B]" />
              </button>

              {isMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-[#E5E5EA] rounded-2xl shadow-xl z-20 overflow-hidden">
                    <div className="p-4 border-b border-[#E5E5EA] flex items-center space-x-3">
                      {clerkUser?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={clerkUser.imageUrl}
                          alt={userName}
                          className="w-10 h-10 rounded-full border border-[#E5E5EA] object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold">
                          {userName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#1D1D1F] truncate">{userName}</p>
                        <p className="text-xs text-[#86868B] truncate">{userEmail}</p>
                      </div>
                    </div>

                    <div className="p-3 border-b border-[#E5E5EA] bg-[#F5F5F7]/50 text-xs space-y-1.5">
                      <div className="flex justify-between items-center text-[#86868B]">
                        <span>Permission Scope:</span>
                        <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          Porter View Active
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[#86868B]">
                        <span>Client Scope:</span>
                        <span className="font-semibold text-[#1D1D1F] truncate max-w-[140px]">
                          {selectedClient?.name || "Target Corporation"}
                        </span>
                      </div>
                    </div>

                    <div className="p-1.5 space-y-0.5">
                      <Link
                        href="/settings/profile"
                        onClick={() => setIsMenuOpen(false)}
                        className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-left text-sm font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] transition cursor-pointer"
                      >
                        <UserCheck className="w-4 h-4 text-[#0071E3]" />
                        <span>Profile & Security</span>
                      </Link>

                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          signOut(() => router.push("/sign-in"));
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-left text-sm font-medium text-red-600 hover:bg-red-50 transition cursor-pointer"
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
        </header>

        {/* Page Body View */}
        <main className="flex-1 p-8 max-w-7xl w-full mx-auto">{children}</main>

        {/* Minimal Footer */}
        <footer className="border-t border-[#E5E5EA] bg-white px-8 py-4 text-xs text-[#86868B]">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0">
            <span>© {new Date().getFullYear()} Qubere Inc. All rights reserved. Customer Portal.</span>
            <div className="flex space-x-5 text-[#86868B]">
              <span className="hover:text-[#1D1D1F] cursor-pointer transition">Support</span>
              <span className="hover:text-[#1D1D1F] cursor-pointer transition">Privacy Policy</span>
              <span className="hover:text-[#1D1D1F] cursor-pointer transition">Security</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
