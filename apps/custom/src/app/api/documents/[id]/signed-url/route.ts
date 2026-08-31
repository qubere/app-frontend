import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { validatePathParams } from "@/lib/api/validation";
import { db } from "@/lib/db";
import { createSignedReadUrl } from "@/lib/storage";
import { documentViewUrl } from "@/lib/documentUrl";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string().min(1) });
const SIGNED_URL_TTL_MS = 15 * 60 * 1000;

/**
 * Direct, time-limited object-storage URL for a document -- avoids proxying
 * the bytes through the app server for large files. Documents without a real
 * `fileUrl` (local-disk/rawContent dev fallback) fall back to the existing
 * authenticated proxy route, which is not time-limited but still tenant-checked.
 */
export const GET = withAuthenticatedRoute<{ id: string }>(
  async ({ ctx, requestId, params }) => {
    const paramsVal = validatePathParams(params, paramsSchema, requestId);
    if ("response" in paramsVal) return paramsVal.response;
    const { id } = paramsVal.data;

    const document = await db.shipmentDocument.findFirst({
      where: { id, accountId: ctx.accountId },
      select: { fileUrl: true, fileName: true },
    });
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (!document.fileUrl) {
      return NextResponse.json({ url: documentViewUrl(id), signed: false, fileName: document.fileName });
    }

    try {
      const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_MS);
      const url = await createSignedReadUrl(document.fileUrl, expiresAt);
      return NextResponse.json({ url, signed: true, expiresAt, fileName: document.fileName });
    } catch (error) {
      console.error("Failed to create signed document URL", error);
      return NextResponse.json({ url: documentViewUrl(id), signed: false, fileName: document.fileName });
    }
  },
  { permission: { any: ["document.download", "document.read"] } }
);
