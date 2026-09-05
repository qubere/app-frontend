import { describe, it, expect } from "vitest";
import { Decimal } from "@/lib/tariff/decimal";
import {
  fromDrawbackClaim,
  validateDrawbackClaim,
  AbiFilingValidationError,
  type DrawbackClaimWithRelations,
} from "@/lib/abi/drawback";

describe("fromDrawbackClaim DB integration", () => {
  const validClaim: DrawbackClaimWithRelations = {
    id: "dbk-123",
    accountId: "acct-999",
    claimType: "unused_merchandise",
    status: "Draft",
    totalRefundClaimed: new Decimal(5000.5),
    cbpClaimNumber: "DBK-2026-00112233",
    naftaDrawbackClaimIndicator: true,
    usmcaDrawbackClaimIndicator: false,
    oneTimeWaiverIndicator: true,
    bondWaiverIndicator: false,
    electronicPetroleumCertification: true,
    oilSpillTaxCertification: false,
    superfundTaxCertification: true,
    billOfMaterialsFormulaCertification: true,
    retailSalesSubstitutionIndicator: false,
    designatedNotifyPartyNumber: "NOTIFY-12345",
    brokerReferenceNumber: "BROKER-777",
    acceleratedPaymentRequestIndicator: true,
    bond: {
      bondType: "continuous",
      suretyCode: "037",
      bondNumber: "BOND-8888",
      bondAmount: 50000,
    },
    importLinks: [
      { id: "link-1", importTrackingIdNumber: "00001", sequence: 1 },
      { id: "link-2", importTrackingIdNumber: "00002", sequence: 2 },
    ],
    exportDestroys: [
      {
        id: "exp-1",
        noticeOfIntentIndicator: true,
        waiverToDrawbackClaimRightsIndicator: false,
        countryOfUltimateDestination: "CA",
        billOfLadingIndicator: "Y",
        billOfLadingCarrierCode: "MAEU",
        examinerName: "JOHN DOE",
        processingExaminationDate: new Date("2026-06-15T00:00:00Z"),
      },
    ],
    tfteaLines: [
      {
        id: "tf-1",
        htsNumber: "8471300100",
        exportOrDestroyIndicator: "E",
        quantity: 100,
        unitOfMeasureCode: "PCS",
        date: new Date("2026-06-20T00:00:00Z"),
        noticeOfIntentIndicator: true,
        exporterOrDestroyerName: "GLOBAL TRADING CORP",
        countryOfUltimateDestination: "MX",
        scheduleBCode: "8471300000",
      },
    ],
    naftaUsmcaLines: [
      {
        id: "nu-1",
        entryNumber: "CAN-998877",
        entryDate: new Date("2026-05-10T00:00:00Z"),
        dutyPaidToForeignGovtLocalCurrency: 1200.5,
        exchangeRate: 1.35,
        tariffNumber1: "8471300000",
        countryOfExport: "CA",
      },
    ],
  };

  const defaultOptions = {
    drawbackFilingPort: "3501",
    claimantIdOrImporterRecordNumber: "12-345678900",
    processingFilerCode: "123",
  };

  it("validates and converts a complete DrawbackClaim record to wire-format inputs", () => {
    const result = fromDrawbackClaim(validClaim, defaultOptions);

    expect(result.header.entryFilerCode).toBe("123");
    expect(result.header.entryNumberOrDrawbackClaimNumber).toBe("DBK20260");
    expect(result.header.drawbackFilingPort).toBe("3501");
    expect(result.header.naftaDrawbackClaimIndicator).toBe("Y");
    expect(result.header.usmcaDrawbackClaimIndicator).toBe("N");
    expect(result.header.acceleratedPaymentRequestIndicator).toBe("Y");
    expect(result.header.superfundTaxCertification).toBe("Y");

    expect(result.bondInfo).toBeDefined();
    expect(result.bondInfo?.bondTypeCode).toBe("8");
    expect(result.bondInfo?.suretyCompanyCode).toBe("037");

    expect(result.importLinks).toHaveLength(1);
    expect(result.importLinks[0].importTrackingIdNumber1).toBe("00001");
    expect(result.importLinks[0].importTrackingIdNumber2).toBe("00002");

    expect(result.exportDestroys).toHaveLength(1);
    expect(result.exportDestroys[0].nameOfExporterOrDestroyer).toBe("JOHN DOE");
    expect(result.exportDestroys[0].countryOfUltimateDestination).toBe("CA");

    expect(result.tfteaExportDestroys).toHaveLength(1);
    expect(result.tfteaExportDestroys[0].htsNumber).toBe("8471300100");
    expect(result.tfteaExportDestroys[0].scheduleBCode).toBe("8471300000");

    expect(result.naftaUsmcaLines).toHaveLength(1);
    expect(result.naftaUsmcaLines[0].countryOfExport).toBe("CA");
  });

  it("throws AbiFilingValidationError if required fields are missing", () => {
    const invalidClaim: DrawbackClaimWithRelations = {
      ...validClaim,
      cbpClaimNumber: null,
    };

    const validation = validateDrawbackClaim(invalidClaim, {});
    expect(validation.valid).toBe(false);
    expect(validation.missingFields.length).toBeGreaterThan(0);

    expect(() => fromDrawbackClaim(invalidClaim, {})).toThrow(AbiFilingValidationError);
  });
});
