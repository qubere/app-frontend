"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, TriangleAlert, Users, RefreshCw } from "lucide-react";
import type { FormattedRole, RolesPermissionsData } from "@/lib/admin/rolesData";

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
      className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-brand/30 bg-blue-50 text-brand hover:bg-blue-100 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
      title="Sync system permission catalogue and grant default role permissions in database"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin text-brand" : ""}`} />
      <span>{syncing ? "Syncing Database..." : "Sync Permissions to DB"}</span>
    </button>
  );
}

function RoleCard({ role }: { role: FormattedRole }) {
  return (
    <section className="rounded-2xl bg-white border border-border p-4 space-y-2 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <h4 className="text-sm font-bold text-ink">{role.name}</h4>
          <span className="px-2 py-0.5 rounded-full border border-border text-[10px] font-semibold text-ink-muted bg-surface-muted">
            {role.isSystem ? "System" : "Custom"}
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
          <Users className="w-3 h-3 text-brand" />
          {role.memberCount} {role.memberCount === 1 ? "member" : "members"}
        </span>
      </div>

      {role.description && <p className="text-xs text-ink-muted">{role.description}</p>}

      {role.granted.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {role.granted.map((permission) => (
            <span
              key={permission.name}
              className="px-1.5 py-0.5 rounded bg-surface-muted text-ink font-mono text-[10px] border border-border"
              title={permission.description}
            >
              {permission.name}
            </span>
          ))}
        </div>
      )}

      {role.gapMissing && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-2 text-xs text-amber-900 mt-2">
          <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
          <span>
            Missing default permissions: <span className="font-mono">{role.gapMissing.join(", ")}</span>
          </span>
        </div>
      )}
    </section>
  );
}

export function PlatformPermissionsPanel({ coverage, roles, permissionCatalogue }: RolesPermissionsData) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-border shadow-2xs">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-brand text-[11px] font-bold border border-blue-100 mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Platform Permissions & Coverage</span>
          </div>
          <h2 className="text-xl font-extrabold text-ink tracking-tight">System Permissions Diagnostic & Roles</h2>
          <p className="text-xs text-ink-muted mt-0.5">
            System-wide permission catalogue database coverage, unseeded codes, and all {roles.length} internal roles.
          </p>
        </div>
        <SyncPermissionsButton />
      </div>

      {/* Database Coverage Warning Banner */}
      {coverage.missing.length > 0 && (
        <div role="status" className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 space-y-2">
          <div className="flex items-center space-x-2">
            <TriangleAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="font-extrabold text-sm">
              {coverage.missing.length} of {coverage.total} catalogued permissions require seeding in database.
            </p>
          </div>
          <p className="leading-relaxed">
            Unseeded permissions: <span className="font-mono font-bold bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">{coverage.missing.join(", ")}</span>
          </p>
        </div>
      )}

      {/* All 21 System Roles Cards */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center space-x-2">
          <Users className="w-4 h-4 text-brand" />
          <span>Standard System Roles ({roles.length})</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {roles.map((role) => (
            <RoleCard key={role.id} role={role} />
          ))}
        </div>
      </div>

      {/* Full Permission Catalogue Reference Table */}
      <section className="rounded-2xl bg-white border border-border p-5 space-y-3 shadow-2xs">
        <h3 className="text-xs font-bold text-ink uppercase tracking-wider">
          Permission Catalogue Reference ({permissionCatalogue.length} codes)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-surface-muted/60 border-b border-border text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                <th className="py-2.5 px-3">Permission Code</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Default Roles</th>
                <th className="py-2.5 px-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {permissionCatalogue.map((permission) => (
                <tr key={permission.name} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2 px-3 font-mono text-xs text-brand font-bold whitespace-nowrap">
                    {permission.name}
                  </td>
                  <td className="py-2 px-3 font-semibold text-ink-muted whitespace-nowrap">{permission.category}</td>
                  <td className="py-2 px-3 text-ink-muted whitespace-nowrap">
                    {permission.defaultRoles.join(", ")}
                  </td>
                  <td className="py-2 px-3 text-ink-muted leading-relaxed">{permission.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
