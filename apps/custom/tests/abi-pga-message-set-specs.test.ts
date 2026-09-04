/**
 * CATAIR Participating Government Agencies (PGA) Message Set (Chapter 8) Scope Note & Record Specification Tests
 * Source PDF: docs/plans/catair-source-docs/08-pga-message-set-2026-07.pdf (July 1, 2026 - Pub # 0875-0419)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CATAIR PGA MESSAGE SET (CHAPTER 8) SCOPE NOTE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Scoped IN (28 Generic / Cross-Agency Backbone Records):
 *   1. Record OI (Input, Mandatory, Page 16): Commercial Line Item Description Record.
 *      [Pos 1-80: 2(OI) + 8(filler) + 70(commercialDescription) = 80]
 *   2. Record PG01 (Input, Mandatory, Pages 17-19): PGA Line Number, Agency & Program Header Record.
 *      [Pos 1-80: 2(PG) + 2(01) + 3(pgaLineNumber) + 3(govtAgencyCode) + 3(govtAgencyProgramCode) + 3(govtAgencyProcessingCode) + 1(electronicImageSubmitted) + 1(confidentialInfoIndicator) + 4(gtinQualifier) + 19(gtinCode) + 16(intendedUseCode) + 21(intendedUseDescription) + 1(correctionIndicator) + 1(disclaimer) = 80]
 *   3. Record PG02 (Input, Conditional, Pages 21-22): Product or Component Identifier Record.
 *      [Pos 1-80: 2(PG) + 2(02) + 1(itemType) + 4(productCodeQualifier1) + 19(productCodeNumber1) + 4(productCodeQualifier2) + 19(productCodeNumber2) + 4(productCodeQualifier3) + 19(productCodeNumber3) + 6(filler) = 80]
 *   4. Record PG04 (Input, Conditional, Page 23): Constituent Active Ingredient / Element Record.
 *      [Pos 1-80: 2(PG) + 2(04) + 1(activeIngredientQualifier) + 51(constituentName) + 12(constituentQuantity) + 5(constituentUom) + 7(constituentPercent) = 80]
 *   5. Record PG06 (Input, Conditional, Pages 26-27): Source / Processing / Origin Record.
 *      [Pos 1-80: 2(PG) + 2(06) + 3(sourceTypeCode) + 2(countryCode) + 20(geographicLocation) + 8(processingStartDate) + 8(processingEndDate) + 5(processingTypeCode) + 30(processingDescription) = 80]
 *   6. Record PG07 (Input, Conditional, Page 28): Trade/Brand Name, Model & Item Identity Header Record.
 *      [Pos 1-80: 2(PG) + 2(07) + 35(tradeBrandName) + 15(model) + 6(manufactureMonthYear) + 3(itemIdentityQualifier) + 17(itemIdentityNumber) = 80]
 *   7. Record PG08 (Input, Conditional, Page 29): Multiple Item Identity Numbers (Serial / VIN overflow) Record.
 *      [Pos 1-80: 2(PG) + 2(08) + 17(itemIdentityNumber1) + 17(itemIdentityNumber2) + 17(itemIdentityNumber3) + 17(itemIdentityNumber4) + 8(filler) = 80]
 *   8. Record PG10 (Input, Conditional, Page 30): Commodity Category & Characteristic Record.
 *      [Pos 1-80: 2(PG) + 2(10) + 6(categoryTypeCode) + 5(categoryCode) + 4(commodityQualifierCode) + 4(commodityCharacteristicQualifier) + 57(commodityCharacteristicDescription) = 80]
 *   9. Record PG13 (Input, Conditional, Page 31): LPCO Issuer & Geographic Location Record.
 *      [Pos 1-80: 2(PG) + 2(13) + 35(issuerOfLpco) + 3(lpcoIssuerGeoQualifier) + 3(locationOfIssuer) + 25(regionalDescription) + 10(filler) = 80]
 *  10. Record PG14 (Input, Conditional, Page 32): LPCO Details & Quantity Record.
 *      [Pos 1-80: 2(PG) + 2(14) + 1(lpcoTransactionType) + 3(lpcoType) + 33(lpcoNumber) + 1(lpcoDateQualifier) + 8(lpcoDate) + 16(lpcoQuantity) + 5(lpcoUom) + 9(exemptionCode) = 80]
 *  11. Record PG18 (Input, Conditional, Page 34): Hazardous Material & Dangerous Goods Record.
 *      [Pos 1-80: 2(PG) + 2(18) + 10(unDangerousGoodsCode) + 4(hazardousClassCode) + 4(epaHazardousWasteCode) + 50(hazardousMaterialDescription) + 1(packagingGroupCode) + 7(filler) = 80]
 *  12. Record PG19 (Input, Conditional, Page 35): Entity Identification Record.
 *      [Pos 1-80: 2(PG) + 2(19) + 3(entityRoleCode) + 3(entityIdCode) + 15(entityNumber) + 32(entityName) + 23(entityAddress1) = 80]
 *  13. Record PG20 (Input, Conditional, Page 36): Entity Address Line 2 & City/State/Zip Record.
 *      [Pos 1-80: 2(PG) + 2(20) + 32(entityAddress2) + 5(entityAptSuiteNumber) + 21(entityCity) + 3(entityStateProvince) + 2(entityCountry) + 9(entityZipPostalCode) + 4(filler) = 80]
 *  14. Record PG21 (Input, Conditional, Page 37): Individual Contact Information Record.
 *      [Pos 1-80: 2(PG) + 2(21) + 3(individualQualifier) + 23(individualName) + 15(telephoneNumber) + 35(emailOrFaxNumber) = 80]
 *  15. Record PG22 (Input, Conditional, Page 38): Importer Declaration / Substantiating Document Record.
 *      [Pos 1-80: 2(PG) + 2(22) + 1(substantiatingDocIndicator) + 7(documentIdentifier) + 5(conformanceDeclaration) + 3(entityRoleCode) + 4(declarationCode) + 1(declarationCertification) + 8(dateOfSignature) + 17(invoiceNumber) + 30(complianceDescription) = 80]
 *  16. Record PG24 (Input, Optional, Page 40): Remarks Record.
 *      [Pos 1-80: 2(PG) + 2(24) + 3(remarksTypeCode) + 5(remarksCode) + 68(remarksText) = 80]
 *  17. Record PG25 (Input, Conditional, Page 41): Temperature, Lot & PGA Values Record.
 *      [Pos 1-80: 2(PG) + 2(25) + 1(temperatureQualifier) + 1(degreeType) + 1(negativeNumber) + 6(actualTemperature) + 1(locationOfTempRecording) + 1(lotNumberQualifier) + 25(lotNumber) + 8(productionStartDate) + 8(productionEndDate) + 12(pgaLineValue) + 12(pgaUnitValue) = 80]
 *  18. Record PG26 (Input, Conditional, Page 42): Packaging Level Breakdown & Quantity Record.
 *      [Pos 1-80: 2(PG) + 2(26) + 1(packagingQualifier) + 12(quantity) + 5(unitOfMeasure) + 25(packageIdentifier) + 3(packagingMethod) + 15(packageMaterial) + 15(packageFiller) = 80]
 *  19. Record PG27 (Input, Conditional, Page 43): Shipping Container Information Record.
 *      [Pos 1-80: 2(PG) + 2(27) + 20(containerNumber1) + 1(typeOfContainer1) + 2(containerLength1) + 20(containerNumber2) + 1(typeOfContainer2) + 2(containerLength2) + 20(containerNumber3) + 1(typeOfContainer3) + 2(containerLength3) + 7(filler) = 80]
 *  20. Record PG29 (Input, Conditional, Pages 45-47): Commodity Quantities & UOM Record.
 *      [Pos 1-80: 2(PG) + 2(29) + 3(uomPgaLineNet) + 12(qtyPgaLineNet) + 3(uomPgaLineGross) + 12(qtyPgaLineGross) + 3(uomIndividualUnitNet) + 12(qtyIndividualUnitNet) + 3(uomIndividualUnitGross) + 12(qtyIndividualUnitGross) + 16(filler) = 80]
 *  21. Record PG30 (Input, Conditional, Pages 48-49): Inspection / Lab Test / Arrival Location Record.
 *      [Pos 1-80: 2(PG) + 2(30) + 1(inspectionStatus) + 8(requestedDate) + 4(requestedTime) + 4(locationCode) + 50(location) + 9(filler) = 80]
 *  22. Record PG32 (Input, Conditional, Page 51): Commodity Routing Record.
 *      [Pos 1-80: 2(PG) + 2(32) + 3(routingTypeCode) + 2(routingCountryCode) + 3(politicalSubunitQualifier) + 9(politicalSubunitNumber) + 55(politicalSubunitName) + 4(filler) = 80]
 *  23. Record PG34 (Input, Conditional, Page 53): Travel Document Record.
 *      [Pos 1-80: 2(PG) + 2(34) + 3(travelDocumentTypeCode) + 2(travelDocumentNationality) + 35(travelDocumentIdentifier) + 36(filler) = 80]
 *  24. Record PG50 (Input, Conditional, Page 55): Start of Grouping Record.
 *      [Pos 1-80: 2(PG) + 2(50) + 76(filler) = 80]
 *  25. Record PG51 (Input, Conditional, Page 56): End of Grouping Record.
 *      [Pos 1-80: 2(PG) + 2(51) + 76(filler) = 80]
 *  26. Record PG55 (Input, Optional, Page 57): Additional Entity Roles Record.
 *      [Pos 1-80: 2(PG) + 2(55) + 3(role1) + 3(role2) + 3(role3) + 3(role4) + 3(role5) + 3(role6) + 3(role7) + 3(role8) + 3(role9) + 3(role10) + 46(filler) = 80]
 *  27. Record PG60 (Input, Optional, Page 58): Additional Reference / Overflow Information Record.
 *      [Pos 1-80: 2(PG) + 2(60) + 3(additionalInfoQualifierCode) + 73(additionalInformation) = 80]
 *  28. Record PG00 (Input, Optional, Page 59): Substitution Grouping Record.
 *      [Pos 1-80: 2(PG) + 2(00) + 1(substitutionIndicator) + 4(substitutionNumber) + 71(filler) = 80]
 *
 * Explicitly Deferred (7 Agency-Specific Record Variants):
 *   1. Record PG05 (Input, Page 25): Scientific Genus Name, Scientific Species Name, Scientific Sub Species Name,
 *      Scientific Species Code (FWS Category Code), FWS Description Code.
 *      Reason: Agency-specific to Fish & Wildlife Service (FWS) and USDA-APHIS Lacey Act species declarations.
 *   2. Record PG17 (Input, Page 33): Specific Common Name, General Common Name, Live Venomous Wildlife Code, Cartons Containing Wildlife.
 *      Reason: Positions 65-70 contain agency-specific fields for Fish & Wildlife Service (FWS) live venomous wildlife & carton counts.
 *   3. Record PG23 (Input, Page 39): Food and Drug Administration (FDA) Affirmation of Compliance Criteria.
 *      Reason: Agency-specific to FDA (BTA, FCE, SID, etc. Affirmation of Compliance codes & descriptions).
 *   4. Record PG28 (Input, Page 44): Can Dimensions (Acidified/Low-Acid Foods) & Package Tracking Numbers.
 *      Reason: Positions 5-16 contain FDA-specific Can Dimensions (#1, #2, #3) for acidified food regulation.
 *   5. Record PG31 (Input, Page 50): Commodity Harvesting Vessel Characteristic, UOM & Net Weight.
 *      Reason: Agency-specific to NOAA National Marine Fisheries Service (NMFS) harvesting vessel declarations.
 *   6. Record PG33 (Input, Page 52): Commodity Geographic Area Code & Name.
 *      Reason: Agency-specific to NOAA National Marine Fisheries Service (NMFS) ocean geographic area declarations.
 *   7. Record PG35 (Input, Page 54): DOT Surety Code, Serial Number, Bond Qualifier & Amount.
 *      Reason: Agency-specific to Department of Transportation (DOT) National Highway Traffic Safety Administration (NHTSA) conformance bonds.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DISCREPANCIES, CONFLICTS, AND PDF ANOMALIES
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. PG27 Status Cell Omission (Page 43):
 *    In the PG27 specification table, the Status cell for 'Container length 1' (positions 26-27, 2N) is blank.
 *    Container Number 1 status is M, Type of Container 1 status is C. Position math shows positions 26-27 are contiguous and conditional (C).
 * 2. PG01 Disclaimer Code Scope (Pages 19-20):
 *    Page 19 lists Disclaimer codes A-G. Page 20 Note 1 clarifies that codes E (FWS), F (FDA Entry Type 21), and G (USDA APHIS Lacey)
 *    are agency-specific, while A-D (A=Not Regulated, B=Data Not Required, C=Filed Other Means, D=Filed Paper) are generic.
 * 3. PG25 Money vs Quantity Implied Decimals (Page 41):
 *    PGA Line Value (pos 57-68, 12N) explicitly states "in whole dollars" (0 implied decimals).
 *    PGA Unit Value (pos 69-80, 12N) explicitly states "Two decimal places are implied" (2 implied decimals).
 * 4. Record Length Consistency:
 *    All 28 generic backbone input records are 80 characters long, matching standard CATAIR fixed-width transmission frames.
 *
 * Implementation notes (post-reconciliation): this file previously defined its
 * own locally-scoped `PgaRecordSpec` interface and 28 `..._SPEC` constants and
 * tested against those instead of the real `src/lib/abi/pgaMessageSet/`
 * implementation — the same gap found (and fixed) in cargoRelease, statement,
 * and ebond earlier. It now imports the real `RecordSpec`s from
 * `@/lib/abi/pgaMessageSet/recordSpecs` and exercises them via
 * `encodeRecord`/`decodeRecord` from `@/lib/abi/fixedWidth`. Notable shape
 * differences from the old local specs, reconciled below:
 *   - The real specs collapse the 2-char control identifier + 2-char numeric
 *     record type (e.g. "PG" + "01") into a single 4-char `constantField`
 *     (e.g. "PG01") at positions 1-4, rather than two separate fields. The OI
 *     record keeps its 2-char constant ("OI") since it has no numeric suffix.
 *   - Money/quantity fields with implied decimals (PG04 Quantity/Percent,
 *     PG14 LPCO Quantity, PG25 Actual Temperature/Line Value/Unit Value, PG26
 *     Quantity, PG29 Commodity Quantities) are bound to `Decimal` via
 *     `impliedDecimalField`, not raw JS numbers.
 *   - PGA's 8-char "MMDDCCYY" date fields (PG06 Processing Start/End Date,
 *     PG14 LPCO Date, PG22 Date of Signature, PG25 Production Start/End Date,
 *     PG30 Requested/Scheduled Date) are bound to `Date` via `dateFieldCCYY`,
 *     not raw digit strings.
 *   - Identifiers with semantically significant leading zeros (PG01 PGA Line
 *     Number, PG07 Manufacture Month/Year, PG30 Requested/Scheduled Time) use
 *     `numericCodeField`, which decodes to a zero-padded string, not a
 *     `parseInt`-derived number — the same leading-zero bug found and fixed
 *     in Entry Summary Query's JI-Record and eBond's Surety Code.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect } from "vitest";
import { encodeRecord, decodeRecord } from "@/lib/abi/fixedWidth";
import { Decimal } from "@/lib/tariff/decimal";
import {
  OI_LINE_ITEM_SPEC,
  PG01_HEADER_SPEC,
  PG02_PRODUCT_COMPONENT_SPEC,
  PG04_CONSTITUENT_ELEMENT_SPEC,
  PG06_SOURCE_PROCESSING_SPEC,
  PG07_TRADE_NAME_MODEL_SPEC,
  PG08_ITEM_IDENTITY_OVERFLOW_SPEC,
  PG10_CATEGORY_CHARACTERISTIC_SPEC,
  PG13_LPCO_ISSUER_SPEC,
  PG14_LPCO_DETAILS_SPEC,
  PG18_HAZMAT_SPEC,
  PG19_ENTITY_IDENTIFICATION_SPEC,
  PG20_ENTITY_ADDRESS_SPEC,
  PG21_INDIVIDUAL_CONTACT_SPEC,
  PG22_IMPORTER_DECLARATION_SPEC,
  PG24_REMARKS_SPEC,
  PG25_TEMPERATURE_LOT_VALUES_SPEC,
  PG26_PACKAGING_BREAKDOWN_SPEC,
  PG27_SHIPPING_CONTAINER_SPEC,
  PG29_COMMODITY_QUANTITIES_SPEC,
  PG30_INSPECTION_LOCATION_SPEC,
  PG32_COMMODITY_ROUTING_SPEC,
  PG34_TRAVEL_DOCUMENT_SPEC,
  PG50_GROUP_START_SPEC,
  PG51_GROUP_END_SPEC,
  PG55_ADDITIONAL_ENTITY_ROLES_SPEC,
  PG60_ADDITIONAL_REFERENCE_SPEC,
  PG00_SUBSTITUTION_SPEC,
} from "@/lib/abi/pgaMessageSet/recordSpecs";

const ALL_PGA_SPECS = [
  OI_LINE_ITEM_SPEC,
  PG01_HEADER_SPEC,
  PG02_PRODUCT_COMPONENT_SPEC,
  PG04_CONSTITUENT_ELEMENT_SPEC,
  PG06_SOURCE_PROCESSING_SPEC,
  PG07_TRADE_NAME_MODEL_SPEC,
  PG08_ITEM_IDENTITY_OVERFLOW_SPEC,
  PG10_CATEGORY_CHARACTERISTIC_SPEC,
  PG13_LPCO_ISSUER_SPEC,
  PG14_LPCO_DETAILS_SPEC,
  PG18_HAZMAT_SPEC,
  PG19_ENTITY_IDENTIFICATION_SPEC,
  PG20_ENTITY_ADDRESS_SPEC,
  PG21_INDIVIDUAL_CONTACT_SPEC,
  PG22_IMPORTER_DECLARATION_SPEC,
  PG24_REMARKS_SPEC,
  PG25_TEMPERATURE_LOT_VALUES_SPEC,
  PG26_PACKAGING_BREAKDOWN_SPEC,
  PG27_SHIPPING_CONTAINER_SPEC,
  PG29_COMMODITY_QUANTITIES_SPEC,
  PG30_INSPECTION_LOCATION_SPEC,
  PG32_COMMODITY_ROUTING_SPEC,
  PG34_TRAVEL_DOCUMENT_SPEC,
  PG50_GROUP_START_SPEC,
  PG51_GROUP_END_SPEC,
  PG55_ADDITIONAL_ENTITY_ROLES_SPEC,
  PG60_ADDITIONAL_REFERENCE_SPEC,
  PG00_SUBSTITUTION_SPEC,
];

describe("PGA Message Set Generic Backbone Records — 80-Column Spec Validation", () => {
  it("covers exactly 28 generic cross-agency backbone records", () => {
    expect(ALL_PGA_SPECS.length).toBe(28);
  });

  it.each(ALL_PGA_SPECS.map((spec) => [spec.recordType, spec]))(
    "%s has length 80 and field lengths sum to exactly 80",
    (_recordType, spec) => {
      expect(spec.length).toBe(80);
      const totalFieldLength = spec.fields.reduce((sum, f) => sum + f.length, 0);
      expect(totalFieldLength).toBe(80);
    }
  );

  it.each(ALL_PGA_SPECS.map((spec) => [spec.recordType, spec]))(
    "%s has contiguous 1-indexed field position ranges",
    (_recordType, spec) => {
      let expectedStart = 1;
      for (const field of spec.fields) {
        expect(field.start).toBe(expectedStart);
        expectedStart += field.length;
      }
      expect(expectedStart - 1).toBe(80);
    }
  );
});

describe("Specific Field Layout Assertions against PDF Chapter 8", () => {
  it("OI-Record (Commercial Line Item Description) positions match PDF p. 16", () => {
    const fields = Object.fromEntries(
      OI_LINE_ITEM_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );
    expect(fields.filler_1).toMatchObject({ start: 1, length: 2, class: "A", designation: "M", constant: "OI" });
    expect(fields.filler_3).toMatchObject({ start: 3, length: 8, class: "S", designation: "M" });
    expect(fields.commercialDescription).toMatchObject({ start: 11, length: 70, class: "X", designation: "M" });
  });

  it("PG01-Record (Header) positions match PDF pp. 17-19", () => {
    const fields = Object.fromEntries(
      PG01_HEADER_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );
    expect(fields.filler_1).toMatchObject({ start: 1, length: 4, class: "A", designation: "M", constant: "PG01" });
    expect(fields.pgaLineNumber).toMatchObject({ start: 5, length: 3, class: "N", designation: "M" });
    expect(fields.governmentAgencyCode).toMatchObject({ start: 8, length: 3, class: "AN", designation: "M" });
    expect(fields.governmentAgencyProgramCode).toMatchObject({ start: 11, length: 3, class: "X", designation: "M" });
    expect(fields.correctionIndicator).toMatchObject({ start: 79, length: 1, class: "X", designation: "C" });
    expect(fields.disclaimer).toMatchObject({ start: 80, length: 1, class: "A", designation: "C" });
  });

  it("PG04-Record Quantity/Percent implied decimals (2dp / 4dp) match PDF p. 23", () => {
    const qtyLine = encodeRecord(PG04_CONSTITUENT_ELEMENT_SPEC, {
      quantityOfConstituentElement: new Decimal("1250.75"),
    });
    expect(qtyLine.slice(56, 68)).toBe("000000125075"); // pos 57-68, 12 chars, 2 implied decimals
    expect(decodeRecord(PG04_CONSTITUENT_ELEMENT_SPEC, qtyLine).quantityOfConstituentElement?.toString()).toBe(
      "1250.75"
    );

    const pctLine = encodeRecord(PG04_CONSTITUENT_ELEMENT_SPEC, {
      percentOfConstituentElement: new Decimal("9.0009"),
    });
    expect(pctLine.slice(73, 80)).toBe("0090009"); // pos 74-80, 7 chars, 4 implied decimals
    expect(decodeRecord(PG04_CONSTITUENT_ELEMENT_SPEC, pctLine).percentOfConstituentElement?.toString()).toBe(
      "9.0009"
    );
  });

  it("PG14-Record LPCO Quantity implied decimals (4dp) match PDF p. 32", () => {
    const line = encodeRecord(PG14_LPCO_DETAILS_SPEC, {
      lpcoQuantity: new Decimal("50.1234"),
    });
    expect(line.slice(50, 66)).toBe("0000000000501234"); // pos 51-66, 16 chars, 4 implied decimals
    expect(decodeRecord(PG14_LPCO_DETAILS_SPEC, line).lpcoQuantity?.toString()).toBe("50.1234");
  });

  it("PG25-Record Temperature/Line Value/Unit Value implied decimals match PDF p. 41", () => {
    const line = encodeRecord(PG25_TEMPERATURE_LOT_VALUES_SPEC, {
      actualTemperature: new Decimal("39.5"), // pos 8-13, 6 chars, 2 implied decimals
      pgaLineValue: new Decimal("75000"), // pos 57-68, 12 chars, 0 implied decimals (whole dollars)
      pgaUnitValue: new Decimal("49.99"), // pos 69-80, 12 chars, 2 implied decimals
    });
    expect(line.slice(7, 13)).toBe("003950");
    expect(line.slice(56, 68)).toBe("000000075000");
    expect(line.slice(68, 80)).toBe("000000004999");

    const decoded = decodeRecord(PG25_TEMPERATURE_LOT_VALUES_SPEC, line);
    expect(decoded.actualTemperature?.toString()).toBe("39.5");
    expect(decoded.pgaLineValue?.toString()).toBe("75000");
    expect(decoded.pgaUnitValue?.toString()).toBe("49.99");
  });

  it("PG27-Record (Shipping Container) positions match PDF p. 43 (including status cell omission at Container Length 1)", () => {
    const fields = Object.fromEntries(
      PG27_SHIPPING_CONTAINER_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );
    expect(fields.containerNumber1).toMatchObject({ start: 5, length: 20, class: "AN", designation: "M" });
    expect(fields.typeOfContainer1).toMatchObject({ start: 25, length: 1, class: "N", designation: "C" });
    expect(fields.containerLength1).toMatchObject({ start: 26, length: 2, class: "N", designation: "C" });
    expect(fields.filler_74).toMatchObject({ start: 74, length: 7, class: "S", designation: "M" });
  });

  it("PG00-Record (Substitution Grouping) positions match PDF p. 59", () => {
    const fields = Object.fromEntries(
      PG00_SUBSTITUTION_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );
    expect(fields.filler_1).toMatchObject({ start: 1, length: 4, class: "A", designation: "M", constant: "PG00" });
    expect(fields.substitutionIndicator).toMatchObject({ start: 5, length: 1, class: "X", designation: "M" });
    expect(fields.substitutionNumber).toMatchObject({ start: 6, length: 4, class: "AN", designation: "M" });
    expect(fields.filler_10).toMatchObject({ start: 10, length: 71, class: "S", designation: "M" });
  });
});
