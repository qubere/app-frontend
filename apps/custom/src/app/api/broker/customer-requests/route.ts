import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { z } from "zod";

const createCustomerRequestSchema = z.object({
  clientId: z.string().min(1),
  shipmentId: z.string().optional(),
  tmsOrderId: z.string().optional(),
  tmsLoadId: z.string().optional(),
  domain: z.enum(["CUSTOMS", "TMS", "GENERAL"]).default("CUSTOMS"),
  type: z.enum(["QUESTION", "DOCUMENT", "CONFIRMATION"]),
  title: z.string().min(1),
  description: z.string().optional(),
  dueAt: z.string().optional(),
  initialMessage: z.string().min(1),
});

export const POST = withAuthenticatedRoute(async ({ req, ctx }) => {
  const body = await req.json();
  const parseVal = createCustomerRequestSchema.safeParse(body);
  if (!parseVal.success) {
    return NextResponse.json({ error: "INVALID_INPUT", details: parseVal.error.format() }, { status: 400 });
  }

  const {
    clientId,
    shipmentId,
    tmsOrderId,
    tmsLoadId,
    domain,
    type,
    title,
    description,
    dueAt,
    initialMessage,
  } = parseVal.data;

  // Create request and initial broker message in transaction
  const [request] = await db.$transaction([
    db.customerRequest.create({
      data: {
        accountId: ctx.accountId,
        clientId,
        shipmentId: shipmentId || null,
        tmsOrderId: tmsOrderId || null,
        tmsLoadId: tmsLoadId || null,
        domain,
        type,
        title,
        description,
        dueAt: dueAt ? new Date(dueAt) : null,
        createdByUserId: ctx.userId,
        status: "OPEN",
        messages: {
          create: {
            accountId: ctx.accountId,
            clientId,
            authorUserId: ctx.userId,
            authorType: "BROKER",
            body: initialMessage,
          },
        },
      },
      include: {
        messages: true,
      },
    }),
    db.auditLog.create({
      data: {
        accountId: ctx.accountId,
        userId: ctx.userId,
        actorUserId: ctx.userId,
        effectiveUserId: ctx.userId,
        action: "BROKER_CUSTOMER_REQUEST_CREATE",
        entity: "CustomerRequest",
        entityId: "NEW",
        clientId,
        newValue: { title, type, domain, shipmentId },
        source: "BROKER_WORKBENCH",
      },
    }),
  ]);

  return NextResponse.json({ request }, { status: 201 });
});

export const GET = withAuthenticatedRoute(async ({ req, ctx }) => {
  const { searchParams } = new URL(req.url);
  const shipmentId = searchParams.get("shipmentId");

  const requests = await db.customerRequest.findMany({
    where: {
      accountId: ctx.accountId,
      ...(shipmentId ? { shipmentId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      assignedUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          authorUser: { select: { firstName: true, lastName: true, email: true } },
        },
      },
      documents: {
        orderBy: { createdAt: "desc" },
        include: {
          document: { select: { id: true, fileName: true, fileUrl: true, status: true } },
        },
      },
    },
  });

  return NextResponse.json({ requests });
});

export const PATCH = withAuthenticatedRoute(async ({ req, ctx }) => {
  const body = await req.json();
  const { requestId, assignedUserId } = body;
  if (!requestId) {
    return NextResponse.json({ error: "MISSING_REQUEST_ID" }, { status: 400 });
  }

  const updated = await db.customerRequest.update({
    where: { id: requestId, accountId: ctx.accountId },
    data: { assignedUserId: assignedUserId || null },
    include: { assignedUser: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });

  return NextResponse.json({ request: updated });
});

