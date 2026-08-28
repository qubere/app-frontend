import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@qubere/db";
import { defaultPermissionsForRole, PERMISSION_NAMES } from "./permissions";

export interface AccountContext {
  userId: string; // Effective user ID
  actorUserId: string; // Authenticated actor user ID
  effectiveUserId: string; // Effective operating user ID
  clerkUserId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  isImpersonating: boolean;
  impersonationSessionId?: string;
  impersonationReason?: string;
  actorUserName?: string;
  effectiveUserName?: string;
  isPlatformAdmin: boolean;
  isSuperAdminReadWrite?: boolean;
  isSuperAdminRead?: boolean;
  isSuperAdminSettings?: boolean;
  platformRoles: string[];
  accountId: string;
  accountName: string;
  accountSlug: string;
  accountType: "ENTERPRISE" | "INDIVIDUAL" | string;
  dataMode: string;
  ownerUserId?: string | null;
  membershipId: string;
  roleIds: string[];
  roleNames: string[];
  permissions: string[];
  adminEmail?: string;
  authorizedClientIds: string[];
  isAllClients: boolean;
  memberships: Array<{
    accountId: string;
    accountName: string;
    accountSlug: string;
    accountType: string;
    dataMode: string;
    roleNames: string[];
  }>;
  account: {
    id: string;
    name: string;
    slug: string;
    type: string;
    status: string;
    ownerUserId?: string | null;
    createdAt: Date;
  };
}

export const ACTIVE_ACCOUNT_COOKIE = "qubere_active_account_id";

async function loadAccountContext(): Promise<AccountContext | null> {
  const startTime = Date.now();
  try {
    const { userId: clerkUserId } = await auth();
    const authDuration = Date.now() - startTime;
    if (!clerkUserId) {
      console.log(
        `[ThirdPartyHTTP] [${new Date().toISOString()}] [User: anonymous] [Account: N/A] [Provider: CLERK_AUTH] auth() -> Status: 401 Unauthenticated (${authDuration}ms)`
      );
      if (process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_APP_ENV === "demo") {
        return await getDemoAccountContext();
      }
      return null;
    }

    const userSelect = {
      id: true,
      clerkUserId: true,
      email: true,
      firstName: true,
      lastName: true,
      deletedAt: true,
      platformRoles: {
        select: {
          platformRole: {
            select: { name: true },
          },
        },
      },
      memberships: {
        where: { deletedAt: null },
        select: {
          id: true,
          status: true,
          accountId: true,
          account: {
            select: {
              id: true,
              name: true,
              slug: true,
              type: true,
              status: true,
              deletedAt: true,
              ownerUserId: true,
              dataMode: true,
              createdAt: true,
              ownerUser: { select: { email: true, firstName: true, lastName: true } },
            },
          },
          roles: {
            select: {
              roleId: true,
              role: {
                select: {
                  id: true,
                  name: true,
                  rolePermissions: {
                    select: {
                      permission: {
                        select: { name: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as const;

    let actorUser = await db.user.findFirst({
      where: { clerkUserId, deletedAt: null },
      select: userSelect,
    });

    if (!actorUser) {
      const user = await currentUser();
      if (!user) return null;

      const email = user.emailAddresses[0]?.emailAddress?.toLowerCase();
      if (!email) return null;

      actorUser = await db.user.findFirst({
        where: { email, deletedAt: null },
        select: userSelect,
      });

      if (actorUser && actorUser.clerkUserId !== clerkUserId) {
        await db.user.update({
          where: { id: actorUser.id },
          data: { clerkUserId },
        });
        actorUser.clerkUserId = clerkUserId;
      }
    }

    if (!actorUser) {
      return null;
    }

    const platformRoleNames = actorUser.platformRoles.map((pr) => pr.platformRole.name);
    const isSuperAdminReadWrite = platformRoleNames.includes("SUPER_ADMIN_READWRITE") || platformRoleNames.includes("PLATFORM_ADMIN");
    const isSuperAdminRead = platformRoleNames.includes("SUPER_ADMIN_READ");
    const isSuperAdminSettings = platformRoleNames.includes("SUPER_ADMIN_SETTINGS") || platformRoleNames.includes("SUPER_ADMIN");
    const isPlatformAdmin = isSuperAdminReadWrite || isSuperAdminRead || isSuperAdminSettings;

    // Check if actor has an active impersonation session
    const now = new Date();
    const activeImpersonation = (db as any).impersonationSession?.findFirst
      ? await (db as any).impersonationSession.findFirst({
          where: {
            actorUserId: actorUser.id,
            endedAt: null,
            expiresAt: { gt: now },
          },
          include: {
            effectiveUser: {
              include: {
                memberships: {
                  where: { deletedAt: null, status: "ACTIVE" },
                  include: {
                    account: true,
                    roles: {
                      include: {
                        role: {
                          include: {
                            rolePermissions: { include: { permission: true } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            account: true,
          },
        })
      : null;

    let effectiveUser = actorUser;
    let isImpersonating = false;
    let impersonationSessionId: string | undefined = undefined;
    let impersonationReason: string | undefined = undefined;
    let activeMembership: any = null;

    if (activeImpersonation && activeImpersonation.effectiveUser) {
      isImpersonating = true;
      impersonationSessionId = activeImpersonation.id;
      impersonationReason = activeImpersonation.reason;
      effectiveUser = activeImpersonation.effectiveUser as any;

      activeMembership = activeImpersonation.effectiveUser.memberships.find(
        (m: any) => m.accountId === activeImpersonation.accountId
      );
    } else {
      let activeAccountIdCookie: string | undefined = undefined;
      try {
        const cookieStore = await cookies();
        activeAccountIdCookie = cookieStore.get(ACTIVE_ACCOUNT_COOKIE)?.value;
      } catch {
        // Safe fallback if called outside Next.js request context
      }

      if (activeAccountIdCookie) {
        activeMembership = actorUser.memberships.find(
          (m) => m.accountId === activeAccountIdCookie && m.status === "ACTIVE" && m.account.deletedAt === null
        );
      }

      if (!activeMembership) {
        activeMembership = actorUser.memberships.find(
          (m) => m.status === "ACTIVE" && m.account.deletedAt === null
        );
        if (activeMembership) {
          try {
            const cookieStore = await cookies();
            cookieStore.set(ACTIVE_ACCOUNT_COOKIE, activeMembership.account.id, { path: "/" });
          } catch {
            // Ignore in read-only server component contexts
          }
        }
      }
    }

    if (
      !activeMembership ||
      activeMembership.status !== "ACTIVE" ||
      activeMembership.account.status !== "ACTIVE" ||
      activeMembership.account.deletedAt !== null
    ) {
      return null;
    }

    const explicitPermissions = activeMembership.roles.flatMap((mr: any) =>
      mr.role.rolePermissions ? mr.role.rolePermissions.map((rp: any) => rp.permission.name) : []
    );
    const defaultRolePermissions = activeMembership.roles.flatMap((mr: any) =>
      defaultPermissionsForRole(mr.role.name)
    );

    const permissions = Array.from(
      new Set<string>([
        ...explicitPermissions,
        ...defaultRolePermissions,
        ...(isPlatformAdmin ? (PERMISSION_NAMES as readonly string[]) : []),
      ])
    );
    const roleIds = activeMembership.roles.map((mr: any) => mr.roleId);
    const roleNames = activeMembership.roles.map((mr: any) => mr.role.name);

    // Compute scope
    const isAllClients = roleNames.some((r: string) =>
      ["BROKER_ADMIN", "TMS_ADMIN", "OWNER", "ADMIN"].includes(r.toUpperCase())
    ) || isPlatformAdmin;

    let authorizedClientIds: string[] = [];
    if (!isAllClients) {
      const [directAssignments, teamMemberships] = await Promise.all([
        (db as any).userClientAssignment?.findMany
          ? (db as any).userClientAssignment.findMany({
              where: { userId: effectiveUser.id },
              select: { clientId: true },
            })
          : Promise.resolve([]),
        (db as any).accountTeamMembership?.findMany
          ? (db as any).accountTeamMembership.findMany({
              where: { userId: effectiveUser.id },
              select: {
                team: {
                  select: { clients: { select: { clientId: true } } },
                },
              },
            })
          : Promise.resolve([]),
      ]);

      authorizedClientIds = Array.from(
        new Set<string>([
          ...directAssignments.map((a: any) => a.clientId),
          ...teamMemberships.flatMap((tm: any) => tm.team.clients.map((c: any) => c.clientId)),
        ])
      );
    }

    const allMemberships = actorUser.memberships
      .filter((m) => m.status === "ACTIVE" && m.account.deletedAt === null)
      .map((m) => ({
        accountId: m.account.id,
        accountName: m.account.name,
        accountSlug: m.account.slug,
        accountType: m.account.type,
        dataMode: m.account.dataMode as string,
        roleNames: m.roles.map((mr) => mr.role.name),
      }));

    const actorUserName = [actorUser.firstName, actorUser.lastName].filter(Boolean).join(" ") || actorUser.email;
    const effectiveUserName = [effectiveUser.firstName, effectiveUser.lastName].filter(Boolean).join(" ") || effectiveUser.email;

    const adminEmail =
      (activeMembership.account as any)?.ownerUser?.email ||
      (actorUser.email ? actorUser.email : "admin@qubere.ai");

    return {
      userId: effectiveUser.id,
      actorUserId: actorUser.id,
      effectiveUserId: effectiveUser.id,
      clerkUserId: actorUser.clerkUserId,
      email: effectiveUser.email,
      adminEmail,
      firstName: effectiveUser.firstName,
      lastName: effectiveUser.lastName,
      isImpersonating,
      impersonationSessionId,
      impersonationReason,
      actorUserName,
      effectiveUserName,
      isPlatformAdmin,
      isSuperAdminReadWrite,
      isSuperAdminRead,
      isSuperAdminSettings,
      platformRoles: platformRoleNames,
      accountId: activeMembership.account.id,
      accountName: activeMembership.account.name,
      accountSlug: activeMembership.account.slug,
      accountType: activeMembership.account.type,
      dataMode: activeMembership.account.dataMode,
      ownerUserId: activeMembership.account.ownerUserId,
      membershipId: activeMembership.id,
      roleIds,
      roleNames,
      permissions,
      authorizedClientIds,
      isAllClients,
      memberships: allMemberships,
      account: activeMembership.account,
    };
  } catch (error: unknown) {
    if (
      (error instanceof Error && error.message.includes("DYNAMIC_SERVER_USAGE")) ||
      (typeof error === "object" && error !== null && "digest" in error && (error as Record<string, unknown>).digest === "DYNAMIC_SERVER_USAGE")
    ) {
      throw error;
    }
    console.error("Error retrieving account context:", error);
    return null;
  }
}

export async function getDemoAccountContext(): Promise<AccountContext | null> {
  try {
    let demoAccount = await db.account.findFirst({
      where: {
        clients: {
          some: { name: { in: ["Target Corporation", "Amazon Import Services"] } },
        },
      },
      include: {
        clients: { select: { id: true } },
      },
    });

    if (!demoAccount) {
      demoAccount = await db.account.findFirst({
        where: { id: "cmtcfi6r7000ifx6vpmkuymwk" },
        include: {
          clients: { select: { id: true } },
        },
      });
    }

    if (!demoAccount) {
      demoAccount = await db.account.findFirst({
        include: { clients: { select: { id: true } } },
      });
    }

    if (!demoAccount) return null;

    let demoUser = await db.user.findFirst({
      where: {
        memberships: {
          some: { accountId: demoAccount.id },
        },
      },
      include: {
        memberships: {
          where: { accountId: demoAccount.id },
          include: {
            roles: {
              include: {
                role: {
                  include: {
                    rolePermissions: {
                      include: { permission: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!demoUser) {
      demoUser = await db.user.findFirst({
        include: {
          memberships: {
            include: {
              roles: {
                include: {
                  role: {
                    include: {
                      rolePermissions: {
                        include: { permission: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
    }

    const userId = demoUser?.id || "demo_user_id";
    const email = demoUser?.email || "sarah.jenkins@apexglobal.com";
    const firstName = demoUser?.firstName || "Sarah";
    const lastName = demoUser?.lastName || "Jenkins";
    const clerkUserId = demoUser?.clerkUserId || "user_demo_123";

    const membership = demoUser?.memberships?.[0];
    const roleNames = membership?.roles.map((r) => r.role.name) || ["CUSTOMER_ADMIN"];
    const permissions = Array.from(
      new Set(
        membership?.roles.flatMap((r) =>
          r.role.rolePermissions.map((rp) => rp.permission.name)
        ) || []
      )
    );

    const clientIds = demoAccount.clients.map((c) => c.id);

    return {
      userId,
      actorUserId: userId,
      effectiveUserId: userId,
      clerkUserId,
      email,
      firstName,
      lastName,
      isImpersonating: false,
      isPlatformAdmin: false,
      platformRoles: [],
      accountId: demoAccount.id,
      accountName: demoAccount.name,
      accountSlug: demoAccount.slug,
      accountType: demoAccount.type,
      dataMode: demoAccount.dataMode,
      ownerUserId: demoAccount.ownerUserId,
      membershipId: membership?.id || "demo_mem",
      roleIds: membership?.roles.map((r) => r.roleId) || [],
      roleNames,
      permissions: permissions.length > 0 ? permissions : ["porter", "portal.access", "portal.shipments.read", "portal.entries.read", "portal.documents.read", "portal.invoices.read"],
      authorizedClientIds: clientIds,
      isAllClients: true,
      memberships: [
        {
          accountId: demoAccount.id,
          accountName: demoAccount.name,
          accountSlug: demoAccount.slug,
          accountType: demoAccount.type,
          dataMode: demoAccount.dataMode,
          roleNames,
        },
      ],
      account: demoAccount as any,
    };
  } catch (err) {
    console.error("Failed to load demo account context:", err);
    return null;
  }
}

export const getAccountContext = cache(loadAccountContext);

export async function hasPermission(requiredPermission: string): Promise<boolean> {
  const context = await getAccountContext();
  if (!context) return false;
  if (context.isPlatformAdmin) return true;
  if (context.roleNames.includes("OWNER")) return true;
  if (requiredPermission === "tms.access") {
    const hasTmsAccessRole = context.roleNames.some((r) =>
      ["ADMIN", "MEMBER", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_BILLING", "TMS_VIEWER", "BROKER_ADMIN", "BROKER_MANAGER"].includes(r.toUpperCase())
    );
    if (hasTmsAccessRole) return true;
  }
  return context.permissions.includes(requiredPermission);
}

