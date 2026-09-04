import fs from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { readStoredObject } from "@/lib/storage";

/**
 * Recovers the original bytes of a stored document, wherever they actually live.
 *
 * Uploads reach the database by several routes and they do not all populate the
 * same field:
 *
 *   - `/api/documents/upload` and `/api/upload/[token]` write the immutable
 *     original to object storage and record a real `fileUrl`.
 *   - The customer portal (`apps/portal` → `requests/[id]/documents`) writes the
 *     file to `rawContent` as base64 and to local disk under
 *     `uploads/quarantine/<documentId>/<fileName>`, and records a *placeholder*
 *     `fileUrl` that points at nothing.
 *
 * The agent pipeline previously only ever saw `payload.fileBuffer` (set inline by
 * the upload routes) or the three flat disk paths the Document Intake Agent
 * probes — so a portal document reached Document Intake with no bytes and
 * Document Intelligence with neither bytes nor a parsed context, and extraction
 * silently produced nothing.
 *
 * This resolves the bytes the same way `GET /api/documents/proxy` does, in the
 * same order, so anything the proxy can render for a human the pipeline can also
 * read.
 *
 * Returns `null` only when every source is exhausted.
 */

const DOCUMENT_ID_RE = /^[a-z0-9]{16,40}$/i;

/** Byte signatures that mean `rawContent` really held base64-encoded binary. */
function looksLikeKnownBinary(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  // %PDF, possibly after a short BOM/whitespace prefix.
  if (buf.subarray(0, 1024).includes(Buffer.from("%PDF"))) return true;
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return true;
  // TIFF (LE / BE)
  const head4 = buf.subarray(0, 4).toString("hex");
  if (head4 === "49492a00" || head4 === "4d4d002a") return true;
  // ZIP container (xlsx/docx)
  if (buf[0] === 0x50 && buf[1] === 0x4b && [0x03, 0x05, 0x07].includes(buf[2])) return true;
  return false;
}

/**
 * Reads the original bytes from a local quarantine/upload directory.
 *
 * `documentId` is validated against `DOCUMENT_ID_RE` and `fileName` is reduced to
 * its basename, and the resolved path is asserted to stay inside the intended
 * root, so neither field can escape the directory.
 */
async function readFromLocalDisk(documentId: string, fileName: string): Promise<Buffer | null> {
  if (!DOCUMENT_ID_RE.test(documentId)) return null;
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

export interface LoadedDocumentBytes {
  buffer: Buffer;
  fileName: string;
  mimeType: string | null;
  /** Where the bytes came from, for logging. */
  source: "local-disk" | "raw-content" | "object-storage";
}

export async function loadDocumentBytes(documentId: string): Promise<LoadedDocumentBytes | null> {
  const document = await db.shipmentDocument.findFirst({
    where: { id: documentId },
    select: { fileName: true, fileUrl: true, mimeType: true, rawContent: true },
  });
  if (!document) return null;

  const fileName = document.fileName || "document";
  const mimeType = document.mimeType ?? null;

  // 1. Original bytes on local disk (portal quarantine / uploads).
  const onDisk = await readFromLocalDisk(documentId, fileName);
  if (onDisk && onDisk.byteLength > 0) {
    return { buffer: onDisk, fileName, mimeType, source: "local-disk" };
  }

  // 2. Durable object storage (GCS).
  if (document.fileUrl) {
    try {
      const stored = await readStoredObject(document.fileUrl);
      if (stored.body.byteLength > 0) {
        return {
          buffer: stored.body,
          fileName,
          mimeType: mimeType ?? stored.contentType,
          source: "object-storage",
        };
      }
    } catch {
      // Placeholder URL or unreachable object — fall through to rawContent.
    }
  }

  // 3. rawContent persisted in Postgres — UTF-8 text or base64-encoded binary fallback.
  //    Buffer.from(x, "base64") never throws, it just yields junk for non-base64
  //    input, so only trust the decode when it produces a recognised signature.
  if (document.rawContent && document.rawContent.trim()) {
    const raw = document.rawContent.trim();
    const decoded = Buffer.from(raw, "base64");
    const buffer = looksLikeKnownBinary(decoded) ? decoded : Buffer.from(raw, "utf-8");
    if (buffer.byteLength > 0) {
      return { buffer, fileName, mimeType, source: "raw-content" };
    }
  }

  return null;
}
