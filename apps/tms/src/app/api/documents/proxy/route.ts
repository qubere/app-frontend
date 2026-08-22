import { NextResponse } from "next/server";
import fs from "fs/promises";
import existsFs from "fs";
import path from "path";
import os from "os";
import { db } from "@qubere/db";

function resolveLocalFilePath(fileUrl: string): string | null {
  if (!fileUrl) return null;
  const fileName = path.basename(fileUrl.startsWith("file://") ? fileUrl.slice(7) : fileUrl);
  if (!fileName || fileName === "." || fileName === "..") return null;

  const allowedDirs = [
    path.join(process.cwd(), "public", "uploads"),
    path.join(process.cwd(), ".qubere", "storage", "uploads"),
    path.join(os.tmpdir(), "uploads"),
  ];

  for (const dir of allowedDirs) {
    const candidate = path.resolve(dir, fileName);
    if (candidate.startsWith(dir + path.sep) && existsFs.existsSync(candidate)) {
      return candidate;
    }
  }

  if (fileUrl.startsWith("file://")) {
    const rawPath = path.resolve(fileUrl.slice(7));
    for (const dir of allowedDirs) {
      if (rawPath.startsWith(dir + path.sep) && existsFs.existsSync(rawPath)) {
        return rawPath;
      }
    }
  }

  return null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get("documentId");

    if (!documentId) {
      return new NextResponse("documentId query parameter is required", { status: 400 });
    }

    const doc = await db.shipmentDocument.findFirst({
      where: { id: documentId },
      select: { fileName: true, fileUrl: true },
    }).catch(() => null);

    if (!doc || !doc.fileUrl) {
      return new NextResponse("Document not found", { status: 404 });
    }

    const fileName = doc.fileName || "document.pdf";
    const ext = path.extname(fileName).toLowerCase();
    const contentType =
      ext === ".png" ? "image/png" :
      ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
      "application/octet-stream";

    // 1. Remote Vercel Blob URL
    if (doc.fileUrl.startsWith("https://")) {
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      const upstream = await fetch(doc.fileUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (upstream.ok && upstream.body) {
        return new NextResponse(upstream.body, {
          status: 200,
          headers: {
            "Content-Type": upstream.headers.get("Content-Type") ?? (ext === ".pdf" ? "application/pdf" : contentType),
            "Content-Disposition": `inline; filename="${fileName}"`,
            "Cache-Control": "private, no-store",
          },
        });
      }
    }

    // 2. Local File Resolution
    const localPath = resolveLocalFilePath(doc.fileUrl);
    if (localPath) {
      const pdfBuffer = await fs.readFile(localPath);
      const fileExt = path.extname(localPath).toLowerCase();
      const localContentType = fileExt === ".pdf" ? "application/pdf" : (fileExt === ".png" ? "image/png" : "application/octet-stream");

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": localContentType,
          "Content-Disposition": `inline; filename="${fileName}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    // 3. Fallback sample if sample_document.pdf exists
    const samplePath = path.join(process.cwd(), "public", "sample_document.pdf");
    if (existsFs.existsSync(samplePath)) {
      const pdfBuffer = await fs.readFile(samplePath);
      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${fileName}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    return new NextResponse("Document file not found", { status: 404 });
  } catch (err: any) {
    return new NextResponse(err.message || "Failed to stream document", { status: 500 });
  }
}
