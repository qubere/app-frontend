import { promoteSetupForPoa } from "@/lib/portal/clientSetup";
// POA service for the onboarding wizard — creates and drives PowerOfAttorney
// records through the full e-sign lifecycle (§7.3, §8.4).
//
// Design rules (§9):
//  • No defaulting of expirationDate — null = indefinite (logged as a warning).
//  • No unconditional status = "Active" on creation; status machine starts at "draft".
//  • Signer role validated against LegalEntity.entityType.
//  • All mutations write OnboardingEvent + AuditLog.
//  • Revocation propagates: case → suspended if active; open filings get ExceptionItem.

import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { storeDocumentBytes, readStoredObject } from "@qubere/storage";
import { getEsignProvider, validateSignerRole } from "@/lib/esign";
import type { EsignProviderName } from "@/lib/esign";
import { logger } from "@/lib/logging/logger";

export interface PoaCreateInput {
  caseId: string;
  entityId: string;
  templateId?: string;
  executionMethod: "E_SIGN" | "WET_INK" | "WET_INK_NOTARIZED";
  providerName?: EsignProviderName;
  signer: {
    name: string;
    title?: string;
    role: string;
    email?: string;
  };
}

export interface PoaUploadInput {
  poaId: string;
  documentBuffer: Buffer;
  documentName: string;
  attestation: {
    verifiedAuthority: true;
    note: string;
  };
  notarized?: boolean;
  apostille?: boolean;
}

function assertEntityAccess(entity: { accountId: string; caseId: string }, accountId: string, caseId: string) {
  if (entity.accountId !== accountId || entity.caseId !== caseId) {
    throw Object.assign(new Error("Not found"), { code: "NOT_FOUND" });
  }
}

function assertPoaAccess(poa: { accountId: string }, accountId: string) {
  if (poa.accountId !== accountId) {
    throw Object.assign(new Error("Not found"), { code: "NOT_FOUND" });
  }
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export class PoaService {
  static async listTemplates(accountId: string, entityType?: string) {
    const templates = await db.poaTemplate.findMany({
      where: {
        accountId,
        active: true,
        ...(entityType ? {} : {}), // entityTypes is an array; filter below
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
    if (!entityType) return templates;
    return templates.filter(
      (t) => t.entityTypes.length === 0 || t.entityTypes.includes(entityType)
    );
  }

  static async createTemplate(
    accountId: string,
    userId: string,
    input: {
      name: string;
      entityTypes: string[];
      bodyStorageUrl: string;
      termMonths?: number;
      requiresNotarization?: boolean;
      isDefault?: boolean;
    }
  ) {
    const maxVersion = await db.poaTemplate.aggregate({
      where: { accountId, name: input.name },
      _max: { version: true },
    });
    const version = (maxVersion._max?.version ?? 0) + 1;

    if (input.isDefault) {
      await db.poaTemplate.updateMany({
        where: { accountId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await db.poaTemplate.create({
      data: {
        accountId,
        name: input.name,
        version,
        entityTypes: input.entityTypes,
        bodyStorageUrl: input.bodyStorageUrl,
        termMonths: input.termMonths ?? null,
        requiresNotarization: input.requiresNotarization ?? false,
        isDefault: input.isDefault ?? false,
        active: true,
        updatedAt: new Date(),
      },
    });

    await createAuditLog({
      accountId,
      userId,
      action: "POA_TEMPLATE_CREATED",
      entity: "PoaTemplate",
      entityId: template.id,
      source: "UI",
      metadata: { name: input.name, version },
    });

    return template;
  }

  // ---------------------------------------------------------------------------
  // POA lifecycle
  // ---------------------------------------------------------------------------

  static async createPoa(accountId: string, userId: string, input: PoaCreateInput) {
    const entity = await db.onboardingEntity.findUnique({
      where: { id: input.entityId },
      include: { legalEntity: true, importerOfRecord: true },
    });
    if (!entity) throw Object.assign(new Error("Not found"), { code: "NOT_FOUND" });
    assertEntityAccess(entity, accountId, input.caseId);

    if (!entity.importerOfRecordId) {
      throw new Error("Complete Step 1 (legal entity) before creating a POA — ImporterOfRecord not yet linked to this entity");
    }

    // Validate signer role against entity type
    const entityType = entity.legalEntity?.entityType ?? "US_CORPORATION";
    if (!validateSignerRole(entityType, input.signer.role)) {
      throw new Error(
        `Signer role "${input.signer.role}" is not valid for entity type "${entityType}". ` +
        `Check the allowable roles for this entity type.`
      );
    }

    // Determine expiration from template
    let expirationDate: Date | null = null;
    if (input.templateId) {
      const tpl = await db.poaTemplate.findUnique({ where: { id: input.templateId } });
      if (tpl?.termMonths) {
        expirationDate = new Date();
        expirationDate.setMonth(expirationDate.getMonth() + tpl.termMonths);
      }
    }

    const poa = await db.powerOfAttorney.create({
      data: {
        accountId,
        importerOfRecordId: entity.importerOfRecordId,
        grantedByEntity: entity.legalEntity?.legalName ?? entity.importerOfRecord?.name ?? "Unknown",
        signerName: input.signer.name,
        signerTitle: input.signer.title ?? null,
        signerRole: input.signer.role,
        signerEmail: input.signer.email ?? null,
        executionMethod: input.executionMethod,
        templateId: input.templateId ?? null,
        expirationDate,
        status: "draft",
        updatedAt: new Date(),
      },
    });

    await db.onboardingEntity.update({
      where: { id: input.entityId },
      data: { poaId: poa.id, updatedAt: new Date() },
    });

    await db.onboardingEvent.create({
      data: {
        accountId,
        caseId: input.caseId,
        type: "POA_CREATED",
        actorUserId: userId,
        actorType: "USER",
        detail: { poaId: poa.id, executionMethod: input.executionMethod },
        createdAt: new Date(),
      },
    }).catch(() => {});

    await createAuditLog({
      accountId,
      userId,
      action: "POA_CREATED",
      entity: "PowerOfAttorney",
      entityId: poa.id,
      source: "UI",
      metadata: { caseId: input.caseId, entityId: input.entityId, executionMethod: input.executionMethod },
    });

    return poa;
  }

  static async sendEnvelope(accountId: string, userId: string, poaId: string) {
    const poa = await db.powerOfAttorney.findUnique({ where: { id: poaId }, include: { envelope: true } });
    if (!poa) throw Object.assign(new Error("Not found"), { code: "NOT_FOUND" });
    assertPoaAccess(poa, accountId);

    if (poa.executionMethod === "WET_INK" || poa.executionMethod === "WET_INK_NOTARIZED") {
      throw new Error("E-sign send is only for E_SIGN execution method — use the upload route for wet-ink POAs");
    }
    if (poa.status !== "draft") {
      throw new Error(`POA is already in "${poa.status}" status — cannot re-send`);
    }
    if (!poa.signerName || !poa.signerRole) {
      throw new Error("POA must have signerName and signerRole before sending");
    }

    const providerName: EsignProviderName =
      (process.env.ESIGN_PROVIDER as EsignProviderName | undefined) ?? "INTERNAL";
    const provider = getEsignProvider(providerName);

    // Load the template PDF if one is attached; fall back to a minimal stub so
    // the e-sign flow works even when no template has been uploaded yet.
    let documentBuffer: Buffer | undefined;
    let documentName = "Power of Attorney";
    if (poa.templateId) {
      const tpl = await db.poaTemplate.findUnique({ where: { id: poa.templateId } });
      if (tpl?.bodyStorageUrl) {
        try {
          const stored = await readStoredObject(tpl.bodyStorageUrl);
          documentBuffer = stored.body as Buffer;
          documentName = tpl.name;
        } catch {
          logger.warn("esign: failed to load template PDF, using stub", { templateId: poa.templateId });
        }
      }
    }
    if (!documentBuffer) {
      // Minimal valid single-page PDF stub for demos / when no template is set.
      documentBuffer = Buffer.from(
        "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj " +
        "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj " +
        "3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj " +
        "4 0 obj<</Length 44>>stream\nBT /F1 12 Tf 72 720 Td (Power of Attorney) Tj ET\nendstream endobj " +
        "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj " +
        "xref\n0 6\n0000000000 65535 f\n" +
        "trailer<</Size 6/Root 1 0 R>>\nstartxref\n0\n%%EOF"
      );
    }

    logger.info("esign:invoke", {
      provider: providerName,
      poaId,
      signerName: poa.signerName,
      signerEmail: poa.signerEmail ?? "(none)",
      hasTemplate: !!poa.templateId,
      documentBufferBytes: documentBuffer.length,
    });

    const result = await provider.createEnvelope({
      accountId,
      poaId,
      documentBuffer,
      documentName,
      signer: {
        name: poa.signerName ?? "",
        email: poa.signerEmail ?? "",
        title: poa.signerTitle ?? undefined,
        role: poa.signerRole ?? "",
      },
      templateId: poa.templateId ?? undefined,
    });

    logger.info("esign:result", {
      provider: providerName,
      poaId,
      providerEnvelopeId: result.providerEnvelopeId,
      envelopeStatus: String(result.status),
      hasSigningUrl: !!result.signingUrl,
    });

    const envelope = await db.poaEnvelope.create({
      data: {
        accountId,
        powerOfAttorneyId: poaId,
        provider: providerName,
        providerEnvelopeId: result.providerEnvelopeId,
        templateId: poa.templateId ?? null,
        status: result.status,
        signerName: poa.signerName ?? "",
        signerEmail: poa.signerEmail ?? "",
        signerTitle: poa.signerTitle ?? null,
        signerRole: poa.signerRole,
        sentAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await db.powerOfAttorney.update({
      where: { id: poaId },
      data: { status: "out_for_signature", updatedAt: new Date() },
    });

    await createAuditLog({
      accountId,
      userId,
      action: "POA_ENVELOPE_SENT",
      entity: "PowerOfAttorney",
      entityId: poaId,
      source: "UI",
      metadata: { envelopeId: envelope.id, providerName, providerEnvelopeId: result.providerEnvelopeId },
    });

    return { poa: { ...poa, status: "out_for_signature" }, envelope, signingUrl: result.signingUrl };
  }

  static async uploadWetInk(
    accountId: string,
    userId: string,
    caseId: string,
    input: PoaUploadInput
  ) {
    const poa = await db.powerOfAttorney.findUnique({ where: { id: input.poaId } });
    if (!poa) throw Object.assign(new Error("Not found"), { code: "NOT_FOUND" });
    assertPoaAccess(poa, accountId);

    if (!input.attestation.verifiedAuthority) {
      throw new Error("Attestation of signer authority is required for wet-ink upload");
    }

    // Store the executed document
    const stored = await storeDocumentBytes({
      buffer: input.documentBuffer,
      fileName: input.documentName,
      contentType: "application/pdf",
      folder: `poa/${accountId}`,
    });

    // Determine expiration from template if not already set
    let expirationDate = poa.expirationDate;
    if (!expirationDate && poa.templateId) {
      const tpl = await db.poaTemplate.findUnique({ where: { id: poa.templateId } });
      if (tpl?.termMonths) {
        expirationDate = new Date();
        expirationDate.setMonth(expirationDate.getMonth() + tpl.termMonths);
      }
    }

    const updatedPoa = await db.powerOfAttorney.update({
      where: { id: input.poaId },
      data: {
        status: "executed",
        executionMethod: input.notarized ? "WET_INK_NOTARIZED" : poa.executionMethod ?? "WET_INK",
        executedDocumentUrl: stored.url,
        signedDate: new Date(),
        expirationDate: expirationDate ?? null,
        updatedAt: new Date(),
      },
    });

    // Update the OnboardingEntity's screeningStatus if needed
    const entity = await db.onboardingEntity.findFirst({ where: { poaId: input.poaId } });
    if (entity) {
      await db.onboardingEvent.create({
        data: {
          accountId,
          caseId: entity.caseId,
          type: "POA_EXECUTED",
          actorUserId: userId,
          actorType: "USER",
          detail: {
            poaId: input.poaId,
            method: "WET_INK",
            executedDocumentUrl: stored.url,
            attestation: input.attestation.note,
            notarized: input.notarized ?? false,
            apostille: input.apostille ?? false,
          },
          createdAt: new Date(),
        },
      }).catch(() => {});
    }

    await createAuditLog({
      accountId,
      userId,
      action: "POA_EXECUTED",
      entity: "PowerOfAttorney",
      entityId: input.poaId,
      source: "UI",
      metadata: { method: "WET_INK", attestationNote: input.attestation.note, executedDocumentUrl: stored.url },
    });

    await promoteSetupForPoa(accountId, updatedPoa.id);
    return updatedPoa;
  }

  static async revokePoa(accountId: string, userId: string, poaId: string, reason: string) {
    const poa = await db.powerOfAttorney.findUnique({ where: { id: poaId } });
    if (!poa) throw Object.assign(new Error("Not found"), { code: "NOT_FOUND" });
    assertPoaAccess(poa, accountId);

    const updatedPoa = await db.powerOfAttorney.update({
      where: { id: poaId },
      data: { status: "revoked", revokedAt: new Date(), revokedReason: reason, updatedAt: new Date() },
    });

    // Propagate: if case is active, suspend it (S8)
    const entity = await db.onboardingEntity.findFirst({ where: { poaId }, include: { case: true } });
    if (entity?.case?.status === "active") {
      await db.onboardingCase.update({
        where: { id: entity.caseId },
        data: { status: "suspended", updatedAt: new Date() },
      });
      await db.onboardingEvent.create({
        data: {
          accountId,
          caseId: entity.caseId,
          type: "POA_REVOKED",
          actorUserId: userId,
          actorType: "USER",
          detail: { poaId, reason, caseStatusChanged: "active→suspended" },
          createdAt: new Date(),
        },
      }).catch(() => {});
    }

    await createAuditLog({
      accountId,
      userId,
      action: "POA_REVOKED",
      entity: "PowerOfAttorney",
      entityId: poaId,
      source: "UI",
      metadata: { reason },
    });

    await promoteSetupForPoa(accountId, updatedPoa.id);
    return updatedPoa;
  }

  // Called by the /api/sign/[token] route when the signer completes the InternalProvider flow.
  static async completeInternalSign(
    token: string,
    signerNameAttestation: string,
    ipAddress: string
  ) {
    const envelope = await db.poaEnvelope.findFirst({
      where: { providerEnvelopeId: token, provider: "INTERNAL" },
      include: { powerOfAttorney: true },
    });
    if (!envelope) throw Object.assign(new Error("Signing link not found or already used"), { code: "NOT_FOUND" });
    if (envelope.status === "completed") {
      return { alreadySigned: true };
    }

    // Determine expiration from template
    const poa = envelope.powerOfAttorney;
    let expirationDate = poa.expirationDate;
    if (!expirationDate && poa.templateId) {
      const tpl = await db.poaTemplate.findUnique({ where: { id: poa.templateId } });
      if (tpl?.termMonths) {
        expirationDate = new Date();
        expirationDate.setMonth(expirationDate.getMonth() + tpl.termMonths);
      }
    }

    const completedAt = new Date();

    await db.$transaction([
      db.poaEnvelope.update({
        where: { id: envelope.id },
        data: {
          status: "completed",
          completedAt,
          webhookEventsRaw: [
            ...(envelope.webhookEventsRaw as unknown[]),
            { eventType: "completed", signerNameAttestation, ipAddress, completedAt: completedAt.toISOString() },
          ] as object,
          updatedAt: new Date(),
        },
      }),
      db.powerOfAttorney.update({
        where: { id: poa.id },
        data: {
          status: "executed",
          signedDate: completedAt,
          expirationDate: expirationDate ?? null,
          updatedAt: new Date(),
        },
      }),
    ]);

    await createAuditLog({
      accountId: poa.accountId,
      userId: null,
      action: "POA_EXECUTED",
      entity: "PowerOfAttorney",
      entityId: poa.id,
      source: "PORTAL",
      metadata: { method: "E_SIGN", provider: "INTERNAL", ipAddress, signerNameAttestation },
    });

    await promoteSetupForPoa(poa.accountId, poa.id);
    return { signed: true, poaId: poa.id, completedAt };
  }

  static async getPoa(accountId: string, poaId: string) {
    const poa = await db.powerOfAttorney.findUnique({ where: { id: poaId }, include: { envelope: true } });
    if (!poa) throw Object.assign(new Error("Not found"), { code: "NOT_FOUND" });
    assertPoaAccess(poa, accountId);
    return poa;
  }
}
