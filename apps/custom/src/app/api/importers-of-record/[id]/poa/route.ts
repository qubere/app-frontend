import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { validatePathParams } from "@/lib/api/validation";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { storeDocumentFile } from "@/lib/storage";
import { promoteClientDocument } from "@qubere/db/services/client-setup-service";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string().min(1) });

export const POST = withAuthenticatedRoute<{ id: string }>(async ({ req, ctx, requestId, params }) => {
  const paramsVal = validatePathParams(params, paramsSchema, requestId);
  if ("response" in paramsVal) return paramsVal.response;
  const { id } = paramsVal.data;
  const importer = await db.importerOfRecord.findFirst({
    where: { id, accountId: ctx.accountId }, select: { id: true, name: true, clientId: true, client: { select: { accountId: true } } },
  });
  if (!importer) return NextResponse.json({ error: "Importer of Record not found" }, { status: 404 });

  if (importer.clientId && importer.client?.accountId !== ctx.accountId) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string" || file.size === 0) {
    return NextResponse.json({ error: "Upload the signed POA file using multipart/form-data." }, { status: 400 });
  }
  if (!["application/pdf", "image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
    return NextResponse.json({ error: "The signed POA must be a PDF, PNG, or JPEG file." }, { status: 400 });
  }
  const expiration = form?.get("expirationDate");
  const expirationDate = typeof expiration === "string" && expiration ? new Date(expiration) : null;
  if (expirationDate && Number.isNaN(expirationDate.getTime())) {
    return NextResponse.json({ error: "Expiration date is invalid." }, { status: 400 });
  }

  // This is the broker's Upload Signed POA action. Persist the actual file;
  // never manufacture a document URL or treat an unsigned template as executed.
  const stored = await storeDocumentFile(file, file.name, `poa/${ctx.accountId}`);
  const poa = await db.$transaction(async tx => {
    const record = await tx.powerOfAttorney.create({ data: {
      accountId: ctx.accountId, importerOfRecordId: id, grantedByEntity: importer.name,
      documentUrl: stored.url, executedDocumentUrl: stored.url,
      executionMethod: "WET_INK", status: "executed", expirationDate,
    } });
    if (importer.clientId) {
      await promoteClientDocument({ accountId: ctx.accountId, clientId: importer.clientId,
        kind: "EXECUTED_POA", title: `Executed Power of Attorney — ${importer.name}`,
        storageUrl: stored.url, sourceModel: "PowerOfAttorney", sourceId: record.id,
        effectiveDate: record.signedDate, expirationDate: record.expirationDate,
      }, tx);
    }
    return record;
  });
  await createAuditLog({
    accountId: ctx.accountId, userId: ctx.userId, action: "poa.create", entity: "PowerOfAttorney",
    entityId: poa.id, source: "UI", metadata: { importerOfRecordId: id, clientId: importer.clientId, signedDocumentUploaded: true },
  });
  return NextResponse.json({ powerOfAttorney: poa, portalVisible: !!importer.clientId }, { status: 201 });
}, { permission: "parties.manage", write: true });
