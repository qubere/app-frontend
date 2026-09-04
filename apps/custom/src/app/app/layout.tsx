import { Suspense } from "react";
import { getAccountContext } from "@/lib/auth";
import { navAccessFromContext } from "@/lib/navigation";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { redirect } from "next/navigation";

// getAccountContext() is React-cache()-deduped, so each of the leaf
// components below awaiting it costs one real lookup per request, not one
// per component. Splitting the account-context-dependent chrome (banner,
// sidebar, header) into its own Suspense boundaries -- instead of awaiting
// it once at the top of this layout -- keeps `children` a sibling that Next
// can start streaming immediately, so page-level loading.tsx fallbacks show
// right away instead of waiting on this shared layout's auth lookup.
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface-muted text-ink flex flex-col selection:bg-brand/20 selection:text-brand">
      <Suspense fallback={null}>
        <ImpersonationBannerSlot />
      </Suspense>

      <div className="flex-1 flex min-w-0">
        <Suspense fallback={<SidebarSkeleton />}>
          <SidebarSlot />
        </Suspense>

        <div className="flex-1 flex flex-col min-w-0">
          <Suspense fallback={<HeaderSkeleton />}>
            <HeaderSlot />
          </Suspense>
          <main className="flex-1 p-8 overflow-y-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}

function displayNameFor(context: NonNullable<Awaited<ReturnType<typeof getAccountContext>>>) {
  return context.firstName || context.lastName
    ? `${context.firstName ?? ""} ${context.lastName ?? ""}`.trim()
    : context.email;
}

async function ImpersonationBannerSlot() {
  const context = await getAccountContext();
  if (!context) redirect("/sign-in");
  if (!context.isImpersonating) return null;

  return (
    <ImpersonationBanner
      actorUserName={context.actorUserName || "System Admin"}
      effectiveUserName={context.effectiveUserName || displayNameFor(context)}
      accountName={context.accountName}
      reason={context.impersonationReason}
    />
  );
}

async function SidebarSlot() {
  const context = await getAccountContext();
  if (!context) redirect("/sign-in");
  const displayName = displayNameFor(context);
  const access = navAccessFromContext(context);

  return (
    <Sidebar
      currentAccountId={context.accountId}
      accountName={context.accountName}
      accountType={context.accountType}
      dataMode={context.dataMode as any}
      roleNames={access.roleNames}
      permissions={access.permissions}
      isPlatformAdmin={access.isPlatformAdmin}
      memberships={context.memberships}
      isImpersonating={context.isImpersonating}
      actorUserName={context.actorUserName || "Frank Multiaccount"}
      effectiveUserName={context.effectiveUserName || displayName}
      effectiveEmail={context.email}
    />
  );
}

async function HeaderSlot() {
  const context = await getAccountContext();
  if (!context) redirect("/sign-in");
  const access = navAccessFromContext(context);

  return (
    <Header
      tenantName={context.accountName}
      userName={displayNameFor(context)}
      isPlatformAdmin={access.isPlatformAdmin}
      roleNames={access.roleNames}
      permissions={access.permissions}
    />
  );
}

function SidebarSkeleton() {
  return (
    <div className="hidden lg:block w-64 shrink-0 h-screen bg-surface-muted border-r border-border animate-pulse" />
  );
}

function HeaderSkeleton() {
  return (
    <div className="h-16 shrink-0 border-b border-border bg-surface-muted/80 backdrop-blur-md animate-pulse" />
  );
}
