import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { parseAndValidateBody, validatePathParams } from "@/lib/api/validation";
import { db } from "@/lib/db";
import { buildErrorResponse } from "@/lib/api/error";
import { createClerkClient } from "@clerk/backend";
import { PlatformEmailService } from "@/lib/email/platformEmailService";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string().min(1) });

const bodySchema = z.object({
  documentType: z.string().min(1).max(200),
  recipientEmail: z.string().email(),
});

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ req, ctx, requestId, params }) => {
    const paramsVal = validatePathParams(params, paramsSchema, requestId);
    if ("response" in paramsVal) return paramsVal.response;
    const { id: shipmentId } = paramsVal.data;

    const body = await parseAndValidateBody(req, bodySchema, requestId);
    if ("response" in body) return body.response;
    const { documentType, recipientEmail } = body.data;

    const shipment = await db.shipment.findFirst({
      where: { id: shipmentId, accountId: ctx.accountId },
      select: { id: true, shipmentNumber: true, clientId: true, importerName: true, accountId: true },
    });
    if (!shipment) {
      return buildErrorResponse(404, "NOT_FOUND", "Shipment not found", undefined, requestId);
    }

    const shipmentRef = shipment.shipmentNumber ?? shipmentId.slice(0, 8).toUpperCase();

    // 1. Resolve Target Client
    let targetClientId = shipment.clientId;
    if (!targetClientId) {
      const importerName = shipment.importerName || "Target Corporation";
      let client = await db.client.findFirst({
        where: { accountId: ctx.accountId, name: { contains: importerName, mode: "insensitive" } },
      });
      if (!client) {
        client = await db.client.create({
          data: {
            accountId: ctx.accountId,
            name: importerName,
            contactName: recipientEmail.split("@")[0],
            contactEmail: recipientEmail,
            status: "ACTIVE",
          },
        });
      }
      targetClientId = client.id;
      await db.shipment.update({
        where: { id: shipment.id },
        data: { clientId: targetClientId },
      });
    }

    // 2. Create CustomerRequest in Database
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + 7);

    const customerRequest = await db.customerRequest.create({
      data: {
        accountId: ctx.accountId,
        clientId: targetClientId,
        shipmentId: shipment.id,
        type: "DOCUMENT",
        title: `Upload ${documentType}`,
        description: `Customs broker requested signed copy of ${documentType} for shipment ${shipmentRef}.`,
        status: "OPEN",
        dueAt,
        messages: {
          create: [
            {
              accountId: ctx.accountId,
              clientId: targetClientId,
              authorType: "BROKER",
              body: `Please upload Commercial Invoice / ${documentType} for shipment ${shipmentRef} before customs clearance deadline.`,
            },
          ],
        },
      },
    });

    // 3. Auto-provision User & Grant Porter Role / Client Assignment
    try {
      const clerkSecretKey = process.env.CLERK_SECRET_KEY;
      let clerkUserId: string | null = null;

      if (clerkSecretKey && !clerkSecretKey.startsWith("sk_test_mock")) {
        const clerkClient = createClerkClient({ secretKey: clerkSecretKey });
        const existingUsers = await clerkClient.users.getUserList({ emailAddress: [recipientEmail] });
        if (existingUsers.data.length > 0) {
          clerkUserId = existingUsers.data[0].id;
        } else {
          // No password: the recipient sets their own credential via the Clerk
          // invitation / first-sign-in flow. Never provision a login-capable
          // account with a shared or predictable password.
          // See docs/plans/review/CUSTOMER-PORTAL-PR97-REVIEW.md (P0-7).
          const newUser = await clerkClient.users.createUser({
            emailAddress: [recipientEmail],
            skipPasswordRequirement: true,
            firstName: "Porter",
            lastName: recipientEmail.split("@")[0],
          });
          clerkUserId = newUser.id;
        }
      }

      // Sync user to DB
      let user = await db.user.findFirst({ where: { email: recipientEmail } });
      if (!user) {
        user = await db.user.create({
          data: {
            clerkUserId: clerkUserId || `user_${Date.now()}`,
            email: recipientEmail,
            firstName: "Porter",
            lastName: recipientEmail.split("@")[0],
          },
        });
      } else if (clerkUserId && user.clerkUserId !== clerkUserId) {
        await db.user.update({
          where: { id: user.id },
          data: { clerkUserId },
        });
      }

      // Assign customerRequest to user
      await db.customerRequest.update({
        where: { id: customerRequest.id },
        data: { assignedUserId: user.id },
      });

      // Ensure the porter-view permission & CUSTOMER_USER role exist
      const porterPerm = await db.permission.upsert({
        where: { name: "portal.porter" },
        update: {},
        create: { name: "portal.porter", description: "Porter View permission" },
      });

      let role = await db.role.findFirst({
        where: { accountId: ctx.accountId, name: "CUSTOMER_USER" },
      });
      if (!role) {
        role = await db.role.create({
          data: {
            accountId: ctx.accountId,
            name: "CUSTOMER_USER",
            description: "Porter Customer User Role",
          },
        });
      }

      await db.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: porterPerm.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: porterPerm.id,
        },
      });

      // Grant AccountMembership & AccountMembershipRole
      const membership = await db.accountMembership.upsert({
        where: {
          accountId_userId: {
            accountId: ctx.accountId,
            userId: user.id,
          },
        },
        update: { status: "ACTIVE" },
        create: {
          accountId: ctx.accountId,
          userId: user.id,
          status: "ACTIVE",
        },
      });

      await db.accountMembershipRole.upsert({
        where: {
          accountMembershipId_roleId: {
            accountMembershipId: membership.id,
            roleId: role.id,
          },
        },
        update: {},
        create: {
          accountMembershipId: membership.id,
          roleId: role.id,
        },
      });

      // Assign user to Client Scope
      await db.userClientAssignment.upsert({
        where: {
          userId_clientId: {
            userId: user.id,
            clientId: targetClientId,
          },
        },
        update: {},
        create: {
          userId: user.id,
          clientId: targetClientId,
        },
      });
    } catch (err) {
      console.error("[Counterparty Request] Error provisioning user:", err);
    }

    // 4. Send Email Notification via Platform Email Service
    const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || "http://localhost:3002";
    const requestPortalUrl = `${portalUrl}/requests/${customerRequest.id}`;

    PlatformEmailService.sendTaskAssignmentNotification({
      toEmail: recipientEmail,
      toName: recipientEmail.split("@")[0],
      taskTitle: `Upload ${documentType}`,
      actionId: `ACT-${customerRequest.id.slice(-4).toUpperCase()}`,
      shipmentNumber: shipmentRef,
      assignedByName: ctx.email || "Brokerage Admin",
      targetUrl: requestPortalUrl,
    }).catch((err) => console.error("[Counterparty Request] Email notification failure:", err));

    return NextResponse.json({
      sent: true,
      recipientEmail,
      documentType,
      customerRequestId: customerRequest.id,
      requestPortalUrl,
    });
  },
  { permission: "shipments.manage", write: true }
);
