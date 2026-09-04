import { describe, it, expect } from "vitest";
import { Decimal } from "@/lib/tariff/decimal";
import { decodeRecord } from "@/lib/abi/fixedWidth";
import { buildEntryNumber } from "@/lib/abi/entryNumber";
import {
  fromCustomsFiling,
  buildAbiTransmissionForFiling,
  validateCustomsFilingForTransmission,
  resolveSuretyCompanyCode,
  AbiFilingValidationError,
  type CustomsFilingWithRelations,
  type EnvelopeHeaderOptions,
} from "@/lib/abi/entrySummary/fromCustomsFiling";
import {
  HEADER_CONTROL_SPEC,
  HEADER_CONTENT_SPEC,
  BOND_DETAIL_SPEC,
  LINE_ITEM_HEADER_SPEC,
  FTZ_STATUS_SPEC,
  TARIFF_DETAIL_SPEC,
  FTZ_PRIVILEGED_STATUS_DETAIL_SPEC,
  ADCVD_CASE_DETAIL_SPEC,
  INVOICE_LINE_REFERENCE_SPEC,
  LINE_ENTITY_SPEC,
  CENSUS_WARNING_OVERRIDE_SPEC,
  FEE_TOTAL_SPEC,
  GRAND_TOTALS_SPEC,
} from "@/lib/abi/entrySummary/recordSpecs";
import {
  A_INPUT_SPEC,
  B_INPUT_SPEC,
  Y_INPUT_SPEC,
  Z_INPUT_SPEC,
} from "@/lib/abi/batchBlockControl/recordSpecs";

describe("fromCustomsFiling & buildAbiTransmissionForFiling integration", () => {
  const sampleFilerCode = "N01";
  const sampleTxNumber = "5000003";
  const validEntryNumber = buildEntryNumber(sampleFilerCode, sampleTxNumber);

  const fixture: CustomsFilingWithRelations = {
    id: "filing-7501-integration-test",
    entryNumber: `${sampleFilerCode}-${validEntryNumber}`,
    entryType: "01",
    actionCode: "A",
    brokerReferenceNumber: "BRK-2026",
    bondWaiverIndicator: undefined,
    liveEntryIndicator: "Y",
    consolidatedSummaryIndicator: "Y",
    paymentTypeCode: "1",
    pgaDataIncludedIndicator: "Y",
    foreignTradeZoneIdentifier: "001FTZ01",
    usStateOfDestinationCode: "CA",
    estimatedEntryDate: new Date("2026-08-25T00:00:00Z"),
    dateOfImportation: new Date("2026-08-24T00:00:00Z"),
    designatedNotifyPartyNumber: "NOTIFY-99",
    grandTotalDutyAmount: new Decimal("150.00"),
    grandTotalUserFeeAmount: new Decimal("31.67"),
    grandTotalIrTaxAmount: new Decimal("0.00"),
    grandTotalAdDutyAmount: new Decimal("262.50"),
    grandTotalCvDutyAmount: new Decimal("0.00"),
    grandTotalOtherRevenueAmount: new Decimal("0.00"),
    importerOfRecord: {
      cbpImporterNumber: "123456789012",
      irsEin: "12-3456789",
      name: "ACME Imports LLC",
    },
    bond: {
      bondType: "continuous",
      suretyName: "Travelers Casualty and Surety Company", // Official Treasury surety code 001
      bondNumber: "BOND-123456",
      bondAmount: new Decimal("50000.00"),
    },
    shipment: {
      portOfEntry: "2704",
      entryType: "01",
      transportMode: "11",
      countryOfExport: "CN",
      ladingDate: new Date("2026-08-10T00:00:00Z"),
      lineItems: [
        {
          id: "line-1",
          lineNumber: 1,
          partNumber: "VALVE-SS-01",
          description: "Stainless Steel Valves 1/2 NPT",
          quantity: 100,
          unitPrice: new Decimal("25.00"),
          totalValue: new Decimal("2500.00"),
          countryOfOrigin: "CN",
          htsCode: "8481.80.5090",
          totalDuties: new Decimal("150.00"),
          ftzDetails: [
            {
              ftzAdmissionNumber: "FTZ-ADM-01",
              zoneId: "001",
              privilegedStatusDate: new Date("2026-08-01T00:00:00Z"),
              merchandiseStatusCode: "P",
              lineItemQuantity: new Decimal("100"),
              currentHtsNumber: "8481.80.5090",
            },
          ],
          adcvdLineDetails: [
            {
              caseDepositRate: new Decimal("10.50"),
              rateTypeQualifierCode: "A",
              bondCashClaimCode: "C",
              valueOfGoodsAmount: new Decimal("2500.00"),
              nonReimbursementDeclarationIdentifier: "NONREIMB1",
              adcvdOrder: {
                caseNumber: "A570888",
              },
            },
          ],
          shipmentParties: [
            {
              role: "MANUFACTURER",
              partyTypeCode: "MF",
              legalEntity: {
                legalName: "Shenzhen Valve Manufacturing Ltd",
                taxIdentifier: "123456789",
                taxIdentifierType: "EI",
              },
            },
          ],
        },
      ],
    },
    censusWarningOverrides: [
      {
        sequence: 1,
        conditionCode: "027",
        overrideCode: "51",
      },
    ],
    filingFeeLines: [
      {
        accountingClassCode: "499",
        amount: new Decimal("31.67"),
        sequence: 1,
      },
    ],
    invoiceLines: [
      {
        supplierIdCode: "MIDSEN12345",
        lineRange1Begin: 1,
        lineRange1End: 1,
        invoice: {
          invoiceNumber: "INV-2026-001",
        },
      },
    ],
  };

  const envelopeHeader: EnvelopeHeaderOptions = {
    senderReceiverSiteCode: "S123",
    senderReceiverIdCode: "R45",
    communicationPassword: "PASS12",
    processingFilerCode: "N01",
    processingDistrictPortCode: "2704",
    applicationIdentifierCode: "AE",
  };

  it("resolves Treasury surety company codes correctly from surety names and explicit codes", () => {
    expect(resolveSuretyCompanyCode({ suretyName: "Travelers Casualty and Surety Company" })).toBe("001");
    expect(resolveSuretyCompanyCode({ suretyName: "Great American Insurance Company" })).toBe("329");
    expect(resolveSuretyCompanyCode({ suretyName: "International Fidelity Insurance Company" })).toBe("421");
    expect(resolveSuretyCompanyCode({ suretyName: "American Contractors Indemnity Company" })).toBe("300");
    expect(resolveSuretyCompanyCode({ suretyName: "Roanoke Insurance Group" })).toBeUndefined(); // Non-underwriting broker, unmapped
    expect(resolveSuretyCompanyCode({ suretyName: "Avondale Insurance Agency" })).toBeUndefined(); // Non-underwriting broker, unmapped
    expect(resolveSuretyCompanyCode({ suretyCode: "052" })).toBe("052"); // Aspen American / direct Treasury code
    expect(resolveSuretyCompanyCode({ suretyName: "Unknown Insurance Co" })).toBeUndefined();
  });

  it("maps CustomsFiling to EntrySummaryTransactionInput correctly", () => {
    const input = fromCustomsFiling(fixture, envelopeHeader);

    expect(input.headerControl.entryFilerCode).toBe("N01");
    expect(input.headerControl.entryNumber).toBe(validEntryNumber);
    expect(input.headerControl.districtPortOfEntry).toBe("2704");
    expect(input.headerControl.summaryFilingActionRequestCode).toBe("A");
    expect(input.headerControl.brokerReferenceNumber).toBe("BRK-2026");

    expect(input.headerContent?.importerOfRecordNumber).toBe("123456789012");
    expect(input.headerContent?.foreignTradeZoneIdentifier).toBe("001FTZ01");
    expect(input.headerContent?.usStateOfDestinationCode).toBe("CA");

    expect(input.bonds).toHaveLength(1);
    expect(input.bonds?.[0].bondTypeCode).toBe("8");
    expect(input.bonds?.[0].suretyCompanyCode).toBe("001"); // Travelers -> 001

    expect(input.lineItems).toHaveLength(1);
    const line = input.lineItems[0];
    expect(line.header.lineItemIdentifier).toBe("001");
    expect(line.header.countryOfOriginCode).toBe("CN");

    expect(line.ftzStatus?.ftzMerchandiseStatusCode).toBe("P");
    expect(line.ftzStatus?.ftzLineItemQuantity.toNumber()).toBe(100);

    expect(line.tariffDetails).toHaveLength(1);
    expect(line.tariffDetails[0].htsNumber).toBe("8481805090");
    expect(line.tariffDetails[0].valueOfGoodsAmount.toNumber()).toBe(2500);
    expect(line.tariffDetails[0].ftzPrivilegedStatusDetail?.currentHtsNumber).toBe(
      "8481805090"
    );

    expect(line.adcvdCases).toHaveLength(1);
    expect(line.adcvdCases?.[0].caseNumber).toBe("A570888");
    expect(line.adcvdCases?.[0].caseDepositRate.toNumber()).toBe(10.5);

    expect(line.censusWarningOverride?.conditionCode1).toBe("027");
    expect(line.censusWarningOverride?.overrideCode1).toBe("51");

    expect(line.invoices).toHaveLength(1);
    expect(line.invoices?.[0].supplierIdCode).toBe("MIDSEN12345");
    expect(line.invoices?.[0].invoiceNumber).toBe("INV-2026-001");

    expect(line.entities).toHaveLength(1);
    expect((line.entities?.[0] as any).entityCode).toBe("MF");

    expect(input.feeTotals).toHaveLength(1);
    expect(input.feeTotals?.[0].accountingClassCode).toBe("499");
    expect(input.feeTotals?.[0].totalFeeAmount.toNumber()).toBe(31.67);

    expect(input.grandTotals?.grandTotalDutyAmount?.toNumber()).toBe(150);
    expect(input.grandTotals?.grandTotalUserFeeAmount?.toNumber()).toBe(31.67);
  });

  it("builds raw transmission lines and decodes each record to verify field-by-field accuracy", () => {
    const lines = buildAbiTransmissionForFiling(fixture, envelopeHeader);

    // Assert every record in the output batch is exactly 80 characters long
    lines.forEach((line, i) => {
      expect(line, `Line ${i} (${line.slice(0, 4)})`).toHaveLength(80);
    });

    // 1. Batch Header (A-Record)
    const aRecord = decodeRecord(A_INPUT_SPEC, lines[0]);
    expect(aRecord.senderReceiverSiteCode).toBe("S123");
    expect(aRecord.senderReceiverIdCode).toBe("R45");
    expect(aRecord.communicationPassword).toBe("PASS12");
    expect(aRecord.applicationIdentifierCode).toBe("AE");

    // 2. Block Header (B-Record)
    const bRecord = decodeRecord(B_INPUT_SPEC, lines[1]);
    expect(bRecord.processingFilerCode).toBe("N01");
    expect(bRecord.processingDistrictPortCode).toBe("2704");
    expect(bRecord.applicationIdentifierCode).toBe("AE");

    // 3. 10-Record (Header Control)
    const rec10 = decodeRecord(HEADER_CONTROL_SPEC, lines[2]);
    expect(rec10.summaryFilingActionRequestCode).toBe("A");
    expect(rec10.entryFilerCode).toBe("N01");
    expect(rec10.entryNumber).toBe(validEntryNumber);
    expect(rec10.districtPortOfEntry).toBe("2704");
    expect(rec10.brokerReferenceNumber).toBe("BRK-2026");
    expect(rec10.entryTypeCode).toBe("01");

    // 4. 11-Record (Header Content)
    const rec11 = decodeRecord(HEADER_CONTENT_SPEC, lines[3]);
    expect(rec11.importerOfRecordNumber).toBe("123456789012");
    expect(rec11.usStateOfDestinationCode).toBe("CA");
    expect(rec11.foreignTradeZoneIdentifier).toBe("001FTZ01");

    // 5. 31-Record (Bond Detail)
    const rec31 = decodeRecord(BOND_DETAIL_SPEC, lines[4]);
    expect(rec31.bondTypeCode).toBe("8");
    expect(rec31.bondDesignationTypeCode).toBe("B");
    expect(rec31.suretyCompanyCode).toBe("001"); // Travelers -> 001 Treasury Code

    // 6. 40-Record (Line Item Header)
    const rec40 = decodeRecord(LINE_ITEM_HEADER_SPEC, lines[5]);
    expect(rec40.lineItemIdentifier).toBe("001");
    expect(rec40.countryOfOriginCode).toBe("CN");
    expect(rec40.countryOfExportCode).toBe("CN");

    // 7. 41-Record (FTZ Status)
    const rec41 = decodeRecord(FTZ_STATUS_SPEC, lines[6]);
    expect(rec41.ftzMerchandiseStatusCode).toBe("P");
    expect(rec41.ftzLineItemQuantity.toNumber()).toBe(100);

    // 8. 42-Record (Invoice Line Reference)
    const rec42 = decodeRecord(INVOICE_LINE_REFERENCE_SPEC, lines[7]);
    expect(rec42.supplierIdCode).toBe("MIDSEN12345");
    expect(rec42.invoiceNumber).toBe("INV-2026-001");
    expect(rec42.invoiceLineRange1Begin).toBe(1);
    expect(rec42.invoiceLineRange1End).toBe(1);

    // 9. SE50-Record (Line Entity Name & Type)
    const recSE50 = decodeRecord(LINE_ENTITY_SPEC, lines[8]);
    expect(recSE50.entityCode).toBe("MF");
    expect(recSE50.entityName).toBe("SHENZHEN VALVE MANUFACTURING LTD");

    // 10. 50-Record (Tariff/Value/Quantity Detail)
    const rec50 = decodeRecord(TARIFF_DETAIL_SPEC, lines[9]);
    expect(rec50.htsNumber).toBe("8481805090");
    expect(rec50.dutyAmount.toNumber()).toBe(150);
    expect(rec50.valueOfGoodsAmount.toNumber()).toBe(2500);
    expect(rec50.quantity1?.toNumber()).toBe(100);
    expect(rec50.unitOfMeasureCode1).toBe("PCS");

    // 11. SE61-Record (FTZ Privileged Foreign Status Additional Detail)
    const recSE61 = decodeRecord(FTZ_PRIVILEGED_STATUS_DETAIL_SPEC, lines[10]);
    expect(recSE61.currentHtsNumber).toBe("8481805090");

    // 12. 53-Record (AD/CVD Case Detail)
    const rec53 = decodeRecord(ADCVD_CASE_DETAIL_SPEC, lines[11]);
    expect(rec53.caseNumber).toBe("A570888");
    expect(rec53.bondCashClaimCode).toBe("C");
    expect(rec53.caseDepositRate.toNumber()).toBe(10.5);
    expect(rec53.caseRateTypeQualifierCode).toBe("A");
    expect(rec53.valueOfGoodsAmount?.toNumber()).toBe(2500);
    expect(rec53.dutyAmount.toNumber()).toBe(262.5);
    expect(rec53.nonReimbursementDeclarationIdentifier).toBe("NONREIMB1");

    // 13. CW02-Record (Census Warning Condition Override)
    const recCW02 = decodeRecord(CENSUS_WARNING_OVERRIDE_SPEC, lines[12]);
    expect(recCW02.conditionCode1).toBe("027");
    expect(recCW02.overrideCode1).toBe("51");

    // 14. 89-Record (Fee Total)
    const rec89 = decodeRecord(FEE_TOTAL_SPEC, lines[13]);
    expect(rec89.accountingClassCode1).toBe("499");
    expect(rec89.totalFeeAmount1.toNumber()).toBe(31.67);

    // 15. 90-Record (Grand Totals)
    const rec90 = decodeRecord(GRAND_TOTALS_SPEC, lines[14]);
    expect(rec90.grandTotalDutyAmount?.toNumber()).toBe(150);
    expect(rec90.grandTotalUserFeeAmount?.toNumber()).toBe(31.67);
    expect(rec90.grandTotalAdDutyAmount?.toNumber()).toBe(262.5);

    // 16. Block Trailer (Y-Record)
    const yRecord = decodeRecord(Y_INPUT_SPEC, lines[15]);
    expect(yRecord.processingFilerCode).toBe("N01");
    expect(yRecord.processingDistrictPortCode).toBe("2704");

    // 17. Batch Trailer (Z-Record)
    const zRecord = decodeRecord(Z_INPUT_SPEC, lines[16]);
    expect(zRecord.senderReceiverSiteCode).toBe("S123");
    expect(zRecord.senderReceiverIdCode).toBe("R45");
  });

  describe("Validation & Error handling (Zero Fabrication)", () => {
    it("throws AbiFilingValidationError when importerOfRecord is missing for 11-Record header content", () => {
      const invalidFixture: CustomsFilingWithRelations = {
        ...fixture,
        importerOfRecord: null,
      };

      const val = validateCustomsFilingForTransmission(invalidFixture, envelopeHeader);
      expect(val.valid).toBe(false);
      expect(val.missingFields).toContain(
        "headerContent.importerOfRecordNumber (requires importerOfRecord.cbpImporterNumber or irsEin)"
      );

      expect(() => fromCustomsFiling(invalidFixture, envelopeHeader)).toThrow(
        AbiFilingValidationError
      );
    });

    it("throws AbiFilingValidationError when bond surety code cannot be resolved", () => {
      const invalidFixture: CustomsFilingWithRelations = {
        ...fixture,
        bond: {
          bondType: "continuous",
          suretyName: "Unknown Nonexistent Surety Co", // Cannot resolve 3-digit Treasury code
        },
      };

      const val = validateCustomsFilingForTransmission(invalidFixture, envelopeHeader);
      expect(val.valid).toBe(false);
      expect(val.missingFields).toContain(
        "bond.suretyCompanyCode (requires 3-digit Treasury surety code on bond, got 'Unknown Nonexistent Surety Co')"
      );

      expect(() => fromCustomsFiling(invalidFixture, envelopeHeader)).toThrow(
        AbiFilingValidationError
      );
    });

    it("throws AbiFilingValidationError when AD/CVD caseNumber is missing from adcvdOrder", () => {
      const invalidFixture: CustomsFilingWithRelations = {
        ...fixture,
        shipment: {
          ...fixture.shipment!,
          lineItems: [
            {
              ...fixture.shipment!.lineItems![0],
              adcvdLineDetails: [
                {
                  caseDepositRate: new Decimal("10.50"),
                  adcvdOrder: null, // missing caseNumber!
                  adcvdOrderId: "cuid1234567890", // raw cuid, MUST NOT be used as case number
                },
              ],
            },
          ],
        },
      };

      const val = validateCustomsFilingForTransmission(invalidFixture, envelopeHeader);
      expect(val.valid).toBe(false);
      expect(val.missingFields).toContain(
        "shipment.lineItems[0].adcvdLineDetails[0].adcvdOrder.caseNumber (requires valid A-nnn-nnn case number)"
      );

      expect(() => fromCustomsFiling(invalidFixture, envelopeHeader)).toThrow(
        AbiFilingValidationError
      );
    });

    it("throws AbiFilingValidationError when invoiceLines is missing supplierIdCode or invoiceNumber", () => {
      const invalidFixture: CustomsFilingWithRelations = {
        ...fixture,
        invoiceLines: [
          {
            supplierIdCode: undefined, // missing supplier MID!
            invoice: null,
          },
        ],
      };

      const val = validateCustomsFilingForTransmission(invalidFixture, envelopeHeader);
      expect(val.valid).toBe(false);
      expect(val.missingFields).toContain("invoiceLines[0].supplierIdCode");
      expect(val.missingFields).toContain("invoiceLines[0].invoiceNumber");

      expect(() => fromCustomsFiling(invalidFixture, envelopeHeader)).toThrow(
        AbiFilingValidationError
      );
    });

    it("throws AbiFilingValidationError when entryFilerCode or districtPortOfEntry are missing", () => {
      const invalidFixture: CustomsFilingWithRelations = {
        ...fixture,
        entryNumber: "12345678", // no 3-char filer code prefix!
        shipment: {
          ...fixture.shipment!,
          portOfEntry: undefined,
        },
      };

      // Also don't pass options
      const val = validateCustomsFilingForTransmission(invalidFixture, {});
      expect(val.valid).toBe(false);
      expect(val.missingFields).toContain(
        "headerControl.entryFilerCode (requires 3-char entryNumber prefix or options.processingFilerCode)"
      );
      expect(val.missingFields).toContain(
        "headerControl.districtPortOfEntry (requires shipment.portOfEntry or options.processingDistrictPortCode)"
      );

      expect(() => fromCustomsFiling(invalidFixture, {})).toThrow(
        AbiFilingValidationError
      );
    });
  });
});
