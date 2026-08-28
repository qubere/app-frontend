import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { z } from "zod";

const createPortalInviteSchema = z.object({
  email: z.string().email(),
  clientId: z.string().min(1),
  roleName: z.enum(["CUSTOMER_ADMIN", "CUSTOMER_USER", "CUSTOMER_VIEWER", "CUSTOMER_CUSTOMS_USER", "CUSTOMER_TMS_USER"]).default("CUSTOMER_USER"),
  productScopes: z.array(z.enum(["CUSTOMS", "TMS"])).default(["CUSTOMS"]),
});

export const POST = withAuthenticatedRoute(async ({ req, ctx }) => {
  const body = await req.json();
  const parseVal = createPortalInviteSchema.safeParse(body);
  if (!parseVal.success) {
    return NextResponse.json({ error: "INVALID_INPUT", details: parseVal.error.format() }, { status: 400 });
  }

  const { email, clientId, roleName, productScopes } = parseVal.data;

  // Verify client exists in account
  const client = await db.client.findFirst({
    where: { id: clientId, accountId: ctx.accountId },
  });
  if (!client) {
    return NextResponse.json({ error: "CLIENT_NOT_FOUND" }, { status: 404 });
  }

  // Find or create target role
  const role = await db.role.findFirst({
    where: { accountId: ctx.accountId, name: roleName },
  }) || await db.role.create({
    data: {
      accountId: ctx.accountId,
      name: roleName,
      description: `Customer portal role: ${roleName}`,
    },
  });

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invitation = await db.invitation.create({
    data: {
      accountId: ctx.accountId,
      clientId,
      email,
      roleId: role.id,
      purpose: "CUSTOMER_PORTAL",
      productScopes,
      expiresAt,
      createdByUserId: ctx.userId,
    },
  });

  // Audit log
  await db.auditLog.create({
    data: {
      accountId: ctx.accountId,
      userId: ctx.userId,
      actorUserId: ctx.userId,
      effectiveUserId: ctx.userId,
      action: "PORTAL_INVITATION_CREATE",
      entity: "Invitation",
      entityId: invitation.id,
      clientId,
      newValue: { email, roleName, productScopes },
      source: "BROKER_WORKBENCH",
    },
  });

  return NextResponse.json({
    invitationId: invitation.id,
    token: invitation.token,
    inviteUrl: `https://demo-portal.qubere.ai/invite/${invitation.token}`,
    expiresAt,
  });
}, { permission: "user.invite", write: true });
