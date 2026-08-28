import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { readStoredObject } from "@/lib/storage";

/**
 * Opaque cuid-style id. Enforced before the value is ever concatenated into a
 * filesystem path, so `documentId` can never carry `..` or a path separator.
 */
const DOCUMENT_ID_RE = /^[a-z0-9]{16,40}$/i;

/**
 * Byte signatures we are willing to serve INLINE with their real media type.
 * Everything not on this list is handed back as an attachment (see `serve`), so
 * a stored file can never be rendered as active content in this app's origin.
 */
const INLINE_SIGNATURES: Array<{ mime: string; match: (b: Buffer) => boolean }> = [
  // %PDF may legally appear after a short BOM/whitespace prefix, so scan a window.
  { mime: "application/pdf", match: (b) => b.subarray(0, 1024).includes(0x25) && b.subarray(0, 1024).includes(Buffer.from("%PDF")) },
  { mime: "image/jpeg", match: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", match: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/tiff", match: (b) => ["49492a00", "4d4d002a"].includes(b.subarray(0, 4).toString("hex")) },
  { mime: "image/gif", match: (b) => ["GIF87a", "GIF89a"].includes(b.subarray(0, 6).toString("ascii")) },
  {
    mime: "image/webp",
    match: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
  },
];

type Sniffed =
  | { kind: "inline"; mime: string } // recognised, safe to render in-origin
  | { kind: "zip" } // recognised ZIP container (docx/xlsx/…) — download only
  | { kind: "text" } // looks like plain text
  | { kind: "unknown" }; // no signature matched and it isn't clearly text

/** Signature sniff, in the spirit of libmagic but deliberately conservative. */
function sniffContent(buf: Buffer): Sniffed {
  if (buf.length >= 4) {
    for (const sig of INLINE_SIGNATURES) {
      if (sig.match(buf)) return { kind: "inline", mime: sig.mime };
    }
    // ZIP container: OOXML (docx/xlsx/pptx), ODF, etc. Never rendered inline.
    if (buf[0] === 0x50 && buf[1] === 0x4b && [0x03, 0x05, 0x07].includes(buf[2])) {
      return { kind: "zip" };
    }
  }

  // Text heuristic: no NUL in the first 8 KiB and <1% non-whitespace control bytes.
  const sample = buf.subarray(0, 8192);
  if (sample.length > 0 && !sample.includes(0)) {
    let controls = 0;
    for (const byte of sample) {
      if (byte < 0x09 || (byte > 0x0d && byte < 0x20)) controls++;
    }
    if (controls / sample.length < 0.01) return { kind: "text" };
  }

  return { kind: "unknown" };
}

/** True when the bytes carry a signature we actually recognise (not just "not text"). */
function hasKnownSignature(buf: Buffer): boolean {
  const k = sniffContent(buf).kind;
  return k === "inline" || k === "zip";
}

const HTML_ESCAPE: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]);

/** Wraps plain-text document content in a read-only viewer page. Every dynamic value is escaped. */
function renderTextViewer(text: string, fileName: string, docType: string | null): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(fileName)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; background: #f8fafc; color: #0f172a; margin: 0; }
    .card { max-width: 720px; margin: 0 auto; background: #fff; padding: 36px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
    .header { border-bottom: 2px solid #0071e3; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; gap: 16px; }
    h2 { font-size: 18px; font-weight: 800; margin: 0; }
    .type { background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; white-space: nowrap; }
    pre { background: #f1f5f9; padding: 20px; border-radius: 12px; font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; font-family: ui-monospace, SFMono-Regular, monospace; color: #334155; border: 1px solid #cbd5e1; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2>${escapeHtml(fileName)}</h2>
      <span class="type">${escapeHtml(docType || "DOCUMENT")}</span>
    </div>
    <pre>${escapeHtml(text)}</pre>
  </div>
</body>
</html>`;
}

/**
 * Reads the original bytes from a local quarantine/upload directory.
 *
 * `documentId` is already validated against DOCUMENT_ID_RE; `fileName` is
 * reduced to its basename and the resolved path is asserted to stay inside the
 * intended root, so neither field can escape the directory.
 */
async function readFromLocalDisk(documentId: string, fileName: string): Promise<Buffer | null> {
  const safeName = path.basename(fileName);
  if (!safeName || safeName === "." || safeName === "..") return null;

  const roots = [
    path.join(process.cwd(), "..", "portal", "uploads", "quarantine", documentId),
    path.join(process.cwd(), "uploads", "quarantine", documentId),
    path.join(process.cwd(), "uploads", "documents"),
  ];

  for (const root of roots) {
    const base = path.resolve(root);
    const candidate = path.resolve(base, safeName);
    if (candidate !== base && !candidate.startsWith(base + path.sep)) continue;
    try {
      return await fs.readFile(candidate);
    } catch {
      // Not at this path — try the next root.
    }
  }
  return null;
}

/** Builds the HTTP response for a document body, choosing headers from a signature sniff. */
function serve(buf: Buffer, opts: { fileName: string; docType: string | null }): NextResponse {
  const safeName = path.basename(opts.fileName) || "document";
  const asciiName = safeName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const utf8Name = encodeURIComponent(safeName);

  const headers: Record<string, string> = {
    "Cache-Control": "private, no-store",
    // Hold the browser to the Content-Type we set — no re-sniffing to something executable.
    "X-Content-Type-Options": "nosniff",
  };

  const sniffed = sniffContent(buf);

  if (sniffed.kind === "inline") {
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        ...headers,
        "Content-Type": sniffed.mime,
        "Content-Disposition": `inline; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
      },
    });
  }

  if (sniffed.kind === "text") {
    return new NextResponse(renderTextViewer(buf.toString("utf-8"), safeName, opts.docType), {
      status: 200,
      headers: {
        ...headers,
        "Content-Type": "text/html; charset=utf-8",
        // Defence in depth: even if the escaping above ever regressed, nothing in
        // this generated page may execute script, load a subresource, or navigate.
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'",
        "Content-Disposition": `inline; filename="${asciiName}.html"`,
      },
    });
  }

  // ZIP-family or unrecognised binary — never rendered in-origin, always a download.
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      ...headers,
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
    },
  });
}

export const GET = withAuthenticatedRoute(async ({ req, ctx }) => {
  const documentId = new URL(req.url).searchParams.get("documentId");
  if (!documentId) {
    return new NextResponse("documentId is required", { status: 400 });
  }
  if (!DOCUMENT_ID_RE.test(documentId)) {
    return new NextResponse("Invalid documentId", { status: 400 });
  }

  // accountId is part of the lookup, not a post-hoc check — a caller can only
  // ever read documents belonging to their own tenant.
  const document = await db.shipmentDocument.findFirst({
    where: { id: documentId, accountId: ctx.accountId },
    select: { fileName: true, fileUrl: true, docType: true, rawContent: true },
  });

  if (!document) {
    return new NextResponse("Document not found", { status: 404 });
  }

  const fileName = document.fileName || "document";
  const docType = document.docType ?? null;

  // 1. Original bytes on local disk (quarantine / uploads).
  const onDisk = await readFromLocalDisk(documentId, fileName);
  if (onDisk) {
    return serve(onDisk, { fileName, docType });
  }

  // 2. rawContent persisted in Postgres. The only writers store it as either
  //    UTF-8 text or base64-encoded binary, so decode the base64 and let a
  //    signature sniff of the resulting bytes decide: a recognised binary
  //    signature means it really was base64, anything else is UTF-8 text.
  if (document.rawContent && document.rawContent.trim()) {
    const raw = document.rawContent.trim();
    // `Buffer.from(text, "base64")` never throws — it just yields junk for
    // non-base64 input — so only trust the decode when it produces bytes with a
    // signature we recognise. Otherwise the column held UTF-8 text.
    const decoded = Buffer.from(raw, "base64");
    const buf = hasKnownSignature(decoded) ? decoded : Buffer.from(raw, "utf-8");

    return serve(buf, { fileName, docType });
  }

  // 3. Durable object storage (GCS / Vercel Blob), for documents with no local
  //    copy or rawContent — e.g. anything uploaded before the portal flow.
  if (document.fileUrl) {
    try {
      const stored = await readStoredObject(document.fileUrl);
      return serve(stored.body, { fileName, docType });
    } catch (err) {
      console.error("[documents/proxy] storage read failed", {
        accountId: ctx.accountId,
        documentId,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return new NextResponse("Document content unavailable", { status: 404 });
});
