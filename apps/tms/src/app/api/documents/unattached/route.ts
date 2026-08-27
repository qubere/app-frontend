import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@qubere/auth";
import { db } from "@qubere/db";

export const GET = withAuthenticatedRoute(async ({ ctx }) => {
  try {
    const documents = await db.shipmentDocument.findMany({
      where: { shipmentId: null, accountId: ctx.accountId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }).catch(() => []);

    return NextResponse.json({
      documents: documents.map((d) => ({
        id: d.id,
        docType: d.docType,
        fileName: d.fileName,
      })),
    });
  } catch {
    return NextResponse.json({ documents: [] });
  }
}, { permission: "document.read" });
