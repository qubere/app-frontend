"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { Users, UserPlus, UserX, UserCheck, Eye, Loader2, CheckCircle2, AlertCircle, ShieldCheck, Calendar, Mail, User, X } from "lucide-react";
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

  const [loadingMembershipId, setLoadingMembershipId] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<MemberItem | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if ((!inviteRole || !availableRoles.includes(inviteRole)) && availableRoles.length > 0) {
      setInviteRole(availableRoles.find((r) => r !== "OWNER") ?? availableRoles[0] ?? "");
    }
  }, [availableRoles, inviteRole]);

  const visibleMembers = showInactive ? members : members.filter((m) => m.status === "ACTIVE");

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

  // Toggles a single role on/off for a membership, sending the resulting
  // full role set (a membership can hold multiple roles at once).
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
        setMessage({ type: "success", text: `Updated roles to ${nextRoleNames.join(", ")}. Audit log generated.` });
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
        setMessage({ type: "success", text: `User membership status set to ${nextStatus}.` });
        router.refresh();
        onSaved?.();
      } else {
        setMessage({ type: "error", text: getErrMsg(data.error, "Failed to update status.") });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Network error occurred." });
    } finally {
      setLoadingMembershipId(null);
    }
  };

  return (
    <div className="space-y-8">
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
      <div className="apple-card p-6 rounded-3xl border border-border bg-white shadow-sm">
        <h3 className="text-sm font-bold text-ink uppercase tracking-wider mb-4 flex items-center space-x-2">
          <UserPlus className="w-4 h-4 text-brand" />
          <span>Invite Member to Account</span>
        </h3>

        <form onSubmit={handleInviteUser} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1">
            <Label className="block mb-1 font-bold">Email Address</Label>
            <Input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@company.com"
              required
            />
          </div>

          <div>
            <Label className="block mb-1 font-bold">Assigned Role</Label>
            <Select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="font-semibold"
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
              className="w-full rounded-full shadow-md shadow-brand/20"
            >
              {inviteLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UserPlus className="w-3.5 h-3.5" />
              )}
              <span>Send Account Invitation</span>
            </Button>
          </div>
        </form>
      </div>

      {/* Members Table */}
      <div className="apple-card rounded-3xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-ink flex items-center space-x-2">
            <Users className="w-5 h-5 text-brand" />
            <span>Active Account Members ({visibleMembers.length})</span>
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

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-ink">
            <thead className="bg-surface-muted border-b border-border text-xs uppercase font-bold text-ink-muted">
              <tr>
                <th className="px-6 py-4">User Identity</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Membership Dates</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleMembers.map((m) => {
                const name =
                  m.firstName || m.lastName
                    ? `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim()
                    : m.email;

                const isSelf = m.userId === currentUserId;

                const isInactive = m.status !== "ACTIVE";

                return (
                  <tr key={m.membershipId} className={`hover:bg-slate-50 transition-colors ${isInactive ? "opacity-50" : ""}`}>
                    <td className="px-6 py-4">
                      <div className="font-bold text-ink flex items-center space-x-2">
                        <span>{name}</span>
                        {isSelf && (
                          <Badge variant="info" className="font-mono">
                            You
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-ink-muted font-mono">{m.email}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5 max-w-[220px]">
                        {availableRoles.map((role) => {
                          const isAssigned = m.roleNames.includes(role);
                          return (
                            <button
                              key={role}
                              type="button"
                              disabled={loadingMembershipId === m.membershipId || isSelf}
                              onClick={() => handleRoleToggle(m.membershipId, m.roleNames, role)}
                              title={isSelf ? "You cannot change your own roles" : `Toggle ${role}`}
                              className={`px-2.5 py-1 text-[10px] font-bold rounded-full border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                isAssigned
                                  ? "bg-brand text-white border-brand"
                                  : "bg-surface-muted text-ink-muted border-border hover:border-brand/50"
                              }`}
                            >
                              {role}
                            </button>
                          );
                        })}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-xs text-ink-muted">
                      <div>
                        <span className="font-semibold text-ink-muted">Start:</span> {formatDate(m.createdAt)}
                      </div>
                      {isInactive && m.updatedAt && (
                        <div>
                          <span className="font-semibold text-ink-muted">Disabled:</span> {formatDate(m.updatedAt)}
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right space-x-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedMember(m)}
                        className="rounded-full"
                      >
                        <Eye className="w-3.5 h-3.5 text-brand" />
                        <span>Details</span>
                      </Button>

                      <button
                        disabled={loadingMembershipId === m.membershipId || isSelf}
                        onClick={() => handleStatusToggle(m.membershipId, m.status)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors inline-flex items-center space-x-1 disabled:opacity-40 border ${
                          m.status === "ACTIVE"
                            ? "bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                            : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        {loadingMembershipId === m.membershipId ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : m.status === "ACTIVE" ? (
                          <>
                            <UserX className="w-3.5 h-3.5" />
                            <span>Disable</span>
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Enable</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Details Modal */}
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
                <span className="text-ink">{formatDate(selectedMember.createdAt)}</span>
              </div>
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

          <ModalFooter>
            <Button variant="secondary" onClick={() => setSelectedMember(null)} className="rounded-full">
              Close Details
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
