/**
 * POST /api/compliance/licenses/[id]/documents -- upload a document (authorization,
 * amendment, correspondence, evidence) attached to a managed license.
 */
import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { storeDocumentFile, StorageValidationError } from "@/lib/storage";

const ALLOWED_DOCUMENT_TYPES = new Set(["AUTHORIZATION", "AMENDMENT", "CONDITIONS", "CORRESPONDENCE", "SUPPORTING_EVIDENCE"]);

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ req, params, ctx, requestId }) => {
    const license = await db.license.findFirst({ where: { id: params.id, accountId: ctx.accountId } });
    if (!license) {
      return buildErrorResponse(404, "NOT_FOUND", "License not found.", undefined, requestId);
    }

    const formData = await req.formData().catch(() => null);
    const file = formData?.get("file");
    const documentType = formData?.get("documentType");
    if (!(file instanceof File) || typeof documentType !== "string" || !ALLOWED_DOCUMENT_TYPES.has(documentType)) {
      return buildErrorResponse(400, "INVALID_INPUT", "A file and a valid documentType are required.", undefined, requestId);
    }

    let storageResult;
    try {
      storageResult = await storeDocumentFile(file, file.name, `licenses/${license.id}`);
    } catch (error) {
      if (error instanceof StorageValidationError) {
        return buildErrorResponse(400, error.code, error.message, undefined, requestId);
      }
      throw error;
    }

    const document = await db.licenseDocument.create({
      data: {
        accountId: ctx.accountId,
        licenseId: license.id,
        documentType,
        fileName: file.name,
        storageKey: storageResult.url,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        uploadedByUserId: ctx.userId,
      },
    });

    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: "LICENSE_DOCUMENT_UPLOADED",
      entity: "LicenseDocument",
      entityId: document.id,
      source: "UI",
      metadata: { licenseId: license.id, documentType, fileName: file.name },
    });

    return NextResponse.json({ document, requestId }, { status: 201 });
  },
  { permission: "licenses.manage_documents", write: true }
);
