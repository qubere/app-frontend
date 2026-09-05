import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { createAuditLog, AuditAction } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  buildImporterCreateTransaction,
  fromOnboardingEntity,
  resolveOnboardingContact,
  validateImporterCreateInput,
  parseImporterCreateResponse,
} from "@/lib/abi/importerCreate";
import type { Prisma } from "@prisma/client";

// POST /api/onboarding/cases/:caseId/5106/:recordId/transmit
// Build a CATAIR 5106 Importer/Consignee Create/Update transaction and submit
// it to CBP ABI. Transport layer is stubbed (Phase 3 ABI cert work).

export const POST = withAuthenticatedRoute<{ caseId: string; recordId: string }>(
  async ({ params, ctx, requestId }) => {
    const { caseId, recordId } = params;

    // Verify the 5106 record belongs to this account via the case
    const onboardingCase = await db.onboardingCase.findFirst({
      where: { id: caseId, accountId: ctx.accountId },
      include: {
        entities: {
          take: 1,
          include: { importerOfRecord: true },
        },
        client: {
          select: { contactPhone: true, contactEmail: true, billingContactEmail: true },
        },
      },
    });
    if (!onboardingCase) {
      return buildErrorResponse(404, "NOT_FOUND", "Onboarding case not found", undefined, requestId);
    }

    const record = await db.fiveOhSixRecord.findFirst({
      where: { id: recordId, caseId, accountId: ctx.accountId },
    });
    if (!record) {
      return buildErrorResponse(404, "NOT_FOUND", "5106 record not found", undefined, requestId);
    }
    if (record.submittedAt) {
      return buildErrorResponse(409, "CONFLICT", "This 5106 record has already been transmitted.", undefined, requestId);
    }

    const entity = onboardingCase.entities[0];
    if (!entity?.importerOfRecord) {
      return buildErrorResponse(
        400,
        "MISSING_DATA",
        "No ImporterOfRecord attached to the onboarding entity — cannot build 5106.",
        undefined,
        requestId
      );
    }

    const ior = entity.importerOfRecord;
    let actionCode: "A" | "U" | "N" = "A";
    if (!ior.irsEin && !ior.cbpImporterNumber) {
      actionCode = "N";
    } else if (ior.registrationStatus === "registered") {
      actionCode = "U";
    }

    const account = await db.account.findUnique({
      where: { id: ctx.accountId },
      select: { name: true },
    });

    const officersRaw = Array.isArray(entity.officers) ? (entity.officers as unknown[]) : [];
    const officersTyped = officersRaw.filter(
      (o): o is { name?: string; title?: string; role?: string; phone?: string; email?: string; ssn?: string } =>
        typeof o === "object" && o !== null
    );

    // Contact phone + email must come from real onboarding data — never
    // synthesised — because they land in the CATAIR 5106 sent to CBP.
    const contact = resolveOnboardingContact({
      fiveOhSixPayload: record.payload,
      residentAgent: entity.residentAgent,
      officers: officersTyped,
      iorAddress: ior.address,
      client: onboardingCase.client,
    });
    if (!contact.ok) {
      return buildErrorResponse(
        400,
        "MISSING_DATA",
        `Cannot transmit 5106 — no verified contact ${contact.missing.join(
          " or "
        )} on file for this importer. Add it to the 5106 contact block, an officer, or the client record before transmitting.`,
        { missing: contact.missing },
        requestId
      );
    }

    const input = fromOnboardingEntity(
      { importerOfRecord: ior, officers: officersTyped },
      {
        actionCode,
        phone: contact.phone,
        email: contact.email,
        entriesPerYear: "2",
        brokerCredential: account?.name ? { brokerName: account.name } : undefined,
      }
    );

    const validationErrors = validateImporterCreateInput(input);
    if (validationErrors.length > 0) {
      return buildErrorResponse(400, "VALIDATION_FAILURE", "5106 input validation failed", { errors: validationErrors }, requestId);
    }

    const transactionBody = buildImporterCreateTransaction(input);
    const transmissionRef = `5106-${recordId}-${Date.now()}`;

    await db.fiveOhSixRecord.update({
      where: { id: recordId },
      data: { submittedAt: new Date(), transmissionRef, status: "submitted" },
    });

    await db.onboardingEvent.create({
      data: {
        accountId: ctx.accountId,
        caseId,
        type: "5106_TRANSMITTED",
        actorType: "BROKER",
        actorUserId: ctx.userId,
        detail: {
          recordId,
          transmissionRef,
          actionCode,
          lineCount: transactionBody.split("\r\n").length - 1,
          contactSources: contact.sources,
        },
      },
    });

    // Stub response — real ABI TCP/IP transport is Phase 3 (ABI cert work).
    const rawResponse = buildStubAccepted(input.t1.abbreviatedImporterName);
    const parsed = parseImporterCreateResponse(rawResponse);

    if (parsed.accepted) {
      const recordUpdate: Prisma.FiveOhSixRecordUpdateInput = { status: "accepted" };
      if (parsed.cbpAssignedNumber && actionCode === "N") {
        recordUpdate.cbpAssignedNumber = parsed.cbpAssignedNumber;
        await db.importerOfRecord.update({
          where: { id: ior.id },
          data: { cbpImporterNumber: parsed.cbpAssignedNumber, registrationStatus: "registered" },
        });
      }
      await db.fiveOhSixRecord.update({ where: { id: recordId }, data: recordUpdate });
      await db.onboardingEvent.create({
        data: {
          accountId: ctx.accountId,
          caseId,
          type: "5106_ACCEPTED",
          actorType: "SYSTEM",
          detail: { recordId, cbpAssignedNumber: parsed.cbpAssignedNumber ?? null },
        },
      });
    } else if (parsed.dispositionRecords.some((r) => r.dispositionTypeCode === "R")) {
      await db.fiveOhSixRecord.update({ where: { id: recordId }, data: { status: "rejected" } });
      await db.onboardingEvent.create({
        data: {
          accountId: ctx.accountId,
          caseId,
          type: "5106_REJECTED",
          actorType: "SYSTEM",
          detail: {
            recordId,
            parseErrors: parsed.errors,
          } as Prisma.InputJsonValue,
        },
      });
    }

    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: AuditAction.ONBOARDING_5106_TRANSMITTED,
      entity: "FiveOhSixRecord",
      entityId: recordId,
      metadata: { caseId, transmissionRef, actionCode, accepted: parsed.accepted },
    });

    return NextResponse.json({
      ok: true,
      accepted: parsed.accepted,
      cbpAssignedNumber: parsed.cbpAssignedNumber ?? null,
      transmissionRef,
      requestId,
    });
  },
  { permission: "onboarding.manage", write: true }
);

function buildStubAccepted(importerName: string): string {
  // Stub E0 + E1 response lines (each padded to 80 chars).
  const nameField = importerName.toUpperCase().slice(0, 32).padEnd(32, " ");
  const numField = "            "; // 12 spaces — no assigned number in stub
  // E0: control="E0", filler, type="IMPACC", filler, occurrence="000001", filler, constant="REF ID:", filler, data(55X)
  const e0Data = (numField + nameField).slice(0, 55).padEnd(55, " ");
  const e0 = ("E0 IMPACC 000001 REF ID: " + e0Data).padEnd(80, " ");
  // E1: control="E1", disposition="A", severity=" ", condition="000", reason="   ", narrative
  const e1 = ("E1A 000   ACCEPTED                                      ").padEnd(80, " ");
  return e0 + "\r\n" + e1 + "\r\n";
}
