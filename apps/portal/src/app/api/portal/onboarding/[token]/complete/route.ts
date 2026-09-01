import { NextResponse } from "next/server";
import { db } from "@qubere/db";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await db.invitation.findFirst({
    where: { token, purpose: "CUSTOMER_PORTAL", status: "ACCEPTED" },
    select: { clientId: true, accountId: true },
  });
  if (!invitation?.clientId) return NextResponse.json({ error: "Invalid token" }, { status: 404 });

  const onboardingCase = await db.onboardingCase.findFirst({
    where: { accountId: invitation.accountId, clientId: invitation.clientId },
    orderBy: { createdAt: "desc" },
    select: { id: true, accountId: true, status: true },
  });
  if (!onboardingCase) return NextResponse.json({ error: "No onboarding case" }, { status: 404 });

  await db.onboardingEvent.create({
    data: {
      accountId: invitation.accountId,
      caseId: onboardingCase.id,
      type: "PORTAL_WIZARD_COMPLETED",
      actorType: "PORTAL",
      detail: {},
    },
  });

  // If still draft, advance to client_intake so broker can see it's ready for review
  if (onboardingCase.status === "draft") {
    await db.onboardingCase.update({
      where: { id: onboardingCase.id },
      data: { status: "client_intake" },
    });
  }

  return NextResponse.json({ ok: true });
}
