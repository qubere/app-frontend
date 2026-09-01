// Bond verification service for the onboarding wizard.
// Three methods in priority order (§7.1):
//   1. CBP_IMPORTER_BOND_QUERY (KI/KR) — real CBP query via RealAceProvider.
//      Depends on ABI transport Phase 1; falls back automatically when not configured.
//   2. SURETY_CODE_LOOKUP — validate surety code against the bundled active_sureties_2025 list.
//      Sets Bond.status: "attested" (softer than "verified").
//   3. MANUAL_ATTESTATION — operator-attested note. Also sets Bond.status: "attested".
//
// Only CBP_IMPORTER_BOND_QUERY with result "match" sets Bond.status: "verified".

import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { Decimal } from "@/lib/tariff/decimal";
import { lookupSuretyByCode, lookupSuretyByName, isSuretyCodeValid } from "@/lib/abi/suretyCodes";
import {
  classifyImporterBondQueryLine,
  parseK1,
  parseK2,
  buildImporterBondQuery,
} from "@/lib/abi/importerBondQuery";

export type VerificationMethod =
  | "CBP_IMPORTER_BOND_QUERY"
  | "SURETY_CODE_LOOKUP"
  | "MANUAL_ATTESTATION";

export type VerificationResult =
  | "match"
  | "no_bond_on_file"
  | "mismatch"
  | "lapsed"
  | "surety_unconfirmed"
  | "surety_confirmed"
  | "error";

interface BondShape {
  id: string;
  accountId: string;
  bondNumber: string;
  bondAmount: Decimal;
  suretyCode: string | null;
  suretyName: string;
  activityCode: string | null;
  effectiveDate: Date;
  expirationDate: Date | null;
  bondType: string;
}

function assertBondAccess(bond: { accountId: string }, accountId: string) {
  if (bond.accountId !== accountId) {
    throw Object.assign(new Error("Not found"), { code: "NOT_FOUND" });
  }
}

// ---------------------------------------------------------------------------
// KI/KR — real CBP importer/bond query via ABI transport
// ---------------------------------------------------------------------------

async function attemptCbpQuery(
  accountId: string,
  bond: BondShape,
  importerNumber: string
): Promise<{ result: VerificationResult; requestRaw: string; responseRaw: string; discrepancies: unknown[] }> {
  // Resolve AbiFilerCredential for the account
  const cred = await db.abiFilerCredential.findUnique({ where: { accountId } });
  if (!cred) {
    throw new Error("No ABI filer credential configured — CBP query not available");
  }

  // Build the KI input record
  const kiRecord = buildImporterBondQuery({
    importerNumber1: importerNumber,
    addressRequestCode1: "1",
  });

  // ABI transport is not yet wired (ABI cert Phase 1). When the RealAceProvider
  // is ready, replace this stub with:
  //   const provider = await getTransmissionProvider(accountId);
  //   const responseLines = await provider.transmitQuery(kiRecord);
  // For now, throw so the caller falls back to SURETY_CODE_LOOKUP.
  void kiRecord; // prevent unused-variable lint
  throw new Error("ABI transport not yet configured — falling back to surety code lookup");
}

function interpretKiKrResponse(
  responseLines: string[],
  bond: BondShape
): { result: VerificationResult; discrepancies: Array<{ field: string; expected: unknown; cbpValue: unknown }> } {
  const k1Lines = responseLines.filter((l) => classifyImporterBondQueryLine(l) === "K1");
  const k2Lines = responseLines.filter((l) => classifyImporterBondQueryLine(l) === "K2");

  if (k1Lines.length === 0) return { result: "error", discrepancies: [] };

  const k1 = parseK1(k1Lines[0]);
  const k2 = k2Lines.length > 0 ? parseK2(k2Lines[0]) : null;

  const qrc = k1.queryResultsCode;
  if (qrc === 2) return { result: "no_bond_on_file", discrepancies: [] };
  if (qrc === 3 || qrc === 4) return { result: "lapsed", discrepancies: [] };
  if (qrc === 0) return { result: "no_bond_on_file", discrepancies: [] };
  // qrc === 1: on file with continuous bond
  const discrepancies: Array<{ field: string; expected: unknown; cbpValue: unknown }> = [];

  // Bond amount — prefer K2 if bondAmountRecordLocationIndicator === "2"
  const cbpAmount = k1.bondAmountRecordLocationIndicator === "2" && k2?.bondAmount
    ? k2.bondAmount
    : k1.bondAmount;
  if (cbpAmount && !cbpAmount.equals(bond.bondAmount)) {
    discrepancies.push({ field: "bondAmount", expected: bond.bondAmount.toString(), cbpValue: cbpAmount.toString() });
  }

  // Surety code
  if (k1.suretyCode && bond.suretyCode && k1.suretyCode.trim() !== bond.suretyCode.trim()) {
    discrepancies.push({ field: "suretyCode", expected: bond.suretyCode, cbpValue: k1.suretyCode });
  }

  // Bond termination
  if (k2?.bondTerminationDate && k2.bondTerminationDate < new Date()) {
    return { result: "lapsed", discrepancies };
  }

  const result: VerificationResult = discrepancies.length > 0 ? "mismatch" : "match";
  return { result, discrepancies };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class BondVerificationService {
  static async verifyBond(
    accountId: string,
    bondId: string,
    importerNumber: string,
    userId: string
  ) {
    const bond = await db.bond.findUnique({ where: { id: bondId } });
    if (!bond) throw Object.assign(new Error("Not found"), { code: "NOT_FOUND" });
    assertBondAccess(bond, accountId);

    // Idempotency: don't re-verify within 60 seconds for the same method
    const recent = await db.bondVerification.findFirst({
      where: {
        bondId,
        method: "CBP_IMPORTER_BOND_QUERY",
        performedAt: { gte: new Date(Date.now() - 60_000) },
      },
    });
    if (recent) return recent;

    let method: VerificationMethod = "CBP_IMPORTER_BOND_QUERY";
    let result: VerificationResult = "error";
    let requestRaw = "";
    let responseRaw = "";
    let discrepancies: unknown[] = [];
    let cbpFallback = false;

    // 1. Try KI/KR
    try {
      const cbp = await attemptCbpQuery(accountId, bond as BondShape, importerNumber);
      result = cbp.result;
      requestRaw = cbp.requestRaw;
      responseRaw = cbp.responseRaw;
      discrepancies = cbp.discrepancies;
    } catch {
      cbpFallback = true;
    }

    // 2. Fallback: surety code lookup
    if (cbpFallback) {
      method = "SURETY_CODE_LOOKUP";
      const codeToCheck = bond.suretyCode?.trim();
      const nameToCheck = bond.suretyName?.trim();
      const byCode = codeToCheck ? lookupSuretyByCode(codeToCheck) : undefined;
      const byName = nameToCheck ? lookupSuretyByName(nameToCheck) : undefined;
      const entry = byCode ?? byName;

      if (entry) {
        result = "surety_confirmed";
        responseRaw = JSON.stringify({
          source: "CBP Active Sureties List — Department Circular 570, August 1, 2025",
          matchedCode: entry.code,
          matchedName: entry.name,
          lookedUpBy: byCode ? "code" : "name",
        });
      } else {
        result = "surety_unconfirmed";
        responseRaw = JSON.stringify({
          source: "CBP Active Sureties List — Department Circular 570, August 1, 2025",
          searched: { code: codeToCheck, name: nameToCheck },
          note: "Surety not found in bundled active sureties list",
        });
      }
    }

    // Determine new bond status
    const newBondStatus =
      method === "CBP_IMPORTER_BOND_QUERY" && result === "match"
        ? "verified"
        : result === "lapsed"
        ? "verification_failed"
        : result === "mismatch"
        ? "verification_failed"
        : "attested"; // surety_confirmed, surety_unconfirmed, no_bond_on_file → attested

    const verification = await db.$transaction(async (tx) => {
      const v = await tx.bondVerification.create({
        data: {
          accountId,
          bondId,
          method,
          result,
          queriedImporterNumber: importerNumber,
          requestRaw: requestRaw || null,
          responseRaw: responseRaw || null,
          discrepancies: discrepancies.length > 0 ? (discrepancies as object[]) : undefined,
          suretyCode: bond.suretyCode,
          suretyName: bond.suretyName,
          performedAt: new Date(),
          createdAt: new Date(),
        },
      });

      await tx.bond.update({
        where: { id: bondId },
        data: {
          status: newBondStatus,
          lastVerifiedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      return v;
    });

    await db.onboardingEvent.create({
      data: {
        accountId,
        caseId: await resolveEntityCaseId(bondId),
        type: "BOND_VERIFIED",
        actorUserId: userId,
        actorType: "USER",
        detail: { bondId, method, result, verificationId: verification.id },
        createdAt: new Date(),
      },
    }).catch(() => { /* event is non-critical */ });

    await createAuditLog({
      accountId,
      userId,
      action: "BOND_VERIFIED",
      entity: "Bond",
      entityId: bondId,
      source: "UI",
      metadata: { method, result, verificationId: verification.id },
    });

    return verification;
  }

  static async attestBond(
    accountId: string,
    bondId: string,
    userId: string,
    note: string,
    suretyLetterDocumentId?: string
  ) {
    const bond = await db.bond.findUnique({ where: { id: bondId } });
    if (!bond) throw Object.assign(new Error("Not found"), { code: "NOT_FOUND" });
    assertBondAccess(bond, accountId);

    const verification = await db.$transaction(async (tx) => {
      const v = await tx.bondVerification.create({
        data: {
          accountId,
          bondId,
          method: "MANUAL_ATTESTATION",
          result: "match",
          queriedImporterNumber: null,
          responseRaw: suretyLetterDocumentId
            ? JSON.stringify({ suretyLetterDocumentId })
            : null,
          suretyCode: bond.suretyCode,
          suretyName: bond.suretyName,
          attestedByUserId: userId,
          attestationNote: note,
          performedAt: new Date(),
          createdAt: new Date(),
        },
      });

      await tx.bond.update({
        where: { id: bondId },
        data: { status: "attested", lastVerifiedAt: new Date(), updatedAt: new Date() },
      });

      return v;
    });

    await createAuditLog({
      accountId,
      userId,
      action: "BOND_VERIFIED",
      entity: "Bond",
      entityId: bondId,
      source: "UI",
      metadata: { method: "MANUAL_ATTESTATION", verificationId: verification.id },
    });

    return verification;
  }

  static async listVerifications(accountId: string, bondId: string) {
    const bond = await db.bond.findUnique({ where: { id: bondId }, select: { accountId: true } });
    if (!bond) throw Object.assign(new Error("Not found"), { code: "NOT_FOUND" });
    assertBondAccess(bond, accountId);
    return db.bondVerification.findMany({
      where: { bondId },
      orderBy: { performedAt: "desc" },
    });
  }

  static async lookupSurety(code: string, name: string) {
    const entry = (code ? lookupSuretyByCode(code) : undefined) ?? (name ? lookupSuretyByName(name) : undefined);
    return {
      found: !!entry,
      entry: entry ?? null,
      valid: code ? isSuretyCodeValid(code) : false,
    };
  }

  static async createBondForEntity(
    accountId: string,
    caseId: string,
    entityId: string,
    userId: string,
    input: {
      coverage: "own" | "broker_bond" | "single_transaction" | "none";
      bond?: {
        suretyName?: string;
        suretyCode?: string;
        bondNumber?: string;
        bondType?: string;
        bondAmount?: number;
        activityCode?: string;
        effectiveDate?: string;
        expirationDate?: string;
      };
    }
  ) {
    const entity = await db.onboardingEntity.findUnique({ where: { id: entityId } });
    if (!entity || entity.accountId !== accountId || entity.caseId !== caseId) {
      throw Object.assign(new Error("Not found"), { code: "NOT_FOUND" });
    }

    // For broker_bond, link the account's master bond (first active broker bond)
    if (input.coverage === "broker_bond") {
      const masterBond = await db.bond.findFirst({
        where: { accountId, bondType: "continuous", status: { in: ["verified", "attested", "unverified"] } },
        orderBy: { createdAt: "asc" },
      });
      await db.onboardingEntity.update({
        where: { id: entityId },
        data: { bondCoverage: "broker_bond", bondId: masterBond?.id ?? null, updatedAt: new Date() },
      });
      return { coverage: "broker_bond", bond: masterBond };
    }

    if (input.coverage === "single_transaction" || input.coverage === "none") {
      await db.onboardingEntity.update({
        where: { id: entityId },
        data: { bondCoverage: input.coverage, bondId: null, updatedAt: new Date() },
      });
      return { coverage: input.coverage, bond: null };
    }

    // "own" — create a new bond record
    const b = input.bond;
    if (!b?.bondNumber) throw new Error("bondNumber is required for own-bond coverage");
    if (!b?.bondAmount || b.bondAmount <= 0) throw new Error("bondAmount must be positive");
    if (!b?.suretyName) throw new Error("suretyName is required");

    // Check duplicate
    const existing = await db.bond.findUnique({ where: { bondNumber: b.bondNumber } });
    if (existing && existing.accountId === accountId) {
      // Re-link the existing bond to this entity
      await db.onboardingEntity.update({
        where: { id: entityId },
        data: { bondCoverage: "own", bondId: existing.id, updatedAt: new Date() },
      });
      return { coverage: "own", bond: existing };
    }
    if (existing) throw new Error(`Bond number ${b.bondNumber} already exists`);

    const bond = await db.bond.create({
      data: {
        accountId,
        bondType: b.bondType ?? "continuous",
        suretyName: b.suretyName,
        suretyCode: b.suretyCode ?? null,
        bondNumber: b.bondNumber,
        bondAmount: b.bondAmount,
        activityCode: b.activityCode ?? null,
        effectiveDate: b.effectiveDate ? new Date(b.effectiveDate) : new Date(),
        expirationDate: b.expirationDate ? new Date(b.expirationDate) : null,
        status: "unverified",
        updatedAt: new Date(),
      },
    });

    await db.onboardingEntity.update({
      where: { id: entityId },
      data: { bondCoverage: "own", bondId: bond.id, updatedAt: new Date() },
    });

    await db.onboardingEvent.create({
      data: {
        accountId,
        caseId,
        type: "BOND_CAPTURED",
        actorUserId: userId,
        actorType: "USER",
        detail: { bondId: bond.id, coverage: "own" },
        createdAt: new Date(),
      },
    }).catch(() => {});

    return { coverage: "own", bond };
  }
}

// Resolve the onboarding case ID for a bond (via OnboardingEntity) — best-effort for event logging.
async function resolveEntityCaseId(bondId: string): Promise<string> {
  const entity = await db.onboardingEntity.findFirst({ where: { bondId }, select: { caseId: true } });
  return entity?.caseId ?? "unknown";
}
