import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { resolveStorageOrigin, resolveLocalFilePath, StorageValidationError } from "@/lib/storage";

/**
 * Streams a quarantined (stored-but-unassigned) attachment back to the
 * browser, so a platform admin can preview it before deciding which account
 * to release it to. Same shape as documents/proxy/route.ts, but scoped by
 * platform-admin status instead of accountId, since a quarantined attachment
 * has no accountId yet.
 */
export const GET = withAuthenticatedRoute(async ({ req, ctx }) => {
  if (!ctx.isPlatformAdmin) {
    return new NextResponse("Platform Admin only", { status: 403 });
  }

  const attachmentId = new URL(req.url).searchParams.get("attachmentId");
  if (!attachmentId) {
    return new NextResponse("attachmentId is required", { status: 400 });
  }

  const attachment = await db.inboundAttachment.findFirst({
    where: { id: attachmentId, processingStatus: "QUARANTINED" },
    select: { originalFilename: true, quarantinedFileUrl: true },
  });

  if (!attachment?.quarantinedFileUrl) {
    return new NextResponse("Attachment not found", { status: 404 });
  }

  let origin: ReturnType<typeof resolveStorageOrigin>;
  try {
    origin = resolveStorageOrigin(attachment.quarantinedFileUrl);
  } catch (error) {
    if (error instanceof StorageValidationError) {
      console.error("[quarantined-inbound/proxy] untrusted storage origin", { attachmentId, code: error.code });
      return new NextResponse("Document storage location is not trusted", { status: 502 });
    }
    throw error;
  }

  const contentDisposition = buildContentDisposition(attachment.originalFilename);

  if (origin === null) {
    return streamLocalFile(attachment.quarantinedFileUrl, contentDisposition);
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error("[quarantined-inbound/proxy] BLOB_READ_WRITE_TOKEN not configured", { attachmentId });
    return new NextResponse("Document storage unavailable", { status: 404 });
  }

  try {
    const upstream = await fetch(attachment.quarantinedFileUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!upstream.ok || !upstream.body) {
      console.error("[quarantined-inbound/proxy] upstream fetch failed", { attachmentId, status: upstream.status });
      return new NextResponse("Document not found", { status: 404 });
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "application/octet-stream",
        "Content-Disposition": contentDisposition,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[quarantined-inbound/proxy] upstream fetch exception", err);
    return new NextResponse("Document not found", { status: 404 });
  }
});

function buildContentDisposition(fileName: string): string {
  const asciiFallback = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `inline; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

async function streamLocalFile(fileUrl: string, contentDisposition: string) {
  const localPath = resolveLocalFilePath(fileUrl);

  if (!localPath) {
    return new NextResponse("Document not found", { status: 404 });
  }

  try {
    const contents = await fs.readFile(localPath);
    const ext = path.extname(localPath).toLowerCase();
    const contentType =
      ext === ".pdf"
        ? "application/pdf"
        : ext === ".png"
        ? "image/png"
        : ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : "application/octet-stream";

    return new NextResponse(new Uint8Array(contents), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Document not found", { status: 404 });
  }
}
