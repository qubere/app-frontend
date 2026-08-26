import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";

const PAGE_SIZE = 25;

export const GET = withAuthenticatedRoute(async ({ req, ctx }) => {
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor") ?? undefined;

  const documents = await db.shipmentDocument.findMany({
    where: {
      accountId: ctx.accountId,
      shipmentId: null,
      ...(cursor ? { id: { lt: cursor } } : {}),
    },
    select: {
      // Return only fields consumed by the list and attachment picker; omit
      // large extraction bodies from this summary endpoint.
      id: true,
      fileName: true,
      docType: true,
      documentType: true,
      documentTypeConfidence: true,
      status: true,
      createdAt: true,
      fileUrl: true,
      confidence: true,
      source: true,
      shipmentCandidates: {
        select: {
          id: true,
          confidenceScore: true,
          matchReasons: true,
          shipment: { select: { id: true, shipmentNumber: true, portOfEntry: true } },
        },
        orderBy: { confidenceScore: "desc" },
        take: 3,
      },
    },
    orderBy: { updatedAt: "desc" },
    take: PAGE_SIZE,
  });

  const nextCursor = documents.length === PAGE_SIZE ? (documents[documents.length - 1]?.id ?? null) : null;

  return NextResponse.json({
    documents,
    pagination: { nextCursor, hasMore: nextCursor !== null },
  });
});
