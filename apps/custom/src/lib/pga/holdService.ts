import { rethrowWorkflowConflict } from "@/lib/api/workflowConflict";
import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/api/error";
import { createAuditLog, AuditAction } from "@/lib/audit";
import { parseInboundHoldNotice } from "@/lib/abi/inboundHoldNoticeParser";
import { getHoldCodeEntry } from "@/lib/abi/holdCodeDictionary";
import { getPreparationFields, restoreHoldDraft, OPEN_HOLD_STATUSES, type HoldFormInput, holdSubmitSchema, holdResponseSchema } from "./holdContracts";
import type { z } from "zod";

const notFound = () => new DomainError("Hold not found.", "NOT_FOUND", 404);
const conflict = () => new DomainError("This hold changed. Reload to review the latest response before saving.", "HOLD_CONFLICT", 409);
export async function getHold(accountId: string, id: string) {
  const hold = await db.pgaHold.findFirst({
    where: { id, accountId, shipment: { accountId, deletedAt: null } },
    include: {
      shipment: { include: { lineItems: { where: { accountId }, orderBy: { lineNumber: "asc" } } } },
      submissions: { where: { accountId }, orderBy: { submittedAt: "desc" }, take: 20 },
    },
  });
  if (!hold) throw notFound();
  return hold;
}
export async function getHoldDetail(accountId: string, id: string) {
  const hold = await getHold(accountId, id);
  const line = hold.commodityLineRef
    ? hold.shipment.lineItems.find(item => String(item.lineNumber) === hold.commodityLineRef)
    : hold.shipment.lineItems.length === 1 ? hold.shipment.lineItems[0] : undefined;
  const prefill: HoldFormInput = {
    importer: hold.shipment.importerName,
    portOfEntry: hold.shipment.portOfEntry ?? "",
    ...(line ? { description: line.description, countryOfOrigin: line.countryOfOrigin, htsCode: line.htsCode, quantity: String(line.quantity) } : {}),
    ...(hold.shipment.estimatedArrival ? { arrivalDate: hold.shipment.estimatedArrival.toISOString().slice(0, 10) } : {}),
  };
  const latestInput = hold.status === "Rejected" ? hold.submissions[0]?.formInputJson : null;
  const previous = latestInput && typeof latestInput === "object" && !Array.isArray(latestInput) ? latestInput : {};
  const draft = restoreHoldDraft(hold.draftFormInput, hold.draftUpdatedAt);
  return {
    hold, fields: getPreparationFields(hold.agencyCode), prefill,
    formInput: { ...prefill, ...previous, ...(draft ?? {}) },
    staleDraft: !!hold.draftUpdatedAt && !draft,
    explanation: getHoldCodeEntry(hold.agencyCode, hold.holdCode)?.explanation ?? hold.reasonText,
    transport: { mode: "MANUAL" as const, live: false, mappingApproved: false,
      reason: "Live PGA transmission and approved agency mappings are not configured. File through your existing ACE channel, then record the reference here." },
  };
}
export async function listHolds(accountId: string, query: { shipmentId?: string; agency?: string; importer?: string; page: number; oldestFirst: boolean; includeClosed?: boolean }) {
  const where: Prisma.PgaHoldWhereInput = {
    accountId, ...(!query.includeClosed ? { status: { in: [...OPEN_HOLD_STATUSES] } } : {}),
    ...(query.shipmentId ? { shipmentId: query.shipmentId } : {}),
    ...(query.agency ? { agencyCode: query.agency } : {}),
    shipment: { accountId, deletedAt: null, ...(query.importer ? { importerName: { contains: query.importer, mode: "insensitive" } } : {}) },
  };
  const [holds, total] = await Promise.all([
    db.pgaHold.findMany({ where, select: {
      id: true, shipmentId: true, agencyCode: true, holdCode: true, status: true, issuedAt: true, reasonText: true, commodityLineRef: true,
      shipment: { select: { shipmentNumber: true, importerName: true, filingDeadline: true, assignedBrokerId: true } },
    }, orderBy: [{ issuedAt: query.oldestFirst ? "asc" : "desc" }, { id: "asc" }], take: 25, skip: query.page * 25 }),
    db.pgaHold.count({ where }),
  ]);
  return { holds, total, page: query.page };
}
export async function recordHold(accountId: string, userId: string, input: unknown) {
  const notice = parseInboundHoldNotice(input);
  const shipment = await db.shipment.findFirst({ where: { id: notice.shipmentId, accountId, deletedAt: null }, select: { id: true } });
  if (!shipment) throw new DomainError("Shipment not found.", "NOT_FOUND", 404);
  if (notice.commodityLineRef && !await db.shipmentLineItem.findFirst({ where: { shipmentId: shipment.id, accountId, lineNumber: Number(notice.commodityLineRef) } })) {
    throw new DomainError("Select a line belonging to this shipment.", "INVALID_HOLD_LINE", 422);
  }
  const existing = await db.pgaHold.findUnique({ where: { accountId_externalKey: { accountId, externalKey: notice.externalKey } } });
  if (existing) {
    if (existing.shipmentId !== shipment.id || existing.rawNotice !== notice.rawNotice) throw new DomainError("This source reference already belongs to a different notice.", "HOLD_SOURCE_CONFLICT", 409);
    return existing;
  }
  const hold = await db.pgaHold.create({ data: { ...notice, issuedAt: new Date(notice.issuedAt), accountId } }).catch(rethrowWorkflowConflict);
  await createAuditLog({ accountId, userId, action: AuditAction.PGA_HOLD_RECORDED, entity: "Shipment", entityId: shipment.id, source: "UI", metadata: { holdId: hold.id, agencyCode: hold.agencyCode, origin: "BROKER_RECORDED_NOTICE" } });
  return hold;
}
export async function saveHoldDraft(accountId: string, userId: string, id: string, version: number, formInput: HoldFormInput) {
  const hold = await getHold(accountId, id);
  if (!["Open", "Rejected"].includes(hold.status)) throw new DomainError("Only open or rejected holds can be edited.", "HOLD_NOT_EDITABLE", 409);
  const result = await db.pgaHold.updateMany({
    where: { id, accountId, version, status: hold.status },
    data: { draftFormInput: formInput, draftUpdatedAt: new Date(), version: { increment: 1 } },
  });
  if (result.count !== 1) throw conflict();
  await createAuditLog({ accountId, userId, action: AuditAction.PGA_HOLD_DRAFT_SAVED, entity: "Shipment", entityId: hold.shipmentId, source: "UI", metadata: { holdId: id } });
  return { version: version + 1, savedAt: new Date().toISOString() };
}
export async function recordManualSubmission(accountId: string, userId: string, id: string, requestKey: string, input: z.infer<typeof holdSubmitSchema>) {
  const hold = await getHold(accountId, id);
  if (!getPreparationFields(hold.agencyCode)) throw new DomainError("This agency is not supported. Export the original notice for manual follow-up.", "UNSUPPORTED_AGENCY", 422);
  const prior = await db.pgaHoldSubmission.findFirst({ where: { accountId, requestKey } });
  if (prior) {
    if (prior.pgaHoldId !== id || prior.externalReference !== input.externalReference || prior.messageSetText !== input.messageSetText) throw new DomainError("Request key was already used for another submission.", "IDEMPOTENCY_CONFLICT", 409);
    return prior;
  }
  if (!["Open", "Rejected"].includes(hold.status)) throw new DomainError("A response is already awaiting agency action. Record the response before filing again.", "ALREADY_SUBMITTED", 409);
  const submission = await db.$transaction(async tx => {
    const updated = await tx.pgaHold.updateMany({ where: { id, accountId, version: input.version, status: hold.status }, data: { status: "Submitted", version: { increment: 1 }, draftFormInput: input.formInput, draftUpdatedAt: new Date() } });
    if (updated.count !== 1) throw conflict();
    const attemptNumber = await tx.pgaHoldSubmission.count({ where: { pgaHoldId: id, accountId } }) + 1;
    const idempotencyKey = createHash("sha256").update(JSON.stringify([id, input.messageSetText, attemptNumber])).digest("hex");
    return tx.pgaHoldSubmission.create({ data: {
      accountId, pgaHoldId: id, requestKey, idempotencyKey, attemptNumber,
      formInputJson: input.formInput, messageSetText: input.messageSetText,
      externalReference: input.externalReference, operatorUserId: userId, transmissionMode: "MANUAL", status: "Sent",
    } });
  }, { isolationLevel: "Serializable" }).catch(rethrowWorkflowConflict);
  await createAuditLog({ accountId, userId, action: AuditAction.PGA_HOLD_SUBMITTED, entity: "Shipment", entityId: hold.shipmentId, source: "UI", metadata: { holdId: id, submissionId: submission.id, transmissionMode: "MANUAL", externalReference: input.externalReference, agencyAccepted: false } });
  return submission;
}
export async function recordAgencyResponse(accountId: string, userId: string, id: string, input: z.infer<typeof holdResponseSchema>) {
  const hold = await getHold(accountId, id);
  const latest = hold.submissions[0];
  if (!latest || latest.id !== input.submissionId || !["Submitted", "Processing"].includes(hold.status)) throw new DomainError("Record a response for the latest pending submission.", "INVALID_HOLD_RESPONSE", 409);
  const responseAt = new Date(input.responseAt);
  // A manual filing may be recorded after the agency has already responded.
  // Its database submittedAt is the recording time, not an asserted ACE send time.
  const earliestResponse = latest.transmissionMode === "MANUAL"
    ? Math.max(hold.issuedAt.getTime(), ...hold.submissions.filter(row => row.responseAt).map(row => row.responseAt!.getTime()))
    : latest.submittedAt.getTime();
  if (responseAt.getTime() < earliestResponse || responseAt.getTime() > Date.now() + 300000) throw new DomainError("The response cannot predate the hold or earlier agency evidence, or be in the future.", "INVALID_RESPONSE_TIME", 422);
  await db.$transaction(async tx => {
    const updated = await tx.pgaHold.updateMany({ where: { id, accountId, version: input.version, status: hold.status }, data: { status: input.status, closedAt: input.status === "Released" ? responseAt : null, version: { increment: 1 } } });
    if (updated.count !== 1) throw conflict();
    await tx.pgaHoldSubmission.update({ where: { id: latest.id }, data: {
      status: input.status === "Released" ? "Accepted" : input.status === "Rejected" ? "Rejected" : "Sent",
      rejectionCode: input.status === "Rejected" ? input.responseCode : null,
      rejectionReason: input.status === "Rejected" ? input.reason : null,
      rejectedFields: input.rejectedFields, rawResponse: input.rawResponse, responseAt,
    } });
  }, { isolationLevel: "Serializable" }).catch(rethrowWorkflowConflict);
  await createAuditLog({ accountId, userId, action: input.status === "Rejected" ? AuditAction.PGA_HOLD_REJECTED : AuditAction.PGA_HOLD_STATUS_UPDATED, entity: "Shipment", entityId: hold.shipmentId, source: "UI", metadata: { holdId: id, status: input.status, responseCode: input.responseCode, provenance: "BROKER_RECORDED_AGENCY_RESPONSE" } });
  return getHoldDetail(accountId, id);
}
