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
  X,
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
  // Deny by default — these are only ever widened by a successful /api/me.
  const [capabilities, setCapabilities] = useState<Capability>({
    hasPorterView: false,
    hasCustomsAccess: false,
    hasTmsAccess: false,
    canUploadDocuments: false,
    canRespondRequests: false,
  });
  const [clients, setClients] = useState<ClientScope[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientScope | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const SESSION_CACHE_KEY = "qubere_portal_user_session_v1";
  const SESSION_CACHE_TTL = 300 * 1000; // 300s (5 minutes)

  useEffect(() => {
    // 1. Instant HTML5 sessionStorage read (0 ms client-side hydration)
    try {
      const rawCache = sessionStorage.getItem(SESSION_CACHE_KEY);
      if (rawCache) {
        const parsed = JSON.parse(rawCache);
        if (parsed.timestamp && Date.now() - parsed.timestamp < SESSION_CACHE_TTL && parsed.data?.user) {
          const data = parsed.data;
          setUser(data.user);
          if (data.account?.id) setAccountId(data.account.id);
          if (data.capabilities) setCapabilities(data.capabilities);
          if (data.clients && data.clients.length > 0) {
            setClients(data.clients);
            setSelectedClient(data.clients[0]);
          }
        }
      }
    } catch {}

    // 2. Background fetch to revalidate HTML5 cache
    fetch("/api/me")
      .then(async (res) => {
        // No valid session -> this is not a logged-in portal. Clear any stale
        // cache and send the visitor to sign-in rather than rendering the shell
        // with placeholder identity.
        if (res.status === 401) {
          try {
            sessionStorage.removeItem(SESSION_CACHE_KEY);
          } catch {}
          window.location.href = "/sign-in";
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then((data) => {
        if (data && data.user) {
          setUser(data.user);
          if (data.account?.id) setAccountId(data.account.id);
          if (data.capabilities) setCapabilities(data.capabilities);
          if (data.clients && data.clients.length > 0) {
            setClients(data.clients);
            setSelectedClient(data.clients[0]);
          }
          try {
            sessionStorage.setItem(
              SESSION_CACHE_KEY,
              JSON.stringify({ timestamp: Date.now(), data })
            );
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  const userName = user?.name || clerkUser?.fullName || clerkUser?.primaryEmailAddress?.emailAddress || "";
  const userEmail = user?.email || clerkUser?.primaryEmailAddress?.emailAddress || "";

  const navItems = [
    { label: "Actions", href: "/", icon: LayoutDashboard, visible: true },
    { label: "Customs Shipments", href: "/shipments", icon: FileText, visible: capabilities.hasCustomsAccess },
    { label: "TMS Freight", href: "/freight", icon: Truck, visible: capabilities.hasTmsAccess },
    { label: "Compliance", href: "/compliance", icon: ShieldCheck, visible: capabilities.hasCustomsAccess },
    { label: "Setup", href: "/setup", icon: Building2, visible: capabilities.hasCustomsAccess },
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
                {selectedClient?.name || "—"}
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
                          {selectedClient?.name || "—"}
                        </span>
                      </div>
                    </div>

                    <div className="p-1.5 space-y-0.5">
                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          setIsProfileModalOpen(true);
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-left text-sm font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] transition cursor-pointer"
                      >
                        <UserCheck className="w-4 h-4 text-[#0071E3]" />
                        <span>Profile & Security</span>
                      </button>

                      <button
                        onClick={async () => {
                          setIsMenuOpen(false);
                          try {
                            await signOut();
                          } catch (err) {
                            console.error("Sign out error:", err);
                          }
                          window.location.href = "/sign-in";
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

      {/* Profile & Security Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-[#E5E5EA] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-[#E5E5EA] flex items-center justify-between bg-[#FAF9F6]/50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#1D1D1F]">Profile & Security</h3>
                  <p className="text-xs text-[#86868B]">Account identity, credentials, and tenant authorization scope.</p>
                </div>
              </div>
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#F5F5F7] hover:bg-[#E5E5EA] text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* User Identity Card */}
              <div className="p-5 rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA] flex items-center space-x-4">
                <div className="w-14 h-14 rounded-full bg-[#0071E3] text-white flex items-center justify-center text-xl font-bold shadow-md shrink-0">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-base font-bold text-[#1D1D1F] truncate">{userName}</h4>
                  <p className="text-xs text-[#86868B] truncate">{userEmail}</p>
                  <div className="mt-2 flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-100 text-blue-800 border border-blue-200">
                      Porter Customer User
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Verified Identity
                    </span>
                  </div>
                </div>
              </div>

              {/* Security & Authentication */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#86868B]">
                  Security & Credentials
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl border border-[#E5E5EA] bg-white space-y-1">
                    <span className="text-[11px] font-medium text-[#86868B]">Primary Work Email</span>
                    <p className="text-xs font-bold text-[#1D1D1F] truncate">{userEmail}</p>
                  </div>
                  <div className="p-4 rounded-2xl border border-[#E5E5EA] bg-white space-y-1">
                    <span className="text-[11px] font-medium text-[#86868B]">Authentication Standard</span>
                    <p className="text-xs font-bold text-[#1D1D1F]">Encrypted (Clerk SSO / Password)</p>
                  </div>
                </div>
              </div>

              {/* Tenant & Client Authorization */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#86868B]">
                  Tenant & Client Scope
                </h4>
                <div className="p-5 rounded-2xl border border-[#E5E5EA] bg-white space-y-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-[#86868B] font-medium">Organization / Account ID:</span>
                    <span className="font-mono font-bold text-[#1D1D1F] bg-[#F5F5F7] px-2 py-0.5 rounded border border-[#E5E5EA]">
                      {accountId || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#86868B] font-medium">Authorized Client Account:</span>
                    <span className="font-bold text-[#1D1D1F]">
                      {selectedClient?.name || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#86868B] font-medium">Porter View Entitlement:</span>
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      Active
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#E5E5EA] bg-[#FAF9F6]/50 flex justify-end">
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-[#0071E3] text-white text-xs font-bold hover:bg-[#0071E3]/90 transition cursor-pointer shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
