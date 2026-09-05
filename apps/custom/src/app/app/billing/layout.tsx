import React from "react";
import { redirect } from "next/navigation";
import { DollarSign } from "lucide-react";
import { PanelHeading } from "@/components/PanelHeading";
import { getAccountContext, hasProductEntitlement } from "@/lib/auth";
import { BillingTabs } from "./BillingTabs";
import { UnauthorizedModuleState } from "@/components/UnauthorizedModuleState";

export default async function BillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getAccountContext();
  if (!ctx) redirect("/sign-in");
  if (!(await hasProductEntitlement(ctx.accountId, "CUSTOMS"))) {
    return (
      <UnauthorizedModuleState
        moduleName="Customs Product Line"
        requiredPermission="product.entitlement.customs"
        adminEmail={ctx.adminEmail}
        isUserAdmin={ctx.isPlatformAdmin || ctx.roleNames.includes("OWNER") || ctx.roleNames.includes("ADMIN")}
      />
    );
  }

  const has = (permission: string) =>
    ctx.isPlatformAdmin || ctx.roleNames.includes("OWNER") || ctx.permissions.includes(permission);

  if (!has("billing.view")) {
    return (
      <UnauthorizedModuleState
        moduleName="Billing & Costing"
        requiredPermission="billing.view"
        adminEmail={ctx.adminEmail}
        isUserAdmin={ctx.isPlatformAdmin || ctx.roleNames.includes("OWNER") || ctx.roleNames.includes("ADMIN")}
      />
    );
  }

  const tabs = [
    { name: "Overview", href: "/app/billing", visible: true },
    { name: "Client Funds", href: "/app/billing/funds", visible: has("billing.funds.view") || has("billing.view") },
    { name: "Clients", href: "/app/billing/clients", visible: has("billing.read") || has("billing.view") },
    { name: "Rate Cards", href: "/app/billing/rate-cards", visible: has("billing.ratecard.view") },
    { name: "Usage Ledger", href: "/app/billing/usage", visible: has("billing.usage.view") },
    { name: "Shipment Economics", href: "/app/billing/shipments", visible: has("billing.charge.view") },
    { name: "Invoices & AR", href: "/app/billing/invoices", visible: has("billing.invoice.view") },
    { name: "Exceptions & Leakage", href: "/app/billing/exceptions", visible: has("billing.exception.view") },
    { name: "Profitability Reports", href: "/app/billing/reports", visible: has("billing.reports.view") },
    { name: "Settings & Costing", href: "/app/billing/settings", visible: has("billing.cost.view") },
  ].filter((tab) => tab.visible);

  return (
    <div className="space-y-8 max-w-6xl mx-auto p-2 sm:p-4">
      <div className="border-b border-[#E5E5EA] pb-6">
        <PanelHeading
          icon={DollarSign}
          badge="Billing, Costing & Unit Economics"
          title="Billing Workspace"
          subtitle="Real-time usage metering, 3-layer shipment unit economics, rate cards, and automated revenue leakage detection."
        />
      </div>

      <BillingTabs tabs={tabs.map(({ name, href }) => ({ name, href }))} />

      <main className="space-y-6">{children}</main>
    </div>
  );
}
