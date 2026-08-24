import { getAccountContext } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getAccountContext();

  if (!context) {
    redirect("/sign-in");
  }

  const displayName =
    context.firstName || context.lastName
      ? `${context.firstName ?? ""} ${context.lastName ?? ""}`.trim()
      : context.email;

  return (
    <div className="min-h-screen bg-surface-muted text-ink flex flex-col selection:bg-brand/20 selection:text-brand">
      {context.isImpersonating && (
        <ImpersonationBanner
          actorUserName={context.actorUserName || "System Admin"}
          effectiveUserName={context.effectiveUserName || displayName}
          accountName={context.accountName}
          reason={context.impersonationReason}
        />
      )}

      <div className="flex-1 flex min-w-0">
        {/* Sidebar Navigation */}
        <Sidebar
          currentAccountId={context.accountId}
          accountName={context.accountName}
          accountType={context.accountType}
          dataMode={context.dataMode as any}
          roleNames={context.roleNames}
          isPlatformAdmin={context.isPlatformAdmin}
          memberships={context.memberships}
          isImpersonating={context.isImpersonating}
          actorUserName={context.actorUserName || "Frank Multiaccount"}
          effectiveUserName={context.effectiveUserName || displayName}
          effectiveEmail={context.email}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <Header
            tenantName={context.accountName}
            userName={displayName}
            isPlatformAdmin={context.isPlatformAdmin}
            roleNames={context.roleNames}
          />
          <main className="flex-1 p-8 overflow-y-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}
