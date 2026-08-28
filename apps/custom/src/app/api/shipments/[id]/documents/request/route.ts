import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { parseAndValidateBody, validatePathParams } from "@/lib/api/validation";
import { db } from "@/lib/db";
import { buildErrorResponse } from "@/lib/api/error";
import { createClerkClient } from "@clerk/backend";
import { Resend } from "resend";
import { signUploadToken } from "@/lib/uploadToken";
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
          const newUser = await clerkClient.users.createUser({
            emailAddress: [recipientEmail],
            password: "QuberePass2026!",
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

      // Ensure "porter" permission & CUSTOMER_USER role exist
      const porterPerm = await db.permission.upsert({
        where: { name: "porter" },
        update: {},
        create: { name: "porter", description: "Porter View permission" },
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

    // 4. Send Email Notification
    const apiKey = process.env.RESEND_API_KEY;
    const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || "http://localhost:3002";
    const requestPortalUrl = `${portalUrl}/requests/${customerRequest.id}`;

    if (apiKey) {
      try {
        const token = await signUploadToken({
          shipmentId,
          accountId: ctx.accountId,
          documentType,
          recipientEmail,
        });

        const fromAddress = process.env.RESEND_FROM_ADDRESS ?? "noreply@qubere.ai";
        const resend = new Resend(apiKey);
        await resend.emails.send({
          from: fromAddress,
          to: [recipientEmail],
          subject: `Action Required: Upload ${documentType} — Shipment ${shipmentRef}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#1a1a2e">
              <h2 style="margin:0 0 16px;font-size:20px;font-weight:700">Qubere Customer Portal — Document Upload Request</h2>
              <p style="margin:0 0 12px;font-size:15px;line-height:1.6">
                You have been assigned Porter access to fulfill a document request for customs entry processing:
              </p>
              <div style="background:#f4f4f8;border-radius:10px;padding:16px 20px;margin:0 0 20px;border-left:4px solid #0071e3">
                <strong style="font-size:15px">${documentType}</strong><br/>
                <span style="color:#666;font-size:13px">Shipment reference: ${shipmentRef}</span>
              </div>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#444">
                Log into the Qubere Customer Portal to review your action items and upload the document.
              </p>
              <a href="${requestPortalUrl}"
                 style="display:inline-block;background:#0071e3;color:white;font-weight:600;font-size:15px;
                        padding:12px 28px;border-radius:8px;text-decoration:none">
                Open Action Item in Customer Portal →
              </a>
              <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb"/>
              <p style="margin:0;font-size:12px;color:#999">
                Sent by Qubere · Trade Compliance Platform
              </p>
            </div>
          `,
        });
      } catch (err) {
        console.error("[Counterparty Request] Email send failure:", err);
      }
    }

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
