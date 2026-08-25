"use client";

import { useState } from "react";
import { TmsSidebar } from "@/components/TmsSidebar";
import { TmsHeader } from "@/components/TmsHeader";
import { Users, UserPlus, CheckCircle2, ShieldCheck, X, Check, Loader2, UserCheck, Search, ChevronDown } from "lucide-react";
import { Card, Button } from "@/components/ui";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  joined: string;
}

const INITIAL_USERS: UserRecord[] = [
  { id: "usr_01", name: "Operations Lead (Admin)", email: "admin@qubere.ai", role: "PLATFORM_ADMIN", status: "Active", joined: "2026-01-15" },
  { id: "usr_02", name: "Target Enterprise Admin", email: "admin@target.com", role: "ADMIN", status: "Active", joined: "2026-02-01" },
  { id: "usr_03", name: "Sarah Target (Logistics)", email: "sarah@target.com", role: "PLANNER", status: "Active", joined: "2026-02-10" },
  { id: "usr_04", name: "Acme Logistics Owner", email: "owner.acme@qubere.ai", role: "OWNER", status: "Active", joined: "2026-01-20" },
  { id: "usr_05", name: "Dispatch Automation Bot", email: "ai-dispatcher@qubere.ai", role: "SYSTEM_AGENT", status: "Active", joined: "2026-01-01" },
];

export function UserManagementClient() {
  const [users, setUsers] = useState<UserRecord[]>(INITIAL_USERS);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);

  // Invite Form State
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("DISPATCHER");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [impersonatingUserId, setImpersonatingUserId] = useState<string | null>(null);
  const [openRolePickerUserId, setOpenRolePickerUserId] = useState<string | null>(null);
  const [roleSearchQuery, setRoleSearchQuery] = useState("");

  const handleImpersonateUser = async (userEmail: string, userId: string) => {
    setImpersonatingUserId(userId);
    try {
      const res = await fetch("/api/platform-admin/impersonate/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetAccountId: "acc_tms_demo",
          targetUserId: userId,
          reason: `TMS Admin Troubleshooting as ${userEmail}`,
        }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        setToastMessage(`Switching perspective to ${userEmail}...`);
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch {
      setToastMessage(`Switching perspective to ${userEmail}...`);
      setTimeout(() => window.location.reload(), 1000);
    } finally {
      setImpersonatingUserId(null);
    }
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      const newUser: UserRecord = {
        id: `usr_${Date.now().toString().slice(-4)}`,
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        role: inviteRole,
        status: "Active",
        joined: new Date().toISOString().split("T")[0],
      };

      setUsers([newUser, ...users]);
      setIsSubmitting(false);
      setIsInviteOpen(false);
      setInviteName("");
      setInviteEmail("");
      setToastMessage(`Invitation sent to ${newUser.email}`);
      setTimeout(() => setToastMessage(""), 4000);
    }, 600);
  };

  const handleEditRoleSave = (newRole: string) => {
    if (!editingUser) return;

    setUsers(users.map((u) => (u.id === editingUser.id ? { ...u, role: newRole } : u)));
    setToastMessage(`Updated role for ${editingUser.name} to ${newRole}`);
    setEditingUser(null);
    setTimeout(() => setToastMessage(""), 4000);
  };

  return (
    <div className="min-h-screen bg-surface-muted text-ink flex w-full">
      <TmsSidebar accountName="Enterprise Freight" />

      <div className="flex-1 flex flex-col min-w-0">
        <TmsHeader tenantName="Enterprise Freight" userName="Operations Lead" />

        <main className="flex-1 p-6 md:p-8 overflow-y-auto space-y-6 max-w-[1600px] mx-auto w-full">
          {toastMessage && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center space-x-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-border shadow-2xs">
            <div>
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center">
                  <Users className="w-4 h-4 text-brand" />
                </div>
                <h1 className="text-xl font-black tracking-tight text-ink">User Management & Permissions</h1>
              </div>
              <p className="text-xs text-ink-muted mt-1 font-medium">
                Manage team members, dispatchers, auditors, and grant role-based access.
              </p>
            </div>
            <Button
              onClick={() => setIsInviteOpen(true)}
              className="flex items-center space-x-2 bg-brand text-white hover:bg-brand-hover cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Invite New User</span>
            </Button>
          </div>

          {/* User Table Card */}
          <Card className="bg-white border border-border overflow-hidden shadow-2xs rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-muted/60 border-b border-border font-bold text-ink uppercase tracking-wider">
                <tr>
                  <th className="p-4">User</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Date Joined</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-muted/40 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-xs shrink-0">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-ink text-xs">{u.name}</p>
                          <p className="text-[11px] text-ink-muted font-medium">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-mono font-semibold">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenRolePickerUserId(openRolePickerUserId === u.id ? null : u.id)}
                          className="px-3 py-1 bg-surface-muted hover:bg-slate-100 border border-border rounded-xl flex items-center justify-between text-xs font-semibold text-ink transition-colors cursor-pointer"
                        >
                          <span className="px-2 py-0.5 text-[10px] font-extrabold bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                            {u.role}
                          </span>
                          <ChevronDown className="w-3 h-3 text-ink-muted ml-1.5 shrink-0" />
                        </button>

                        {openRolePickerUserId === u.id && (
                          <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-border rounded-2xl shadow-xl z-50 p-2 space-y-2">
                            <div className="relative">
                              <Search className="w-3 h-3 text-ink-muted absolute left-2.5 top-2.5" />
                              <input
                                type="text"
                                placeholder="Search roles..."
                                value={roleSearchQuery}
                                onChange={(e) => setRoleSearchQuery(e.target.value)}
                                className="w-full pl-7 pr-3 py-1 text-xs bg-surface-muted border border-border rounded-xl focus:outline-none focus:border-brand text-ink"
                              />
                            </div>

                            <div className="max-h-40 overflow-y-auto space-y-0.5">
                              {["OWNER", "ADMIN", "DISPATCHER", "LOGISTICS_SPECIALIST", "VIEWER"]
                                .filter((r) => r.toLowerCase().includes(roleSearchQuery.toLowerCase()))
                                .map((roleName) => (
                                  <button
                                    key={roleName}
                                    type="button"
                                    onClick={() => {
                                      setUsers((prev) =>
                                        prev.map((item) => (item.id === u.id ? { ...item, role: roleName } : item))
                                      );
                                      setOpenRolePickerUserId(null);
                                      setToastMessage(`Updated ${u.name}'s role to ${roleName}`);
                                    }}
                                    className={`w-full px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                                      u.role === roleName ? "bg-blue-50 text-brand font-bold" : "text-ink hover:bg-surface-muted"
                                    }`}
                                  >
                                    <span>{roleName}</span>
                                    {u.role === roleName && <Check className="w-3.5 h-3.5 text-brand shrink-0" />}
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>{u.status}</span>
                      </span>
                    </td>
                    <td className="p-4 text-ink-muted font-medium">{u.joined}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleImpersonateUser(u.email, u.id)}
                          disabled={impersonatingUserId === u.id}
                          className="px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold hover:bg-amber-100 transition-colors flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                        >
                          <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                          <span>{impersonatingUserId === u.id ? "Entering..." : "Impersonate"}</span>
                        </button>
                        <button
                          onClick={() => setEditingUser(u)}
                          className="text-xs font-bold text-brand hover:underline cursor-pointer"
                        >
                          Edit Role
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </main>
      </div>

      {/* Invite User Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-border rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-border flex items-center justify-between bg-surface-muted/50">
              <div className="flex items-center space-x-2">
                <UserPlus className="w-4 h-4 text-brand" />
                <h3 className="font-extrabold text-sm text-ink">Invite New Team Member</h3>
              </div>
              <button onClick={() => setIsInviteOpen(false)} className="text-ink-muted hover:text-ink cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleInviteSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full px-3 py-2 rounded-xl border border-border text-xs focus:outline-none focus:border-brand font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="alex@company.com"
                  className="w-full px-3 py-2 rounded-xl border border-border text-xs focus:outline-none focus:border-brand font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink mb-1">System Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border text-xs focus:outline-none focus:border-brand font-medium"
                >
                  <option value="DISPATCHER">DISPATCHER (Full execution & tendering)</option>
                  <option value="PLANNER">PLANNER (Logistics & Document Intake)</option>
                  <option value="FINANCE_AUDITOR">FINANCE_AUDITOR (3-Way Freight Matching)</option>
                  <option value="VIEWER">VIEWER (Read-only observation)</option>
                </select>
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)} className="cursor-pointer">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-brand text-white hover:bg-brand-hover cursor-pointer">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Invitation"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-border rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-brand" />
                <h3 className="font-extrabold text-sm text-ink">Edit Role for {editingUser.name}</h3>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-ink-muted hover:text-ink cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-ink-muted font-medium">Select new role assignment for <strong className="text-ink">{editingUser.email}</strong>:</p>
            <div className="space-y-2">
              {["OWNER", "ADMIN", "DISPATCHER", "PLANNER", "FINANCE_AUDITOR", "VIEWER"].map((roleOption) => (
                <button
                  key={roleOption}
                  onClick={() => handleEditRoleSave(roleOption)}
                  className={`w-full p-3 rounded-xl border text-left flex items-center justify-between text-xs font-bold transition-all cursor-pointer ${
                    editingUser.role === roleOption
                      ? "bg-brand/10 border-brand text-brand"
                      : "bg-surface-muted/40 border-border text-ink hover:border-brand/40"
                  }`}
                >
                  <span>{roleOption}</span>
                  {editingUser.role === roleOption && <Check className="w-4 h-4 text-brand" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
