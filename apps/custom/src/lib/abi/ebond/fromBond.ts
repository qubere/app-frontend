import { Decimal } from "@/lib/tariff/decimal";
import { AbiFilingValidationError, type EnvelopeHeaderOptions } from "@/lib/abi/entrySummary/fromCustomsFiling";
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
 */
export function validateBond(
  bond: BondWithParties,
  _options?: Partial<BondFilingOptions>
): { valid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];

  if (!bond.bondType) {
    missingFields.push("bond.bondType");
  }

  const parties = bond.bondParties || [];
  const principal = parties.find((p) => p.role.toUpperCase() === "PRINCIPAL");
  if (!principal) {
    missingFields.push("bondParties (requires at least one party with role 'PRINCIPAL')");
  } else {
    if (!principal.idNumber) {
      missingFields.push("bondParties[PRINCIPAL].idNumber");
    }
  }

  // Validate all party roles against the allowed set
  parties.forEach((p, idx) => {
    const roleUpper = p.role.toUpperCase();
    if (!VALID_BOND_PARTY_ROLES.has(roleUpper)) {
      missingFields.push(`bondParties[${idx}].role (invalid role '${p.role}', expected one of ${Array.from(VALID_BOND_PARTY_ROLES).join(", ")})`);
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
  const validation = validateBond(bond, options);
  if (!validation.valid) {
    throw new AbiFilingValidationError(bond.id, validation.missingFields);
  }

  const isStb = bond.bondType.toLowerCase().includes("single");
  const header: HeaderInput = {
    bondDesignationTypeCode: options?.bondDesignationTypeCode || (isStb ? "A" : "B"),
    bondTypeCode: isStb ? "9" : "8",
    bondActivityCode: (bond.activityCode || "1").slice(0, 2),
    bondAmount: new Decimal(bond.bondAmount),
    effectiveDate: bond.effectiveDate || new Date(),
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
    principalIdNumber: (principalRow.idNumber || "000000000").replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
    principalName: principalRow.name?.toUpperCase() ?? undefined,
  };

  const coPrincipals: CoPrincipalInput[] = coPrincipalRows.map((p) => ({
    coPrincipalIdNumberType: normalizeIdType(p.idNumberType),
    coPrincipalIdNumber: (p.idNumber || "000000000").replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
    coPrincipalName: p.name?.toUpperCase() ?? undefined,
  }));

  let sureties: SuretyInput[] = suretyRows.map((p) => ({
    suretyCode: (bond.suretyCode || "000").slice(0, 3),
    agentIdNumber: (p.agentIdNumber || p.idNumber || "000000000").replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
    suretyName: (p.name || bond.suretyName).toUpperCase(),
    suretyLiabilityAmount: p.liabilityAmount ? new Decimal(p.liabilityAmount) : new Decimal(bond.bondAmount),
  }));

  // Fallback to top-level bond surety if no SURETY row was explicitly created
  if (sureties.length === 0 && bond.suretyCode) {
    sureties = [
      {
        suretyCode: bond.suretyCode.slice(0, 3),
        agentIdNumber: "000000000",
        suretyName: bond.suretyName.toUpperCase(),
        suretyLiabilityAmount: new Decimal(bond.bondAmount),
      },
    ];
  }

  const coSureties: CoSuretyInput[] = coSuretyRows.map((p) => ({
    coSuretyCode: (bond.suretyCode || "000").slice(0, 3),
    agentIdNumber: (p.agentIdNumber || p.idNumber || "000000000").replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
    coSuretyName: p.name?.toUpperCase() ?? undefined,
    coSuretyLiabilityAmount: p.liabilityAmount ? new Decimal(p.liabilityAmount) : new Decimal(bond.bondAmount),
  }));

  const reinsurers: ReinsurerInput[] = reinsurerRows.map((p) => ({
    suretyCodeForReinsurer: (bond.suretyCode || "000").slice(0, 3),
    agentIdNumber: (p.agentIdNumber || p.idNumber || "000000000").replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
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
