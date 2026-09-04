import { NextResponse } from "next/server";
import { db } from "@qubere/db";

async function resolveEntityFromToken(token: string) {
  const invitation = await db.invitation.findFirst({
    where: { token, purpose: "CUSTOMER_PORTAL", status: "ACCEPTED" },
    select: { clientId: true, accountId: true },
  });
  if (!invitation?.clientId) return null;
  const onboardingCase = await db.onboardingCase.findFirst({
    where: { accountId: invitation.accountId, clientId: invitation.clientId },
    orderBy: { createdAt: "desc" },
    select: { id: true, accountId: true, entities: { take: 1, select: { id: true, importerOfRecordId: true } } },
  });
  if (!onboardingCase) return null;
  return { ...onboardingCase, invitation };
}

// PATCH — submit entity correction proposals (written as a review item, not a direct overwrite)
export async function PATCH(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await resolveEntityFromToken(token);
  if (!ctx) return NextResponse.json({ error: "Invalid token" }, { status: 404 });

  const body: Record<string, string> = await req.json().catch(() => ({}));
  const entity = ctx.entities[0];
  if (!entity) return NextResponse.json({ error: "No entity found" }, { status: 404 });

  // Store corrections as an OnboardingEvent detail (proposal model: broker reviews before writing)
  await db.onboardingEvent.create({
    data: {
      accountId: ctx.accountId,
      caseId: ctx.id,
      type: "PORTAL_ENTITY_CORRECTION",
      actorType: "PORTAL",
      detail: { entityId: entity.id, corrections: body },
    },
  });

  return NextResponse.json({ ok: true });
}
