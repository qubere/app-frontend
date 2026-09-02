import { NextResponse } from "next/server";
import { getAccountContext } from "@qubere/auth";
import { db } from "@qubere/db";
import { processSharedDocumentUpload } from "@qubere/db/services/shared-upload-service";

export async function POST(req: Request) {
  // This route simulates provider inbound-email ingestion for the demo. It is NOT a
  // verified webhook (no provider signature check) and must not be reachable in a
  // real deployment. See CUSTOMER-PORTAL-PR97-REVIEW.md (P1-4).
  if (process.env.NEXT_PUBLIC_APP_ENV !== "demo") {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const ctx = await getAccountContext();
  if (!ctx) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  if (!(ctx.permissions || []).includes("portal.documents.create") && !ctx.roleNames.some((r) => ["OWNER", "ADMIN", "BROKER_ADMIN"].includes(r.toUpperCase()))) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const senderEmail = (formData.get("senderEmail") as string) || "porter@target.com";
  const recipientEmail = (formData.get("recipientEmail") as string) || "docs@qubere.ai";
  const shipmentId = (formData.get("shipmentId") as string) || undefined;
  const docType = (formData.get("docType") as string) || "INBOUND_EMAIL_ATTACHMENT";

  if (!file) {
    return NextResponse.json({ error: "MISSING_FILE", message: "Attachment file is required" }, { status: 400 });
  }


  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    // 1. Ensure or register an InboundSenderRoute for sender email
    const normalizedSender = senderEmail.toLowerCase().trim();
    const existingRoute = await db.inboundSenderRoute.findFirst({
      where: { accountId: ctx.accountId, normalizedSenderEmail: normalizedSender },
    });

    if (!existingRoute) {
      await db.inboundSenderRoute.create({
        data: {
          accountId: ctx.accountId,
          displaySenderEmail: senderEmail,
          normalizedSenderEmail: normalizedSender,
          status: "ACTIVE",
          createdByUserId: ctx.userId,
        },
      });
    }

    // 2. Process & ingest inbound email attachment directly into Customer Vault
    const result = await processSharedDocumentUpload({
      accountId: ctx.accountId,
      shipmentId,
      fileName: file.name,
      fileBuffer: buffer,
      docType,
      mimeType: file.type || "application/pdf",
      source: "INBOUND_EMAIL",
      portalVisibility: "CUSTOMER",
      userId: ctx.userId,
    });

    return NextResponse.json({
      success: true,
      documentId: result.documentId,
      fileName: result.fileName,
      status: result.status,
      ingestedFrom: senderEmail,
      ingestedToEndpoint: recipientEmail,
      message: `Email attachment ingested successfully from ${senderEmail} to ${recipientEmail}`,
    });
  } catch (err) {
    console.error("Inbound email ingestion error:", err);
    return NextResponse.json(
      { error: "INGESTION_FAILED", message: err instanceof Error ? err.message : "Failed to process email attachment" },
      { status: 500 }
    );
  }
}
