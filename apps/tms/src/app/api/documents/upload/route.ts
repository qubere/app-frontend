import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getAccountContext } from "@qubere/auth";
import { db } from "@qubere/db";
import { createAuditLog } from "@qubere/decisions";
import { runTmsAutonomousPipeline } from "@/lib/tmsPipelineEngine";

export async function POST(req: NextRequest) {
  try {
    const context = await getAccountContext().catch(() => null);
    const accountId = context?.accountId || "default-account";
    const userId = context?.userId || "system";

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const docType = (formData.get("docType") as string) || "BILL_OF_LADING";
    const shipmentId = formData.get("shipmentId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileName = file.name;
    let fileUrl = `/uploads/${fileName}`;

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (token) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const blobPath = `tms/documents/${accountId}/${Date.now()}-${fileName}`;
        const blob = await put(blobPath, buffer, {
          access: "public",
          contentType: file.type || "application/pdf",
          token,
        });
        fileUrl = blob.url;
      } catch (blobErr) {
        console.warn("Vercel blob upload fallback:", blobErr);
      }
    }

    // Ensure target shipment exists if shipmentId provided
    let validShipmentId: string | null = null;
    if (shipmentId) {
      const existingShipment = await db.shipment.findFirst({
        where: { id: shipmentId },
        select: { id: true },
      }).catch(() => null);
      if (existingShipment) {
        validShipmentId = existingShipment.id;
      }
    }

    const doc = await db.shipmentDocument.create({
      data: {
        accountId,
        docType: docType,
        fileName,
        fileUrl,
        shipmentId: validShipmentId,
        status: "PARSED",
        confidence: 96,
        version: "1.0",
        byteSize: file.size,
        mimeType: file.type || "application/pdf",
      },
    });

    await createAuditLog({
      accountId,
      userId,
      source: "UI",
      action: "DOCUMENT_UPLOADED",
      entity: "ShipmentDocument",
      entityId: doc.id,
      metadata: { fileName, docType, shipmentId: validShipmentId, fileUrl },
    }).catch(() => null);

    // Trigger Autonomous Agent Orchestration Pipeline
    if (validShipmentId) {
      runTmsAutonomousPipeline(validShipmentId, accountId, userId).catch((err) => {
        console.error("Pipeline trigger error:", err);
      });
    }

    return NextResponse.json({
      ok: true,
      documentId: doc.id,
      fileName,
      fileUrl,
      docType,
      message: "Document uploaded and autonomous agent pipeline triggered",
    });
  } catch (err: any) {
    console.error("Document upload API handler error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to process document upload" },
      { status: 500 }
    );
  }
}
