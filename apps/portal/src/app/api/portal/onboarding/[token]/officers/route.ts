import { syncClientSetup } from "@qubere/db/services/client-setup-service";
import { NextResponse } from "next/server";
import { db } from "@qubere/db";
import type { Prisma } from "@prisma/client";

async function resolveEntityFromToken(token: string) {
  const invitation = await db.invitation.findFirst({
    where: { token, purpose: "CUSTOMER_PORTAL", status: "ACCEPTED" },
    select: { clientId: true, accountId: true },
  });
  if (!invitation?.clientId) return null;
  const onboardingCase = await db.onboardingCase.findFirst({
    where: { accountId: invitation.accountId, clientId: invitation.clientId },
    orderBy: { createdAt: "desc" },
    select: { id: true, accountId: true, entities: { take: 1, select: { id: true } } },
  });
  if (!onboardingCase) return null;
  return { ...onboardingCase, invitation };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await resolveEntityFromToken(token);
  if (!ctx) return NextResponse.json({ error: "Invalid token" }, { status: 404 });

  const { officers } = (await req.json().catch(() => ({}))) as {
    officers?: Array<{ name: string; title: string; role: string }>;
  };

  if (!Array.isArray(officers)) return NextResponse.json({ error: "officers must be an array" }, { status: 400 });

  const entity = ctx.entities[0];
  if (!entity) return NextResponse.json({ error: "No entity found" }, { status: 404 });

  await db.onboardingEntity.update({
    where: { id: entity.id },
    data: { officers: officers as unknown as Prisma.InputJsonValue },
  });

  await db.onboardingEvent.create({
    data: {
      accountId: ctx.accountId,
      caseId: ctx.id,
      type: "PORTAL_OFFICERS_SUBMITTED",
      actorType: "PORTAL",
      detail: { entityId: entity.id, count: officers.length, officers },
    },
  });

  await db.onboardingEvent.create({
    data: {
      accountId: ctx.accountId,
      caseId: ctx.id,
      type: "PORTAL_OFFICERS_PROPOSAL",
      actorType: "PORTAL",
      detail: { entityId: entity.id, proposals: officers },
    },
  });

  await syncClientSetup(ctx.accountId, ctx.invitation.clientId!);
  return NextResponse.json({ ok: true });
}
