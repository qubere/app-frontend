import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { parseAndValidateBody } from "@/lib/api/validation";
import { createAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { z } from "zod";

const updateUserSchema = z.object({
  email: z.string().email("Valid email required"),
  // An invitation grants a single initial role; additional roles can be
  // assigned afterward via PATCH once the invite is accepted. Roles are
  // per-account (custom roles like PLANNER) plus system-wide ones (OWNER),
  // not a fixed set, so this is validated against the database below rather
  // than a hardcoded enum.
  roleName: z.string().min(1, "roleName is required"),
});

import { SYSTEM_ROLES } from "@/lib/permissions";

export const GET = withAuthenticatedRoute(async ({ ctx, requestId }) => {
  const memberships = await db.accountMembership.findMany({
    where: { accountId: ctx.accountId },
    include: { user: true, roles: { include: { role: true } } },
    orderBy: { createdAt: "desc" },
  });

  let availableRoles = await db.role.findMany({
    where: { OR: [{ accountId: ctx.accountId }, { accountId: null }] },
    orderBy: { name: "asc" },
  });

  if (availableRoles.length === 0) {
    await Promise.all(
      SYSTEM_ROLES.map((name) =>
        db.role.create({
          data: { name, isSystem: true, accountId: null, description: `System ${name} Role` },
        }).catch(() => null)
      )
    );
    availableRoles = await db.role.findMany({
      where: { OR: [{ accountId: ctx.accountId }, { accountId: null }] },
      orderBy: { name: "asc" },
    });
  }

  const roleNamesList = Array.from(
    new Set([
      ...availableRoles.map((r) => r.name),
      ...SYSTEM_ROLES,
    ])
  ).sort();

  return NextResponse.json({
    accountName: ctx.accountName,
    currentUserId: ctx.userId,
    availableRoles: roleNamesList,
    members: memberships.map((m) => ({
      membershipId: m.id,
      userId: m.user.id,
      email: m.user.email,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      status: m.status,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      roleNames: m.roles.map((mr) => mr.role.name),
    })),
    requestId,
  });
});

export const POST = withAuthenticatedRoute(async ({ req, ctx, requestId }) => {
  const bodyVal = await parseAndValidateBody(req, updateUserSchema, requestId);
  if ("response" in bodyVal) return bodyVal.response;

  try {
    let role = await db.role.findFirst({
      where: {
        OR: [
          { name: bodyVal.data.roleName, accountId: ctx.accountId },
          { name: bodyVal.data.roleName.toUpperCase(), accountId: ctx.accountId },
          { name: bodyVal.data.roleName, accountId: null },
          { name: bodyVal.data.roleName.toUpperCase(), accountId: null },
        ],
      },
    });

    if (!role) {
      try {
        role = await db.role.create({
          data: {
            name: bodyVal.data.roleName,
            accountId: ctx.accountId,
            description: `${bodyVal.data.roleName} Role`,
          },
        });
      } catch {
        role = await db.role.findFirst({
          where: {
            OR: [
              { name: bodyVal.data.roleName },
              { name: bodyVal.data.roleName.toUpperCase() },
            ],
          },
        });
      }
    }

    if (!role) {
      return buildErrorResponse(
        400,
        "INVALID_ROLE",
        `The requested role "${bodyVal.data.roleName}" could not be resolved.`,
        undefined,
        requestId
      );
    }

    const emailClean = bodyVal.data.email.trim().toLowerCase();

    // Find or create the user identity
    let user = await db.user.findFirst({
      where: { email: emailClean },
      include: { memberships: { where: { accountId: ctx.accountId } } },
    });

    if (!user) {
      const nameParts = emailClean.split("@")[0].split(".");
      const firstName = nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1) : "User";
      const lastName = nameParts[1] ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1) : "";
      user = await db.user.create({
        data: {
          email: emailClean,
          firstName,
          lastName,
          clerkUserId: `invited_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        },
        include: { memberships: { where: { accountId: ctx.accountId } } },
      });
    }

    const activeMembership = user.memberships.find((m) => m.deletedAt === null && m.status === "ACTIVE");
    if (activeMembership) {
      return buildErrorResponse(
        409,
        "ALREADY_A_MEMBER",
        "This user is already a member of this account.",
        undefined,
        requestId
      );
    }

    // Create or reactivate account membership
    let membership = user.memberships.find((m) => m.deletedAt === null);
    if (!membership) {
      membership = await db.accountMembership.create({
        data: {
          accountId: ctx.accountId,
          userId: user.id,
          status: "ACTIVE",
        },
      });
    } else {
      membership = await db.accountMembership.update({
        where: { id: membership.id },
        data: { status: "ACTIVE", deletedAt: null },
      });
    }

    await db.accountMembershipRole.upsert({
      where: {
        accountMembershipId_roleId: {
          accountMembershipId: membership.id,
          roleId: role.id,
        },
      },
      create: {
        accountMembershipId: membership.id,
        roleId: role.id,
      },
      update: {},
    });

    const invitation = await db.invitation.create({
      data: {
        accountId: ctx.accountId,
        email: emailClean,
        roleId: role.id,
        status: "ACCEPTED",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdByUserId: ctx.userId,
      },
    });

    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: "USER_INVITED",
      entity: "Invitation",
      entityId: invitation.id,
      source: "UI",
      metadata: { invitedEmail: emailClean, roleName: role.name, membershipId: membership.id },
      success: true,
    });

    return NextResponse.json({
      success: true,
      membershipId: membership.id,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        status: invitation.status,
      },
      requestId,
    });
  } catch (error: unknown) {
    return buildErrorResponse(500, "INTERNAL_ERROR", errorMessage(error) || "Failed to invite user", undefined, requestId);
  }
});

const patchUserSchema = z
  .object({
    membershipId: z.string().min(1),
    // Full replacement set of roles for this membership -- a membership can
    // hold multiple roles simultaneously (e.g. Admin + Agent). Validated
    // against the database below, not a hardcoded enum.
    roleNames: z.array(z.string().min(1)).min(1).optional(),
    status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  })
  .refine((d) => d.roleNames || d.status, {
    message: "At least one of roleNames or status is required",
  });

export const PATCH = withAuthenticatedRoute(async ({ req, ctx, requestId }) => {
  const bodyVal = await parseAndValidateBody(req, patchUserSchema, requestId);
  if ("response" in bodyVal) return bodyVal.response;
  const { membershipId, roleNames, status } = bodyVal.data;

  try {
    const membership = await db.accountMembership.findFirst({
      where: { id: membershipId, accountId: ctx.accountId },
});

    if (!membership) {
      return buildErrorResponse(404, "NOT_FOUND", "Membership not found", undefined, requestId);
    }

    if (membership.userId === ctx.userId) {
      return buildErrorResponse(
        400,
        "SELF_EDIT_FORBIDDEN",
        "You cannot change your own roles or status",
        undefined,
        requestId
      );
    }

    if (roleNames) {
      const roles = await db.role.findMany({
        where: { name: { in: roleNames }, OR: [{ accountId: ctx.accountId }, { accountId: null }] },
      });

      if (roles.length !== new Set(roleNames).size) {
        return buildErrorResponse(400, "INVALID_INPUT", "One or more roles not found", undefined, requestId);
      }

      await db.$transaction([
        db.accountMembershipRole.deleteMany({ where: { accountMembershipId: membershipId } }),
        db.accountMembershipRole.createMany({
          data: roles.map((r) => ({ accountMembershipId: membershipId, roleId: r.id })),
        }),
      ]);
    }

    if (status) {
      await db.accountMembership.update({
        where: { id: membershipId },
        data: { status },
      });
    }

    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: "MEMBERSHIP_UPDATED",
      entity: "AccountMembership",
      entityId: membershipId,
      source: "UI",
      metadata: { roleNames, status },
      success: true,
    });

    return NextResponse.json({ success: true, requestId });
  } catch (error: unknown) {
    return buildErrorResponse(500, "INTERNAL_ERROR", errorMessage(error) || "Failed to update membership", undefined, requestId);
  }

}, { permission: "users.manage", write: true });
