import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { z } from "zod";

const visibilitySchema = z.object({
  portalVisibility: z.enum(["INTERNAL", "CUSTOMER"]),
});

export const POST = withAuthenticatedRoute<{ id: string }>(async ({ req, ctx, params }) => {
  const { id } = await params;
  const body = await req.json();
  const parseVal = visibilitySchema.safeParse(body);
  if (!parseVal.success) {
    return NextResponse.json({ error: "INVALID_INPUT", details: parseVal.error.format() }, { status: 400 });
  }

  const { portalVisibility } = parseVal.data;

  const doc = await db.shipmentDocument.findFirst({
    where: { id, accountId: ctx.accountId },
  });

  if (!doc) {
    return NextResponse.json({ error: "DOCUMENT_NOT_FOUND" }, { status: 404 });
  }

  const updatedDoc = await db.shipmentDocument.update({
    where: { id },
    data: { portalVisibility },
  });

  await db.auditLog.create({
    data: {
      accountId: ctx.accountId,
      userId: ctx.userId,
      actorUserId: ctx.userId,
      effectiveUserId: ctx.userId,
      action: "BROKER_DOCUMENT_VISIBILITY_UPDATE",
      entity: "ShipmentDocument",
      entityId: id,
      clientId: doc.clientId,
      newValue: { portalVisibility },
      source: "BROKER_WORKBENCH",
    },
  });

  return NextResponse.json({
    documentId: updatedDoc.id,
    portalVisibility: updatedDoc.portalVisibility,
  });
}, { permission: "specialist.write", write: true });
