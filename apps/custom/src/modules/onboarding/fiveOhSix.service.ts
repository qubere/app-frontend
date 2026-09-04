import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

export interface FiveOhSixOfficer {
  name: string;
  title: string;
  ssnLast4: string;
  dobLast4: string;
}

export interface FiveOhSixAddress {
  line1: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
}

export interface FiveOhSixPayload {
  action: "CREATE" | "UPDATE";
  importerNumberType: "EIN" | "SSN" | "CBP_ASSIGNED";
  importerNumber: string | null;
  legalName: string;
  tradeName: string | null;
  entityType: string;
  programIndicator: "IR";
  naicsCode: string | null;
  relatedBusiness: boolean;
  officers: FiveOhSixOfficer[];
  physicalAddress: FiveOhSixAddress;
  mailingAddress: FiveOhSixAddress | null;
  contact: { name: string; phone: string; email: string };
  residentAgent: { name: string; address: string; phone: string } | null;
}

function assertRecordAccess(
  record: { accountId: string; caseId: string | null },
  accountId: string,
  caseId: string
) {
  if (record.accountId !== accountId || record.caseId !== caseId) {
    throw Object.assign(new Error("Not found"), { code: "NOT_FOUND" });
  }
}

export class FiveOhSixService {
  static async listRecords(accountId: string, caseId: string) {
    const c = await db.onboardingCase.findUnique({
      where: { id: caseId },
      select: { accountId: true },
    });
    if (!c || c.accountId !== accountId)
      throw Object.assign(new Error("Not found"), { code: "NOT_FOUND" });

    return db.fiveOhSixRecord.findMany({
      where: { accountId, caseId },
      orderBy: { createdAt: "asc" },
    });
  }

  static async createRecord(
    accountId: string,
    caseId: string,
    onboardingEntityId: string | null,
    payload: FiveOhSixPayload,
    userId: string
  ) {
    const c = await db.onboardingCase.findUnique({
      where: { id: caseId },
      select: { accountId: true },
    });
    if (!c || c.accountId !== accountId)
      throw Object.assign(new Error("Not found"), { code: "NOT_FOUND" });

    const legalEntityId = onboardingEntityId
      ? (
          await db.onboardingEntity.findUnique({
            where: { id: onboardingEntityId },
            select: { legalEntityId: true },
          })
        )?.legalEntityId ?? null
      : null;

    const record = await db.fiveOhSixRecord.create({
      data: {
        accountId,
        caseId,
        onboardingEntityId,
        legalEntityId,
        action: payload.action,
        importerNumberType: payload.importerNumberType,
        importerNumber: payload.importerNumber,
        payload: payload as unknown as object,
        provenance: {},
        status: "draft",
      },
    });

    await createAuditLog({
      accountId,
      userId,
      action: "FIVE_OH_SIX_CREATED",
      entity: "FiveOhSixRecord",
      entityId: record.id,
      source: "UI",
      metadata: { caseId, action: payload.action },
    });

    return record;
  }

  static async updateRecord(
    accountId: string,
    caseId: string,
    recordId: string,
    patch: Partial<FiveOhSixPayload>,
    userId: string
  ) {
    const existing = await db.fiveOhSixRecord.findUnique({ where: { id: recordId } });
    if (!existing) throw Object.assign(new Error("Not found"), { code: "NOT_FOUND" });
    assertRecordAccess(existing, accountId, caseId);
    if (existing.status === "accepted")
      throw Object.assign(new Error("Cannot edit an accepted 5106"), { code: "CONFLICT" });

    const merged = { ...(existing.payload as object), ...patch } as object;

    const updated = await db.fiveOhSixRecord.update({
      where: { id: recordId },
      data: {
        payload: merged,
        importerNumberType: (patch as FiveOhSixPayload).importerNumberType ?? existing.importerNumberType,
        importerNumber: (patch as FiveOhSixPayload).importerNumber ?? existing.importerNumber,
        action: (patch as FiveOhSixPayload).action ?? existing.action,
        status: existing.status === "rejected" ? "draft" : existing.status,
        updatedAt: new Date(),
      },
    });

    await createAuditLog({
      accountId,
      userId,
      action: "FIVE_OH_SIX_UPDATED",
      entity: "FiveOhSixRecord",
      entityId: recordId,
      source: "UI",
      metadata: { caseId },
    });

    return updated;
  }

  static async markGenerated(
    accountId: string,
    caseId: string,
    recordId: string,
    pdfDocumentUrl: string,
    userId: string
  ) {
    const existing = await db.fiveOhSixRecord.findUnique({ where: { id: recordId } });
    if (!existing) throw Object.assign(new Error("Not found"), { code: "NOT_FOUND" });
    assertRecordAccess(existing, accountId, caseId);

    const updated = await db.fiveOhSixRecord.update({
      where: { id: recordId },
      data: { status: "generated", pdfDocumentUrl, updatedAt: new Date() },
    });

    await createAuditLog({
      accountId,
      userId,
      action: "FIVE_OH_SIX_PDF_GENERATED",
      entity: "FiveOhSixRecord",
      entityId: recordId,
      source: "UI",
      metadata: { caseId },
    });

    return updated;
  }

  static async markFiled(
    accountId: string,
    caseId: string,
    recordId: string,
    opts: { deliveryMethod: "ACE_PORTAL" | "PAPER"; confirmationNumber?: string },
    userId: string
  ) {
    const existing = await db.fiveOhSixRecord.findUnique({ where: { id: recordId } });
    if (!existing) throw Object.assign(new Error("Not found"), { code: "NOT_FOUND" });
    assertRecordAccess(existing, accountId, caseId);
    if (existing.status === "accepted")
      throw Object.assign(new Error("Already accepted"), { code: "CONFLICT" });

    const updated = await db.fiveOhSixRecord.update({
      where: { id: recordId },
      data: {
        status: "submitted",
        deliveryMethod: opts.deliveryMethod,
        transmissionRef: opts.confirmationNumber ?? null,
        submittedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Advance case step
    const c = await db.onboardingCase.findUnique({
      where: { id: caseId },
      select: { stepStatus: true, currentStep: true },
    });
    if (c) {
      const ss = (c.stepStatus as Record<string, unknown>) ?? {};
      ss["step_2"] = "done";
      ss["5106_filed"] = true;
      await db.onboardingCase.update({
        where: { id: caseId },
        data: {
          stepStatus: ss as object,
          currentStep: Math.max(c.currentStep, 3),
          updatedAt: new Date(),
        },
      });
    }

    await db.onboardingEvent.create({
      data: {
        accountId,
        caseId,
        type: "5106_SUBMITTED",
        actorUserId: userId,
        actorType: "USER",
        detail: {
          recordId,
          deliveryMethod: opts.deliveryMethod,
          confirmationNumber: opts.confirmationNumber ?? null,
        } as object,
        createdAt: new Date(),
      },
    });

    await createAuditLog({
      accountId,
      userId,
      action: "FIVE_OH_SIX_SUBMITTED",
      entity: "FiveOhSixRecord",
      entityId: recordId,
      source: "UI",
      metadata: { caseId, deliveryMethod: opts.deliveryMethod },
    });

    return updated;
  }

  static async getRecord(accountId: string, caseId: string, recordId: string) {
    const record = await db.fiveOhSixRecord.findUnique({ where: { id: recordId } });
    if (!record) throw Object.assign(new Error("Not found"), { code: "NOT_FOUND" });
    assertRecordAccess(record, accountId, caseId);
    return record;
  }
}
