import { Decimal } from "@/lib/tariff/decimal";
import {
  AbiFilingValidationError,
  assertValidAbiFiling,
  type EnvelopeHeaderOptions,
} from "@/lib/abi/entrySummary/fromCustomsFiling";
export { AbiFilingValidationError };
import type {
  HeaderInput,
  PrincipalInput,
  CoPrincipalInput,
  SuretyInput,
  CoSuretyInput,
  ReinsurerInput,
} from "./types";

export type ValidBondPartyRole = "PRINCIPAL" | "CO_PRINCIPAL" | "SURETY" | "CO_SURETY" | "REINSURER";

export const VALID_BOND_PARTY_ROLES: ReadonlySet<string> = new Set([
  "PRINCIPAL",
  "CO_PRINCIPAL",
  "SURETY",
  "CO_SURETY",
  "REINSURER",
]);

export type BondWithParties = {
  id: string;
  accountId: string;
  bondType: string;
  suretyName: string;
  suretyCode?: string | null;
  bondNumber: string;
  bondAmount: Decimal | number;
  activityCode?: string | null;
  effectiveDate?: Date | null;
  expirationDate?: Date | null;
  status: string;
  bondParties?: {
    id: string;
    role: string;
    idNumberType?: string | null;
    idNumber?: string | null;
    name?: string | null;
    liabilityAmount?: Decimal | number | null;
    agentIdNumber?: string | null;
  }[];
};

export interface BondFilingOptions extends EnvelopeHeaderOptions {
  bondDesignationTypeCode?: "B" | "A" | "V" | "C" | "U" | "E" | "T" | "R";
  executionDate?: Date;
  suretyReferenceNumber?: string;
}

/**
 * Validates a Bond model and its BondParty records for eBond transmission.
 * Every field the wire-format types require is checked here so the builder
 * below never has to invent a surety code, agent ID, or effective date.
 */
export function validateBond(
  bond: BondWithParties,
  _options?: Partial<BondFilingOptions>
): { valid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];

  if (!bond.bondType) {
    missingFields.push("bond.bondType");
  }
  if (!bond.effectiveDate) {
    missingFields.push("bond.effectiveDate");
  }

  const parties = bond.bondParties || [];
  const principal = parties.find((p) => p.role.toUpperCase() === "PRINCIPAL");
  if (!principal) {
    missingFields.push("bondParties (requires at least one party with role 'PRINCIPAL')");
  } else if (!principal.idNumber) {
    missingFields.push("bondParties[PRINCIPAL].idNumber");
  }
  // Every eBond SuretyInput requires a real agentIdNumber (types.ts has no
  // optional form); Bond itself carries no agent-id field, so at least one
  // SURETY-role BondParty row is the only valid source. No synthesized row.
  if (!parties.some((p) => p.role.toUpperCase() === "SURETY")) {
    missingFields.push("bondParties (requires at least one party with role 'SURETY')");
  }

  // Validate all party roles against the allowed set
  parties.forEach((p, idx) => {
    const roleUpper = p.role.toUpperCase();
    if (!VALID_BOND_PARTY_ROLES.has(roleUpper)) {
      missingFields.push(`bondParties[${idx}].role (invalid role '${p.role}', expected one of ${Array.from(VALID_BOND_PARTY_ROLES).join(", ")})`);
      return;
    }
    if (roleUpper === "SURETY" || roleUpper === "CO_SURETY" || roleUpper === "REINSURER") {
      if (!bond.suretyCode) {
        missingFields.push(`bond.suretyCode (required for bondParties[${idx}] with role '${roleUpper}')`);
      }
      if (!p.agentIdNumber && !p.idNumber) {
        missingFields.push(`bondParties[${idx}].agentIdNumber (or idNumber)`);
      }
      if (roleUpper === "SURETY" && !p.name && !bond.suretyName) {
        missingFields.push(`bondParties[${idx}].name (or bond.suretyName)`);
      }
    }
  });

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Normalizes ID number type ("EIN" -> "1", "SSN" -> "2", "CBP" -> "3", or direct "1"/"2"/"3").
 */
function normalizeIdType(typeStr?: string | null): "1" | "2" | "3" {
  if (!typeStr) return "1";
  const trimmed = typeStr.trim().toUpperCase();
  if (trimmed === "2" || trimmed === "SSN") return "2";
  if (trimmed === "3" || trimmed === "CBP" || trimmed === "CBP_ASSIGNED") return "3";
  return "1";
}

/**
 * Converts a database Bond record (and its loaded BondParty relations) into eBond wire-format transaction inputs.
 */
export function fromBond(
  bond: BondWithParties,
  options?: Partial<BondFilingOptions>
): {
  header: HeaderInput;
  principal: PrincipalInput;
  coPrincipals: CoPrincipalInput[];
  sureties: SuretyInput[];
  coSureties: CoSuretyInput[];
  reinsurers: ReinsurerInput[];
} {
  assertValidAbiFiling(bond.id, validateBond(bond, options));

  const isStb = bond.bondType.toLowerCase().includes("single");
  const header: HeaderInput = {
    bondDesignationTypeCode: options?.bondDesignationTypeCode || (isStb ? "A" : "B"),
    bondTypeCode: isStb ? "9" : "8",
    bondActivityCode: (bond.activityCode || "1").slice(0, 2),
    bondAmount: new Decimal(bond.bondAmount),
    effectiveDate: bond.effectiveDate!,
    terminationDate: bond.expirationDate ?? undefined,
    bondNumber: bond.bondNumber,
    executionDate: options?.executionDate ?? undefined,
    suretyReferenceNumber: options?.suretyReferenceNumber ?? undefined,
  };

  const parties = bond.bondParties || [];

  // Group parties by role after upper-casing
  const principalRow = parties.find((p) => p.role.toUpperCase() === "PRINCIPAL")!;
  const coPrincipalRows = parties.filter((p) => p.role.toUpperCase() === "CO_PRINCIPAL");
  const suretyRows = parties.filter((p) => p.role.toUpperCase() === "SURETY");
  const coSuretyRows = parties.filter((p) => p.role.toUpperCase() === "CO_SURETY");
  const reinsurerRows = parties.filter((p) => p.role.toUpperCase() === "REINSURER");

  const principal: PrincipalInput = {
    principalIdNumberType: normalizeIdType(principalRow.idNumberType),
    principalIdNumber: principalRow.idNumber!.replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
    principalName: principalRow.name?.toUpperCase() ?? undefined,
  };

  const coPrincipals: CoPrincipalInput[] = coPrincipalRows.map((p) => ({
    coPrincipalIdNumberType: normalizeIdType(p.idNumberType),
    coPrincipalIdNumber: (p.idNumber || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
    coPrincipalName: p.name?.toUpperCase() ?? undefined,
  }));

  // suretyCode/agentIdNumber presence for SURETY/CO_SURETY/REINSURER rows is
  // validated above — never fabricated here.
  const sureties: SuretyInput[] = suretyRows.map((p) => ({
    suretyCode: bond.suretyCode!.slice(0, 3),
    agentIdNumber: (p.agentIdNumber || p.idNumber)!.replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
    suretyName: (p.name || bond.suretyName).toUpperCase(),
    suretyLiabilityAmount: p.liabilityAmount != null ? new Decimal(p.liabilityAmount) : new Decimal(bond.bondAmount),
  }));

  const coSureties: CoSuretyInput[] = coSuretyRows.map((p) => ({
    coSuretyCode: bond.suretyCode!.slice(0, 3),
    agentIdNumber: (p.agentIdNumber || p.idNumber)!.replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
    coSuretyName: p.name?.toUpperCase() ?? undefined,
    coSuretyLiabilityAmount: p.liabilityAmount != null ? new Decimal(p.liabilityAmount) : new Decimal(bond.bondAmount),
  }));

  const reinsurers: ReinsurerInput[] = reinsurerRows.map((p) => ({
    suretyCodeForReinsurer: bond.suretyCode!.slice(0, 3),
    agentIdNumber: (p.agentIdNumber || p.idNumber)!.replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
    suretyName: p.name?.toUpperCase() ?? undefined,
  }));

  return {
    header,
    principal,
    coPrincipals,
    sureties,
    coSureties,
    reinsurers,
  };
}
