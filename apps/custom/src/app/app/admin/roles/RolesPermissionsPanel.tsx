"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Users,
  RefreshCw,
  Plus,
  Layers,
  Search,
  Loader2,
} from "lucide-react";
import { PanelHeading } from "@/components/PanelHeading";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import type { FormattedRole, RolesPermissionsData } from "@/lib/admin/rolesData";

interface RolesPermissionsPanelProps extends RolesPermissionsData {
  accountName: string;
  compact?: boolean;
}

const ROLE_USAGE_OVERVIEW: Record<string, string> = {
  OWNER: "Full platform administrative control, billing management, organization setup, and overall tenant ownership.",
  ADMIN: "Workspace management, member invitations, client access assignments, and custom role configuration.",
  BROKER: "Customs entry creation, CBP transmission, filing management, tariff compliance, and regulatory operations.",
  SPECIALIST: "Product classification, tariff lookup, document data extraction, and shipment processing.",
  REVIEWER: "Decision review, exception handling, audit verification, and compliance quality assurance.",
  MEMBER: "Standard operational read and write access for daily workflow management.",
  VIEWER: "Read-only visibility across operational dashboards, shipments, filings, and reports.",
};

export function SyncPermissionsButton() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/permissions/sync", { method: "POST" });
      if (res.ok) {
        router.refresh();
      } else {
        alert("Failed to sync permission catalogue");
      }
    } catch (err) {
      console.error("Error syncing permissions", err);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <button
      type="button"
      disabled={syncing}
      onClick={handleSync}
      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-border bg-white hover:bg-surface-muted text-ink text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
      title="Sync system permission catalogue and grant default role permissions"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin text-brand" : ""}`} />
      <span>{syncing ? "Syncing..." : "Sync Permissions"}</span>
    </button>
  );
}

function RoleCard({ role }: { role: FormattedRole }) {
  const overviewText = ROLE_USAGE_OVERVIEW[role.name] || role.description || "Custom operational role with designated permissions.";

  return (
    <section className="rounded-2xl bg-white border border-border p-5 space-y-2.5 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <h2 className="text-base font-bold text-ink">{role.name}</h2>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
              role.isSystem
                ? "bg-blue-50 text-brand border-blue-100"
                : "bg-purple-50 text-purple-700 border-purple-200"
            }`}
          >
            {role.isSystem ? "Standard Role" : "Custom Role"}
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted font-medium bg-surface-muted px-2.5 py-1 rounded-full border border-border">
          <Users className="w-3.5 h-3.5 text-brand" aria-hidden="true" />
          <span>{role.memberCount} {role.memberCount === 1 ? "member" : "members"}</span>
        </span>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-bold text-ink-muted uppercase tracking-wider">When to use this role</p>
        <p className="text-xs text-ink leading-relaxed font-medium">{overviewText}</p>
      </div>
    </section>
  );
}

export function RolesPermissionsPanel({
  accountName,
  roles,
  permissionCatalogue,
  compact,
}: RolesPermissionsPanelProps) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [permissionSearch, setPermissionSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Group catalogue permissions by Category
  const categoryMap = useMemo(() => {
    const map = new Map<string, Array<(typeof permissionCatalogue)[number]>>();
    for (const item of permissionCatalogue) {
      const cat = item.category || "General";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return map;
  }, [permissionCatalogue]);

  const categories = useMemo(() => Array.from(categoryMap.keys()), [categoryMap]);

  // Handle toggle single permission
  const handleTogglePermission = (name: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
    );
  };

  // 1-Click Category Add / Toggle All
  const handleToggleCategory = (catName: string) => {
    const catPerms = categoryMap.get(catName)?.map((p) => p.name) || [];
    const allSelected = catPerms.every((p) => selectedPermissions.includes(p));

    if (allSelected) {
      setSelectedPermissions((prev) => prev.filter((p) => !catPerms.includes(p)));
    } else {
      setSelectedPermissions((prev) => Array.from(new Set([...prev, ...catPerms])));
    }
  };

  const handleCreateCustomRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim()) return;

    setCreating(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roleName.trim(),
          description: roleDescription.trim() || undefined,
          permissions: selectedPermissions,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsCreateOpen(false);
        setRoleName("");
        setRoleDescription("");
        setSelectedPermissions([]);
        router.refresh();
      } else {
        setErrorMsg(data.error?.message || data.error || "Failed to create custom role.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Network error creating custom role.");
    } finally {
      setCreating(false);
    }
  };

  const CORE_WORKSPACE_ROLES = ["OWNER", "ADMIN", "BROKER", "SPECIALIST", "REVIEWER", "MEMBER", "VIEWER"];
  const standardRoles = roles.filter((r) => r.isSystem && CORE_WORKSPACE_ROLES.includes(r.name));
  const customRoles = roles.filter((r) => !r.isSystem);

  return (
    <div className={compact ? "space-y-6" : "space-y-8 max-w-6xl mx-auto"}>
      {compact ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <PanelHeading
            icon={ShieldCheck}
            badge="Roles & Permissions"
            title="Role Definitions & Custom Roles"
            subtitle={`Overview of standard operational roles and custom roles for ${accountName}.`}
            compact
          />
          <div className="flex items-center space-x-2">
            <SyncPermissionsButton />
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="rounded-xl shadow-xs text-xs font-bold bg-brand text-white hover:bg-brand-hover"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Create Custom Role</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-brand text-xs font-semibold mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Roles & Permissions</span>
            </div>
            <h1 className="text-3xl font-extrabold text-ink tracking-tight">Role Definitions</h1>
            <p className="text-ink-muted text-sm mt-1">
              High-level overview of standard operational roles and custom roles for {accountName}.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <SyncPermissionsButton />
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="rounded-xl shadow-xs text-xs font-bold bg-brand text-white hover:bg-brand-hover"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              <span>Create Custom Role</span>
            </Button>
          </div>
        </div>
      )}

      {/* Custom Organization Roles (if any exist) */}
      {customRoles.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center space-x-2">
            <Layers className="w-4 h-4 text-purple-600" />
            <span>Custom Organization Roles ({customRoles.length})</span>
          </h3>
          <div className="space-y-3">
            {customRoles.map((role) => (
              <RoleCard key={role.id} role={role} />
            ))}
          </div>
        </div>
      )}

      {/* Standard System Roles Section */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-brand" />
          <span>Standard System Roles ({standardRoles.length})</span>
        </h3>
        <div className="space-y-3">
          {standardRoles.map((role) => (
            <RoleCard key={role.id} role={role} />
          ))}
        </div>
      </div>

      {/* CREATE CUSTOM ROLE MODAL */}
      {isCreateOpen && (
        <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} titleId="create-custom-role-modal">
          <ModalHeader>
            <div className="flex items-center space-x-2">
              <Layers className="w-5 h-5 text-brand" />
              <h3 id="create-custom-role-modal" className="text-base font-bold text-ink">
                Create Custom Role
              </h3>
            </div>
          </ModalHeader>

          <ModalBody className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-semibold">
                {errorMsg}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <Label className="block mb-1 text-xs font-bold">Role Name</Label>
                <Input
                  type="text"
                  placeholder="e.g. Compliance Auditor, Senior Dispatcher"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>

              <div>
                <Label className="block mb-1 text-xs font-bold">Description</Label>
                <Input
                  type="text"
                  placeholder="Short explanation of what this role is used for..."
                  value={roleDescription}
                  onChange={(e) => setRoleDescription(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            {/* Granular Permission Category Selector */}
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-ink">
                  Select Granular Permissions ({selectedPermissions.length} selected)
                </Label>
                <span className="text-[11px] text-ink-muted">
                  Use 1-click category buttons to add all permissions in a domain
                </span>
              </div>

              {/* Filter bar inside modal */}
              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search permissions..."
                    value={permissionSearch}
                    onChange={(e) => setPermissionSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-muted border border-border rounded-xl text-ink focus:outline-none focus:border-brand"
                  />
                </div>

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-surface-muted border border-border rounded-xl text-ink font-semibold focus:outline-none focus:border-brand"
                >
                  <option value="ALL">All Categories ({categories.length})</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Categories & Sub-Category Permission List */}
              <div className="space-y-4">
                {categories
                  .filter((cat) => selectedCategory === "ALL" || selectedCategory === cat)
                  .map((catName) => {
                    const catPerms = categoryMap.get(catName) || [];
                    const filteredCatPerms = catPerms.filter(
                      (p) =>
                        !permissionSearch.trim() ||
                        p.name.toLowerCase().includes(permissionSearch.toLowerCase()) ||
                        p.description.toLowerCase().includes(permissionSearch.toLowerCase())
                    );

                    if (filteredCatPerms.length === 0) return null;

                    const allSelected = catPerms.every((p) => selectedPermissions.includes(p.name));

                    return (
                      <div key={catName} className="rounded-2xl border border-border bg-surface-muted/30 p-3 space-y-2">
                        {/* Category Header with 1-Click Category Add Button */}
                        <div className="flex items-center justify-between pb-1 border-b border-border">
                          <span className="text-xs font-bold text-brand uppercase tracking-wider">
                            {catName} Domain ({catPerms.length} permissions)
                          </span>

                          <button
                            type="button"
                            onClick={() => handleToggleCategory(catName)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer border ${
                              allSelected
                                ? "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                                : "bg-blue-50 text-brand border-blue-200 hover:bg-blue-100"
                            }`}
                          >
                            {allSelected ? "Remove All Category" : `+ Add All ${catName}`}
                          </button>
                        </div>

                        {/* Granular permissions checkboxes */}
                        <div className="grid grid-cols-1 gap-1.5">
                          {filteredCatPerms.map((perm) => {
                            const isChecked = selectedPermissions.includes(perm.name);
                            return (
                              <label
                                key={perm.name}
                                className={`flex items-start space-x-2.5 p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                                  isChecked
                                    ? "bg-blue-50/70 border-brand/40 text-brand font-semibold"
                                    : "bg-white border-border hover:border-brand/40 text-ink"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleTogglePermission(perm.name)}
                                  className="mt-0.5 rounded border-border text-brand focus:ring-brand shrink-0 cursor-pointer"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="font-mono text-xs font-bold">{perm.name}</div>
                                  <div className="text-[11px] text-ink-muted font-normal leading-normal">{perm.description}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </ModalBody>

          <ModalFooter className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-muted">
              {selectedPermissions.length} permissions selected
            </span>

            <div className="flex items-center space-x-2">
              <Button variant="secondary" type="button" onClick={() => setIsCreateOpen(false)} className="rounded-xl text-xs">
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleCreateCustomRole}
                disabled={creating || !roleName.trim()}
                className="rounded-xl text-xs font-bold bg-brand text-white shadow-xs"
              >
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
                <span>Save Custom Role</span>
              </Button>
            </div>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
