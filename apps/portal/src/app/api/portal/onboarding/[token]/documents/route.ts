import { NextResponse } from "next/server";
import { db } from "@qubere/db";
import { storeDocumentBytes } from "@qubere/storage";

async function resolveInvitation(token: string) {
  return db.invitation.findFirst({
    where: { token, purpose: "CUSTOMER_PORTAL", status: "ACCEPTED" },
    select: { clientId: true, accountId: true },
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await resolveInvitation(token);
  if (!invitation?.clientId) return NextResponse.json({ error: "Invalid token" }, { status: 404 });

  const onboardingCase = await db.onboardingCase.findFirst({
    where: { accountId: invitation.accountId, clientId: invitation.clientId },
    orderBy: { createdAt: "desc" },
    select: { id: true, accountId: true },
  });
  if (!onboardingCase) return NextResponse.json({ error: "No onboarding case" }, { status: 404 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

  const file = form.get("file") as File | null;
  const docType = (form.get("docType") as string | null) ?? "OTHER";

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const { url } = await storeDocumentBytes({
    buffer,
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
    folder: `onboarding/${onboardingCase.id}`,
  });

  await db.onboardingEvent.create({
    data: {
      accountId: invitation.accountId,
      caseId: onboardingCase.id,
      type: "PORTAL_DOCUMENT_UPLOADED",
      actorType: "PORTAL",
      detail: { filename: file.name, docType, url },
    },
  });

  return NextResponse.json({ ok: true, url });
}
