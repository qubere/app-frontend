import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { computeReadiness } from "./readiness";

export type OnboardingPath = "STANDARD" | "SWITCHING" | "NON_RESIDENT" | "BULK" | "ERP";

export interface CaseCreateInput {
  path: OnboardingPath;
  clientId?: string;
  newClient?: { name: string; contactName?: string; contactEmail?: string };
  assignedUserId?: string;
  source?: string;
}

export interface CasePatchInput {
  assignedUserId?: string | null;
  projectedAnnualDutyTaxFee?: string;
  path?: OnboardingPath;
}

function assertCaseAccess(caseRecord: { accountId: string }, accountId: string) {
  if (caseRecord.accountId !== accountId) {
    throw Object.assign(new Error("Not found"), { code: "NOT_FOUND" });
  }
}

export class CaseService {
  static async listCases(
    accountId: string,
    filters: { status?: string; assignedUserId?: string; clientId?: string; q?: string }
  ) {
    const where: Record<string, unknown> = { accountId };
    if (filters.status) where.status = filters.status;
    if (filters.assignedUserId) where.assignedUserId = filters.assignedUserId;
    if (filters.clientId) where.clientId = filters.clientId;

    const cases = await db.onboardingCase.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        primaryImporter: { select: { id: true, name: true } },
        entities: { select: { id: true, importerNumberType: true, importerNumber: true, screeningStatus: true, bondCoverage: true } },
        _count: { select: { events: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const q = filters.q?.toLowerCase();
    if (!q) return cases;
    return cases.filter(
      (c) =>
        c.client?.name.toLowerCase().includes(q) ||
        c.primaryImporter?.name.toLowerCase().includes(q) ||
        c.id.includes(q)
    );
  }

  static async getCase(accountId: string, caseId: string) {
    const c = await db.onboardingCase.findUnique({
      where: { id: caseId },
      include: {
        client: true,
        primaryImporter: true,
        entities: {
          include: {
            legalEntity: true,
            importerOfRecord: true,
            poa: { include: { envelope: true } },
            bond: { include: { verifications: { orderBy: { performedAt: "desc" }, take: 1 } } },
          },
        },
        fiveOhSixRecords: { orderBy: { createdAt: "desc" } },
        events: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });
    if (!c) throw Object.assign(new Error("Not found"), { code: "NOT_FOUND" });
    assertCaseAccess(c, accountId);

    const readiness = computeReadiness(c as Parameters<typeof computeReadiness>[0]);
    return { ...c, readiness };
  }

  static async createCase(accountId: string, userId: string, input: CaseCreateInput) {
    let clientId = input.clientId;

    if (!clientId && input.newClient) {
      const newClient = await db.client.create({
        data: {
          accountId,
          name: input.newClient.name,
          contactName: input.newClient.contactName,
          contactEmail: input.newClient.contactEmail,
          status: "ONBOARDING",
        },
      });
      clientId = newClient.id;
    }

    const onboardingCase = await db.onboardingCase.create({
      data: {
        accountId,
        clientId,
        path: input.path,
        status: "draft",
        currentStep: 1,
        stepStatus: {},
        blockers: [],
        assignedUserId: input.assignedUserId,
        source: input.source ?? "UI",
        updatedAt: new Date(),
      },
    });

    await db.onboardingEvent.create({
      data: {
        accountId,
        caseId: onboardingCase.id,
        type: "CASE_CREATED",
        actorUserId: userId,
        actorType: "USER",
        detail: { path: input.path, clientId },
        createdAt: new Date(),
      },
    });

    await createAuditLog({
      accountId,
      userId,
      action: "ONBOARDING_CASE_CREATED",
      entity: "OnboardingCase",
      entityId: onboardingCase.id,
      source: "UI",
      metadata: { path: input.path, clientId },
    });

    return onboardingCase;
  }

  static async patchCase(accountId: string, caseId: string, input: CasePatchInput) {
    const existing = await db.onboardingCase.findUnique({ where: { id: caseId } });
    if (!existing) throw Object.assign(new Error("Not found"), { code: "NOT_FOUND" });
    assertCaseAccess(existing, accountId);

    return db.onboardingCase.update({
      where: { id: caseId },
      data: {
        ...(input.assignedUserId !== undefined && { assignedUserId: input.assignedUserId }),
        ...(input.projectedAnnualDutyTaxFee !== undefined && {
          projectedAnnualDutyTaxFee: input.projectedAnnualDutyTaxFee
            ? parseFloat(input.projectedAnnualDutyTaxFee)
            : null,
        }),
        ...(input.path !== undefined && { path: input.path }),
        updatedAt: new Date(),
      },
    });
  }

  static async activateCase(accountId: string, caseId: string, userId: string) {
    const c = await db.onboardingCase.findUnique({
      where: { id: caseId },
      include: { entities: { include: { poa: true, bond: true } }, fiveOhSixRecords: true, primaryImporter: true },
    });
    if (!c) throw Object.assign(new Error("Not found"), { code: "NOT_FOUND" });
    assertCaseAccess(c, accountId);

    const readiness = computeReadiness(c as Parameters<typeof computeReadiness>[0]);
    if (!readiness.ready) {
      const err = Object.assign(new Error("Case not ready to activate"), {
        code: "NOT_READY",
        blockers: readiness.checklist.filter((i) => i.status !== "done" && i.status !== "waived"),
      });
      throw err;
    }

    await db.$transaction([
      db.onboardingCase.update({
        where: { id: caseId },
        data: { status: "active", activatedAt: new Date(), activatedByUserId: userId, updatedAt: new Date() },
      }),
      ...(c.clientId
        ? [db.client.update({ where: { id: c.clientId }, data: { status: "ACTIVE" } })]
        : []),
      ...(c.primaryImporterId
        ? [db.importerOfRecord.update({
            where: { id: c.primaryImporterId },
            data: { registrationStatus: "registered" },
          })]
        : []),
      db.onboardingEvent.create({
        data: {
          accountId,
          caseId,
          type: "ACTIVATED",
          actorUserId: userId,
          actorType: "USER",
          detail: {},
          createdAt: new Date(),
        },
      }),
    ]);

    await createAuditLog({
      accountId,
      userId,
      action: "IMPORTER_ACTIVATED",
      entity: "OnboardingCase",
      entityId: caseId,
      source: "UI",
      metadata: {},
    });

    return { activated: true };
  }

  static async withdrawCase(accountId: string, caseId: string, userId: string, reason: string) {
    const existing = await db.onboardingCase.findUnique({ where: { id: caseId } });
    if (!existing) throw Object.assign(new Error("Not found"), { code: "NOT_FOUND" });
    assertCaseAccess(existing, accountId);

    await db.onboardingCase.update({
      where: { id: caseId },
      data: { status: "withdrawn", withdrawnReason: reason, updatedAt: new Date() },
    });

    await db.onboardingEvent.create({
      data: { accountId, caseId, type: "WITHDRAWN", actorUserId: userId, actorType: "USER", detail: { reason }, createdAt: new Date() },
    });

    return { withdrawn: true };
  }

  static async grantWaiver(
    accountId: string,
    caseId: string,
    userId: string,
    checklistItem: string,
    reason: string
  ) {
    const existing = await db.onboardingCase.findUnique({ where: { id: caseId } });
    if (!existing) throw Object.assign(new Error("Not found"), { code: "NOT_FOUND" });
    assertCaseAccess(existing, accountId);

    const stepStatus = (existing.stepStatus as Record<string, unknown>) ?? {};
    stepStatus[`waiver_${checklistItem}`] = { reason, grantedByUserId: userId, grantedAt: new Date().toISOString() };

    await db.onboardingCase.update({
      where: { id: caseId },
      data: { stepStatus: stepStatus as object, updatedAt: new Date() },
    });

    await db.onboardingEvent.create({
      data: {
        accountId,
        caseId,
        type: "WAIVER_GRANTED",
        actorUserId: userId,
        actorType: "USER",
        detail: { checklistItem, reason },
        createdAt: new Date(),
      },
    });

    await createAuditLog({
      accountId,
      userId,
      action: "ONBOARDING_WAIVER_GRANTED",
      entity: "OnboardingCase",
      entityId: caseId,
      source: "UI",
      metadata: { checklistItem, reason },
    });

    return { waived: true };
  }

  static async listEvents(accountId: string, caseId: string) {
    const c = await db.onboardingCase.findUnique({ where: { id: caseId }, select: { accountId: true } });
    if (!c) throw Object.assign(new Error("Not found"), { code: "NOT_FOUND" });
    assertCaseAccess(c, accountId);
    return db.onboardingEvent.findMany({ where: { caseId }, orderBy: { createdAt: "desc" } });
  }
}
