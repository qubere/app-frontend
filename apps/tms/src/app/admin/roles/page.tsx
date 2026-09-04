import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { TmsSidebar } from "@/components/TmsSidebar";
import { TmsHeader } from "@/components/TmsHeader";
import { ShieldCheck, Plus, Check } from "lucide-react";
import { Card, Button } from "@/components/ui";

export default async function AdminRolesPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const roles = [
    {
      name: "OWNER",
      description: "Full administrative authority over workspace, financial billing, dispatch rules, and API keys.",
      permissions: ["account.manage", "users.manage", "dispatch.all", "billing.view", "billing.manage", "integrations.manage"],
      userCount: 1,
    },
    {
      name: "DISPATCHER",
      description: "Can create orders, initiate carrier tenders, approve rate quotes, and manage exceptions.",
      permissions: ["dispatch.all", "orders.manage", "tenders.manage", "quotes.approve", "exceptions.resolve"],
      userCount: 2,
    },
    {
      name: "FINANCE_AUDITOR",
      description: "Access to 3-way invoice matching, audit discrepancies, and payment approvals.",
      permissions: ["invoices.view", "invoices.audit", "invoices.approve", "billing.view"],
      userCount: 1,
    },
    {
      name: "READ_ONLY_VIEWER",
      description: "View-only access to active shipments, order status, and tracking telemetry.",
      permissions: ["shipments.view", "orders.view", "documents.view"],
      userCount: 0,
    },
  ];

  return (
    <div className="min-h-screen bg-surface-muted text-ink flex w-full">
      <TmsSidebar accountName="Enterprise Freight" />

      <div className="flex-1 flex flex-col min-w-0">
        <TmsHeader tenantName="Enterprise Freight" userName="Operations Lead" />

        <main className="flex-1 p-8 overflow-y-auto space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-brand" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-ink">Roles & Permission Grants</h1>
              </div>
              <p className="text-xs text-ink-muted mt-1">
                Configure role definitions and fine-grained access control policies.
              </p>
            </div>
            <Button className="flex items-center space-x-2">
              <Plus className="w-4 h-4" />
              <span>Create Custom Role</span>
            </Button>
          </div>

          {/* Grid of Roles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {roles.map((r) => (
              <Card key={r.name} className="p-6 bg-white border border-border space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <h3 className="font-bold text-sm text-ink">{r.name}</h3>
                    <p className="text-xs text-ink-muted">{r.userCount} member(s) assigned</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-blue-50 text-brand text-[10px] font-bold border border-blue-100">
                    System Role
                  </span>
                </div>
                <p className="text-xs text-ink-muted leading-relaxed">{r.description}</p>
                <div>
                  <p className="text-[11px] font-bold text-ink uppercase tracking-wider mb-2">Granted Permissions:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {r.permissions.map((perm) => (
                      <span key={perm} className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-surface-muted border border-border text-[10px] font-mono text-ink font-semibold">
                        <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>{perm}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
