import { describe, it, expect } from "vitest";
import { Decimal } from "@/lib/tariff/decimal";
import {
  fromBond,
  validateBond,
  AbiFilingValidationError,
  type BondWithParties,
} from "@/lib/abi/ebond";

describe("fromBond DB integration", () => {
  const validBond: BondWithParties = {
    id: "bond-101",
    accountId: "acct-100",
    bondType: "continuous",
    suretyName: "ROANOKE INSURANCE GROUP",
    suretyCode: "037",
    bondNumber: "BOND-998877",
    bondAmount: new Decimal(50000),
    activityCode: "1",
    effectiveDate: new Date("2026-01-01T00:00:00Z"),
    status: "verified",
    bondParties: [
      {
        id: "bp-1",
        role: "PRINCIPAL",
        idNumberType: "EIN",
        idNumber: "12-3456789",
        name: "ACME LOGISTICS INC",
      },
      {
        id: "bp-2",
        role: "CO_PRINCIPAL",
        idNumberType: "EIN",
        idNumber: "98-7654321",
        name: "BETA SUPPLY LLC",
      },
      {
        id: "bp-3",
        role: "SURETY",
        idNumberType: "CBP",
        idNumber: "SURETY-001",
        name: "ROANOKE INSURANCE GROUP",
        liabilityAmount: 50000,
        agentIdNumber: "AGT-101",
      },
      {
        id: "bp-4",
        role: "CO_SURETY",
        idNumberType: "CBP",
        idNumber: "SURETY-002",
        name: "ALLIANZ SURETY INC",
        liabilityAmount: 25000,
        agentIdNumber: "AGT-102",
      },
      {
        id: "bp-5",
        role: "REINSURER",
        idNumberType: "CBP",
        idNumber: "RE-001",
        name: "SWISS REINSURANCE",
        agentIdNumber: "AGT-103",
      },
    ],
  };

  it("converts a Bond model with multiple BondParties to eBond inputs", () => {
    const result = fromBond(validBond);

    expect(result.header.bondTypeCode).toBe("8");
    expect(result.header.bondNumber).toBe("BOND-998877");
    expect(result.header.bondActivityCode).toBe("1");
    expect(result.header.bondAmount).toEqual(new Decimal(50000));

    expect(result.principal.principalIdNumberType).toBe("1");
    expect(result.principal.principalIdNumber).toBe("123456789");
    expect(result.principal.principalName).toBe("ACME LOGISTICS INC");

    expect(result.coPrincipals).toHaveLength(1);
    expect(result.coPrincipals[0].coPrincipalIdNumber).toBe("987654321");

    expect(result.sureties).toHaveLength(1);
    expect(result.sureties[0].suretyCode).toBe("037");

    expect(result.coSureties).toHaveLength(1);
    expect(result.coSureties[0].coSuretyName).toBe("ALLIANZ SURETY INC");

    expect(result.reinsurers).toHaveLength(1);
    expect(result.reinsurers[0].suretyName).toBe("SWISS REINSURANCE");
  });

  it("throws validation error if no PRINCIPAL party exists", () => {
    const invalidBond: BondWithParties = {
      ...validBond,
      bondParties: [],
    };

    const validation = validateBond(invalidBond);
    expect(validation.valid).toBe(false);
    expect(validation.missingFields).toContain("bondParties (requires at least one party with role 'PRINCIPAL')");

    expect(() => fromBond(invalidBond)).toThrow(AbiFilingValidationError);
  });

  it("throws validation error if an invalid role string is present on a BondParty", () => {
    const invalidRoleBond: BondWithParties = {
      ...validBond,
      bondParties: [
        {
          id: "bp-1",
          role: "PRINCIPAL",
          idNumber: "123456789",
        },
        {
          id: "bp-bad",
          role: "INVALID_ROLE_STRING",
          idNumber: "123",
        },
      ],
    };

    const validation = validateBond(invalidRoleBond);
    expect(validation.valid).toBe(false);
    expect(validation.missingFields.some((f) => f.includes("invalid role 'INVALID_ROLE_STRING'"))).toBe(true);
  });
});

