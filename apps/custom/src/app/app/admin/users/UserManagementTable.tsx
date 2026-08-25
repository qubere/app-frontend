"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import {
  Users,
  UserPlus,
  UserX,
  UserCheck,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Search,
  ChevronDown,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Label } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";

export interface MemberItem {
  membershipId: string;
  userId: string;
  clerkUserId?: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  status: string;
  roleNames: string[];
  roleIds?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface UserManagementTableProps {
  members: MemberItem[];
  currentUserId: string;
  availableRoles: string[];
  onSaved?: () => void;
}

function getErrMsg(err: unknown, fallback: string): string {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    if ("message" in err && typeof (err as { message: unknown }).message === "string") {
      return (err as { message: string }).message;
    }
  }
  return fallback;
}

export function UserManagementTable({ members, currentUserId, availableRoles, onSaved }: UserManagementTableProps) {
  const router = useRouter();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState(availableRoles.find((r) => r !== "OWNER") ?? availableRoles[0] ?? "");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<"ALL" | "7DAYS" | "30DAYS" | "THIS_MONTH">("ALL");

  const [loadingMembershipId, setLoadingMembershipId] = useState<string | null>(null);
  const [impersonatingUserId, setImpersonatingUserId] = useState<string | null>(null);
  const [openRolePickerMembershipId, setOpenRolePickerMembershipId] = useState<string | null>(null);
  const [roleSearchQueries, setRoleSearchQueries] = useState<Record<string, string>>({});
  const [selectedMember, setSelectedMember] = useState<MemberItem | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if ((!inviteRole || !availableRoles.includes(inviteRole)) && availableRoles.length > 0) {
      setInviteRole(availableRoles.find((r) => r !== "OWNER") ?? availableRoles[0] ?? "");
    }
  }, [availableRoles, inviteRole]);

  const handleImpersonateUser = async (targetUserId: string, targetEmail: string) => {
    setImpersonatingUserId(targetUserId);
    setMessage(null);
    try {
      const res = await fetch("/api/platform-admin/impersonate/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetAccountId: members.find((m) => m.userId === targetUserId)?.membershipId || currentUserId,
          targetUserId,
          reason: `Admin Troubleshooting as ${targetEmail}`,
        }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: getErrMsg(data.error, "Failed to impersonate user") });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Network error starting impersonation" });
    } finally {
      setImpersonatingUserId(null);
    }
  };

  const visibleMembers = useMemo(() => {
    return showInactive ? members : members.filter((m) => m.status === "ACTIVE");
  }, [members, showInactive]);

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const today = new Date(now);
    return visibleMembers.filter((m) => {
      const name = [m.firstName, m.lastName].filter(Boolean).join(" ");

      const matchesSearch =
        !q ||
        name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.roleNames.some((r) => r.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (dateFilter !== "ALL") {
        const createdAt = new Date(m.createdAt).getTime();
        if (dateFilter === "7DAYS" && now - createdAt > 7 * 86400 * 1000) return false;
        if (dateFilter === "30DAYS" && now - createdAt > 30 * 86400 * 1000) return false;
        if (dateFilter === "THIS_MONTH") {
          const d = new Date(m.createdAt);
          if (d.getMonth() !== today.getMonth() || d.getFullYear() !== today.getFullYear()) return false;
        }
      }
      return true;
    });
  }, [visibleMembers, searchQuery, dateFilter, now]);

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, roleName: inviteRole }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: `Invitation sent to ${inviteEmail} as ${inviteRole}.` });
        setInviteEmail("");
        router.refresh();
        onSaved?.();
      } else {
        setMessage({ type: "error", text: getErrMsg(data.error, "Failed to send invitation") });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Network error occurred." });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRoleToggle = async (membershipId: string, currentRoleNames: string[], toggledRole: string) => {
    const nextRoleNames = currentRoleNames.includes(toggledRole)
      ? currentRoleNames.filter((r) => r !== toggledRole)
      : [...currentRoleNames, toggledRole];

    if (nextRoleNames.length === 0) {
      setMessage({ type: "error", text: "A member must have at least one role." });
      return;
    }

    setLoadingMembershipId(membershipId);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId, roleNames: nextRoleNames }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: `Updated roles to ${nextRoleNames.join(", ")}.` });
        router.refresh();
        onSaved?.();
      } else {
        setMessage({ type: "error", text: getErrMsg(data.error, "Failed to update user roles.") });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Network error occurred." });
    } finally {
      setLoadingMembershipId(null);
    }
  };

  const handleStatusToggle = async (membershipId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "ACTIVE" ? "DISABLED" : "ACTIVE";
    setLoadingMembershipId(membershipId);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId, status: nextStatus }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: "success",
          text: `Member status changed to ${nextStatus}.`,
        });
        router.refresh();
        onSaved?.();
      } else {
        setMessage({ type: "error", text: getErrMsg(data.error, "Failed to update user status.") });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Network error occurred." });
    } finally {
      setLoadingMembershipId(null);
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`p-4 rounded-2xl text-sm border flex items-center space-x-3 ${
            message.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Invite Member Card */}
      <div className="apple-card p-5 rounded-2xl border border-border bg-white shadow-xs">
        <h3 className="text-xs font-bold text-ink uppercase tracking-wider mb-3 flex items-center space-x-2">
          <UserPlus className="w-4 h-4 text-brand" />
          <span>Invite Member to Account</span>
        </h3>

        <form onSubmit={handleInviteUser} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1">
            <Label className="block mb-1 text-xs font-bold">Email Address</Label>
            <Input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@company.com"
              className="text-xs h-9"
              required
            />
          </div>

          <div>
            <Label className="block mb-1 text-xs font-bold">Assigned Role</Label>
            <Select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="text-xs h-9 font-semibold"
            >
              {availableRoles
                .filter((r) => r !== "OWNER")
                .map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              type="submit"
              disabled={inviteLoading}
              className="w-full h-9 rounded-xl shadow-xs text-xs font-bold"
            >
              {inviteLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UserPlus className="w-3.5 h-3.5" />
              )}
              <span>Send Invitation</span>
            </Button>
          </div>
        </form>
      </div>

      {/* Members Table Card */}
      <div className="apple-card rounded-2xl border border-border bg-white shadow-xs overflow-hidden">
        {/* Table Header & Search Filter Bar */}
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-base font-bold text-ink flex items-center space-x-2">
              <Users className="w-4 h-4 text-brand" />
              <span>Active Account Members ({filteredMembers.length})</span>
            </h3>
            <label className="flex items-center gap-2 text-xs font-semibold text-ink-muted cursor-pointer select-none">
              <div
                onClick={() => setShowInactive((v) => !v)}
                className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer ${showInactive ? "bg-brand" : "bg-border"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${showInactive ? "translate-x-4" : ""}`} />
              </div>
              Show inactive users
            </label>
          </div>

          {/* Search & Date Filter Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, or role..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-muted border border-border rounded-xl focus:outline-none focus:border-brand text-ink transition-colors font-medium"
              />
            </div>

            <div className="flex items-center space-x-1.5">
              <Filter className="w-3.5 h-3.5 text-ink-muted shrink-0" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs bg-surface-muted border border-border rounded-xl text-ink font-semibold focus:outline-none focus:border-brand"
              >
                <option value="ALL">All Dates</option>
                <option value="7DAYS">Joined in Last 7 Days</option>
                <option value="30DAYS">Joined in Last 30 Days</option>
                <option value="THIS_MONTH">Joined This Month</option>
              </select>
            </div>
          </div>
        </div>

        {/* Compact Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-ink">
            <thead className="bg-surface-muted/60 border-b border-border text-[11px] uppercase font-bold text-ink-muted">
              <tr>
                <th className="px-4 py-2.5">User Identity</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Membership Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredMembers.map((m) => {
                const name =
                  m.firstName || m.lastName
                    ? `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim()
                    : m.email;

                const isSelf = m.userId === currentUserId;
                const isInactive = m.status !== "ACTIVE";

                return (
                  <tr key={m.membershipId} className={`hover:bg-slate-50 transition-colors ${isInactive ? "opacity-50" : ""}`}>
                    {/* User Identity - Clickable Name opens Details Popup */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setSelectedMember(m)}
                          className="font-bold text-ink hover:text-brand hover:underline cursor-pointer text-left truncate"
                          title="Click to view details & actions"
                        >
                          {name}
                        </button>
                        {isSelf && (
                          <Badge variant="info" className="font-mono text-[9px]">
                            You
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-ink-muted font-mono truncate">{m.email}</div>
                    </td>

                    {/* Role Dropdown */}
                    <td className="px-4 py-2.5">
                      <div className="relative min-w-[180px]">
                        <button
                          type="button"
                          disabled={isSelf}
                          onClick={() => setOpenRolePickerMembershipId(openRolePickerMembershipId === m.membershipId ? null : m.membershipId)}
                          className="w-full px-2.5 py-1 bg-surface-muted hover:bg-slate-100 border border-border rounded-xl flex items-center justify-between text-xs font-semibold text-ink transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <div className="flex flex-wrap gap-1 items-center max-w-[140px] overflow-hidden">
                            {m.roleNames.length === 0 ? (
                              <span className="text-ink-muted italic">Select Roles...</span>
                            ) : (
                              m.roleNames.map((r) => (
                                <span key={r} className="px-1.5 py-0.2 text-[9px] font-extrabold bg-blue-50 text-brand rounded-full border border-blue-100">
                                  {r}
                                </span>
                              ))
                            )}
                          </div>
                          <ChevronDown className="w-3.5 h-3.5 text-ink-muted shrink-0 ml-1" />
                        </button>

                        {openRolePickerMembershipId === m.membershipId && (
                          <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-border rounded-2xl shadow-xl z-50 p-2 space-y-2">
                            <div className="relative">
                              <Search className="w-3.5 h-3.5 text-ink-muted absolute left-2.5 top-2.5" />
                              <input
                                type="text"
                                placeholder="Search roles..."
                                value={roleSearchQueries[m.membershipId] || ""}
                                onChange={(e) =>
                                  setRoleSearchQueries({
                                    ...roleSearchQueries,
                                    [m.membershipId]: e.target.value,
                                  })
                                }
                                className="w-full pl-8 pr-3 py-1 text-xs bg-surface-muted border border-border rounded-xl focus:outline-none focus:border-brand text-ink"
                              />
                            </div>

                            <div className="max-h-48 overflow-y-auto space-y-0.5">
                              {availableRoles
                                .filter((role) =>
                                  role.toLowerCase().includes((roleSearchQueries[m.membershipId] || "").toLowerCase())
                                )
                                .map((role) => {
                                  const isAssigned = m.roleNames.includes(role);
                                  return (
                                    <button
                                      key={role}
                                      type="button"
                                      disabled={loadingMembershipId === m.membershipId || isSelf}
                                      onClick={() => handleRoleToggle(m.membershipId, m.roleNames, role)}
                                      className={`w-full px-2.5 py-1 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                                        isAssigned ? "bg-blue-50 text-brand font-bold" : "text-ink hover:bg-surface-muted"
                                      }`}
                                    >
                                      <span>{role}</span>
                                      {isAssigned && <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0" />}
                                    </button>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Membership Date Column (Clean representation) */}
                    <td className="px-4 py-2.5 text-xs text-ink-muted font-medium">
                      {isInactive ? (
                        <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200 font-bold text-[10px]">
                          Disabled: {formatDate(m.updatedAt || m.createdAt)}
                        </span>
                      ) : (
                        <span>{formatDate(m.createdAt)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Details Modal (Includes Impersonate & Disable/Enable User actions) */}
      {selectedMember && (
        <Modal isOpen={!!selectedMember} onClose={() => setSelectedMember(null)} titleId="user-details-modal-title">
          <ModalHeader>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-sm">
                {(selectedMember.firstName?.[0] ?? selectedMember.email[0]).toUpperCase()}
              </div>
              <div>
                <h3 id="user-details-modal-title" className="text-base font-bold text-ink">
                  {selectedMember.firstName || selectedMember.lastName
                    ? `${selectedMember.firstName ?? ""} ${selectedMember.lastName ?? ""}`.trim()
                    : selectedMember.email}
                </h3>
                <p className="text-xs text-ink-muted">{selectedMember.email}</p>
              </div>
            </div>
          </ModalHeader>

          <ModalBody className="space-y-4 py-2">
            <div className="bg-surface-muted/50 p-4 rounded-2xl border border-border space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink-muted">Membership Status</span>
                <Badge variant={selectedMember.status === "ACTIVE" ? "success" : "neutral"}>
                  {selectedMember.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink-muted">User ID</span>
                <span className="font-mono text-ink text-[11px]">{selectedMember.userId}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink-muted">Membership ID</span>
                <span className="font-mono text-ink text-[11px]">{selectedMember.membershipId}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink-muted">Joined Date</span>
                <span className="text-ink font-semibold">{formatDate(selectedMember.createdAt)}</span>
              </div>
              {selectedMember.status !== "ACTIVE" && selectedMember.updatedAt && (
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink-muted">Disabled Date</span>
                  <span className="text-red-700 font-semibold">{formatDate(selectedMember.updatedAt)}</span>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-xs font-bold text-ink mb-2 uppercase tracking-wider">Assigned Account Roles</h4>
              <div className="flex flex-wrap gap-2">
                {selectedMember.roleNames.map((role) => (
                  <span
                    key={role}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand/10 text-brand border border-brand/20 text-xs font-bold rounded-full"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {role}
                  </span>
                ))}
              </div>
            </div>
          </ModalBody>

          <ModalFooter className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {selectedMember.userId !== currentUserId && selectedMember.status === "ACTIVE" && (
                <Button
                  variant="outline"
                  disabled={impersonatingUserId === selectedMember.userId}
                  onClick={() => {
                    const email = selectedMember.email;
                    const uid = selectedMember.userId;
                    setSelectedMember(null);
                    handleImpersonateUser(uid, email);
                  }}
                  className="border-amber-300 text-amber-800 hover:bg-amber-50 font-bold rounded-full text-xs"
                >
                  <UserCheck className="w-3.5 h-3.5 text-amber-600 mr-1.5" />
                  <span>Impersonate User</span>
                </Button>
              )}

              {selectedMember.userId !== currentUserId && (
                <Button
                  variant={selectedMember.status === "ACTIVE" ? "danger" : "secondary"}
                  disabled={loadingMembershipId === selectedMember.membershipId}
                  onClick={() => {
                    const mid = selectedMember.membershipId;
                    const st = selectedMember.status;
                    setSelectedMember(null);
                    handleStatusToggle(mid, st);
                  }}
                  className="rounded-full text-xs font-bold"
                >
                  {selectedMember.status === "ACTIVE" ? (
                    <>
                      <UserX className="w-3.5 h-3.5 mr-1.5" />
                      <span>Disable User</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                      <span>Activate User</span>
                    </>
                  )}
                </Button>
              )}
            </div>

            <Button variant="secondary" onClick={() => setSelectedMember(null)} className="rounded-full text-xs font-bold">
              Close Details
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
