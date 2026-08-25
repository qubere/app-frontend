import { Decimal } from "@/lib/tariff/decimal";
import { buildEntryNumber, isValidEntryNumberCheckDigit } from "@/lib/abi/entryNumber";
import { assembleTransaction } from "./assembleTransaction";
import { wrapBlock, wrapBatch } from "@/lib/abi/batchBlockControl/build";
import type { ARecordInput, BRecordInput } from "@/lib/abi/batchBlockControl/types";
import { AbiFilingValidationError, type EnvelopeHeaderOptions } from "@/lib/abi/entrySummary/fromCustomsFiling";
import type {
  CargoReleaseTransactionInput,
  HeaderInput,
  AdditionalHeaderInput,
  ContactCancellationInput,
  BillOfLadingInput,
  ConveyanceInput,
  EquipmentInput,
  LineItemInput,
  FtzDetailInput,
  FtzPfHtsInput,
  BillOfLadingGroupInput,
  HeaderEntityGroupInput,
  HtsLineGroupInput,
  LineItemGroupInput,
} from "./types";

export type { EnvelopeHeaderOptions };
export { AbiFilingValidationError };

/**
 * Shape of a loaded CustomsFiling Prisma record with relations required for Cargo Release (SE).
 */
export type CustomsFilingWithCargoReleaseRelations = {
  id: string;
  entryNumber: string;
  entryType?: string | null;
  actionCode?: string | null;
  brokerReferenceNumber?: string | null;
  modeOfTransportationCode?: string | null;
  foreignTradeZoneIdentifier?: string | null;
  estimatedEntryDate?: Date | null;
  dateOfImportation?: Date | null;
  importerOfRecord?: {
    cbpImporterNumber?: string | null;
    irsEin?: string | null;
    name?: string | null;
  } | null;
  bond?: {
    bondType?: string | null;
    suretyName?: string | null;
    suretyCode?: string | null;
    bondNumber?: string | null;
    bondAmount?: Decimal | number | null;
  } | null;
  shipment?: {
    portOfEntry?: string | null;
    entryType?: string | null;
    transportMode?: string | null;
    carrierName?: string | null;
    estimatedArrival?: Date | null;
    arrivalDate?: Date | null;
    ladingDate?: Date | null;
    trackingNumber?: string | null;
    transportLegs?: {
      id: string;
      mode?: string | null;
      carrierCode?: string | null;
      vesselName?: string | null;
      voyageNumber?: string | null;
      flightNumber?: string | null;
      estimatedArrival?: Date | null;
      actualArrival?: Date | null;
    }[];
    trackingIdentifiers?: {
      type: string;
      value: string;
      issuer?: string | null;
    }[];
    lineItems?: {
      id: string;
      lineNumber: number;
      partNumber?: string | null;
      description: string;
      quantity: number;
      unitPrice: Decimal | number;
      totalValue: Decimal | number;
      countryOfOrigin: string;
      htsCode: string;
      // ShipmentLineItem has no relation to ShipmentParty in the current schema
      // (verified by grep — ShipmentParty only carries shipmentId, no
      // shipmentLineItemId). Line-level entities (SE50/51/55/56) have no real
      // schema home; omitted rather than fabricated below.
      ftzDetails?: {
        merchandiseStatusCode?: string | null;
        lineItemQuantity?: Decimal | number | null;
        privilegedStatusDate?: Date | null;
        currentHtsNumber?: string | null;
      }[];
    }[];
    shipmentParties?: {
      role: string;
      partyTypeCode?: string | null;
      legalEntity?: {
        legalName: string;
        taxIdentifier?: string | null;
        taxIdentifierType?: string | null;
      } | null;
    }[];
  } | null;
};

/**
 * Normalizes an entry number into a 3-character filer code and 8-character entry number.
 */
function parseFilerAndEntryNumber(
  rawEntryNumber?: string | null,
  fallbackFilerCode?: string | null
): { entryFilerCode?: string; entryNumber?: string } {
  if (!rawEntryNumber) {
    const entryFilerCode = fallbackFilerCode
      ? fallbackFilerCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 3)
      : undefined;
    return { entryFilerCode, entryNumber: undefined };
  }

  const cleaned = rawEntryNumber.replace(/[^A-Za-z0-9]/g, "");

  if (cleaned.length === 11) {
    const entryFilerCode = cleaned.slice(0, 3).toUpperCase();
    const entryNum = cleaned.slice(3);
    if (isValidEntryNumberCheckDigit(entryFilerCode, entryNum)) {
      return { entryFilerCode, entryNumber: entryNum };
    }
    const txNum = entryNum.slice(0, 7);
    return { entryFilerCode, entryNumber: buildEntryNumber(entryFilerCode, txNum) };
  }

  const entryFilerCode = fallbackFilerCode
    ? fallbackFilerCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 3)
    : undefined;

  if (entryFilerCode && cleaned.length === 8 && isValidEntryNumberCheckDigit(entryFilerCode, cleaned)) {
    return { entryFilerCode, entryNumber: cleaned };
  }

  if (entryFilerCode && (cleaned.length === 7 || cleaned.length === 8)) {
    const txNum = cleaned.slice(0, 7).padStart(7, "0");
    return { entryFilerCode, entryNumber: buildEntryNumber(entryFilerCode, txNum) };
  }

  return { entryFilerCode, entryNumber: undefined };
}

/**
 * Normalizes a country string to a 2-character ISO country code.
 */
function normalizeCountryCode(country?: string | null): string {
  if (!country) return "US";
  const trimmed = country.trim().toUpperCase();
  if (trimmed.length === 2) return trimmed;
  if (trimmed === "UNITED STATES" || trimmed === "USA") return "US";
  if (trimmed === "GERMANY") return "DE";
  if (trimmed === "CHINA") return "CN";
  if (trimmed === "MEXICO") return "MX";
  if (trimmed === "CANADA") return "CA";
  if (trimmed === "JAPAN") return "JP";
  return trimmed.slice(0, 2);
}

/**
 * Validates a CustomsFiling record for Cargo Release transmission readiness.
 */
export function validateCustomsFilingForCargoRelease(
  filing: CustomsFilingWithCargoReleaseRelations,
  options?: Partial<EnvelopeHeaderOptions>
): { valid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];

  const { entryFilerCode, entryNumber } = parseFilerAndEntryNumber(
    filing.entryNumber,
    options?.processingFilerCode
  );

  if (!entryFilerCode || entryFilerCode.length !== 3) {
    missingFields.push(
      "header.entryFilerCode (requires 3-char entryNumber prefix or options.processingFilerCode)"
    );
  }

  if (!entryNumber || entryNumber.length !== 8) {
    missingFields.push("header.entryNumber (requires valid 8-char entry number)");
  }

  const plannedPortOfEntry =
    filing.shipment?.portOfEntry ?? options?.processingDistrictPortCode;
  if (!plannedPortOfEntry || plannedPortOfEntry.trim() === "") {
    missingFields.push(
      "header.plannedPortOfEntry (requires shipment.portOfEntry or options.processingDistrictPortCode)"
    );
  }

  const rawLineItems = filing.shipment?.lineItems;
  if (!rawLineItems || rawLineItems.length === 0) {
    missingFields.push("shipment.lineItems (requires at least 1 line item)");
  } else {
    rawLineItems.forEach((item, i) => {
      if (!item.countryOfOrigin || item.countryOfOrigin.trim() === "") {
        missingFields.push(`shipment.lineItems[${i}].countryOfOrigin`);
      }
      if (!item.htsCode || item.htsCode.trim() === "") {
        missingFields.push(`shipment.lineItems[${i}].htsCode`);
      }
      if (item.totalValue == null) {
        missingFields.push(`shipment.lineItems[${i}].totalValue`);
      }
    });
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Converts a database CustomsFiling record (and its loaded relations) to a
 * CargoReleaseTransactionInput object ready for CATAIR assembly.
 *
 * Throws AbiFilingValidationError if required fields are missing.
 */
export function fromCustomsFiling(
  filing: CustomsFilingWithCargoReleaseRelations,
  options?: Partial<EnvelopeHeaderOptions>
): CargoReleaseTransactionInput {
  const validation = validateCustomsFilingForCargoRelease(filing, options);
  if (!validation.valid) {
    throw new AbiFilingValidationError(filing.id, validation.missingFields);
  }

  const { entryFilerCode, entryNumber } = parseFilerAndEntryNumber(
    filing.entryNumber,
    options?.processingFilerCode
  );

  const plannedPortOfEntry = (
    filing.shipment?.portOfEntry ?? options?.processingDistrictPortCode
  )!;

  const actionCode = (filing.actionCode as "A" | "R" | "D") || "A";

  const rawLineItems = filing.shipment!.lineItems!;
  const estimatedEntryValue = rawLineItems.reduce<Decimal>((sum, item) => {
    return sum.add(new Decimal(item.totalValue));
  }, new Decimal(0));

  const importerNum =
    filing.importerOfRecord?.cbpImporterNumber ??
    filing.importerOfRecord?.irsEin ??
    undefined;

  const isStb = filing.bond?.bondType === "single_transaction";

  const header: HeaderInput = {
    actionCode,
    entryFilerCode: entryFilerCode!,
    entryNumber: entryNumber!,
    entryTypeCode: filing.entryType ?? filing.shipment?.entryType ?? "01",
    importerOfRecordType: filing.importerOfRecord?.irsEin ? "EI" : importerNum ? "CBP" : undefined,
    importerOfRecordNumber: importerNum ? importerNum.replace(/[^A-Za-z0-9]/g, "").toUpperCase() : undefined,
    modeOfTransportationCode: filing.modeOfTransportationCode ?? filing.shipment?.transportMode ?? undefined,
    bondTypeCode: isStb ? "9" : "8",
    estimatedEntryValue,
    plannedPortOfEntry,

    // TODO: No schema home for splitShipmentReleaseCode (HeaderInput)
    splitShipmentReleaseCode: undefined,
    // TODO: No schema home for portOfUnlading (HeaderInput)
    portOfUnlading: undefined,
  };

  const primaryLeg = filing.shipment?.transportLegs?.[0];
  let additionalHeader: AdditionalHeaderInput | undefined;
  if (
    filing.foreignTradeZoneIdentifier ||
    primaryLeg?.vesselName ||
    primaryLeg?.voyageNumber ||
    primaryLeg?.flightNumber ||
    filing.estimatedEntryDate
  ) {
    additionalHeader = {
      conveyanceNameOrFtzId: filing.foreignTradeZoneIdentifier ?? primaryLeg?.vesselName ?? undefined,
      voyageFlightTripManifestNumber: primaryLeg?.voyageNumber ?? primaryLeg?.flightNumber ?? undefined,
      electedEntryDate: filing.estimatedEntryDate ?? filing.shipment?.estimatedArrival ?? undefined,

      // TODO: No schema home for locationOfGoodsFirms (AdditionalHeaderInput)
      locationOfGoodsFirms: undefined,
      // TODO: No schema home for electedExamSiteFirms (AdditionalHeaderInput)
      electedExamSiteFirms: undefined,
      // TODO: No schema home for generalOrderNumber (AdditionalHeaderInput)
      generalOrderNumber: undefined,
      // TODO: No schema home for cbpBondedWarehouseFirms (AdditionalHeaderInput)
      cbpBondedWarehouseFirms: undefined,
      // TODO: No schema home for originatingWarehouseEntryFilerCode (AdditionalHeaderInput)
      originatingWarehouseEntryFilerCode: undefined,
      // TODO: No schema home for originatingWarehouseEntryNumber (AdditionalHeaderInput)
      originatingWarehouseEntryNumber: undefined,
      // TODO: No schema home for immediateDeliveryIndicator (AdditionalHeaderInput)
      immediateDeliveryIndicator: undefined,
    };
  }

  // Contact / Cancellation Input
  // TODO: CustomsFiling model has no dedicated contact fields; fallback to generic defaults or options
  const contactCancellation: ContactCancellationInput = {
    contactName: options?.filerPreparerUserDataText?.slice(0, 30) || "FILER CONTACT",
    contactPhone: "0000000000",
  };

  // Bills of Lading and Conveyance mapping
  const trackingList = filing.shipment?.trackingIdentifiers ?? [];
  const bolTracking = trackingList.find(t => ["MBL", "HBL", "BOOKING"].includes(t.type.toUpperCase()));
  const containerTracking = trackingList.filter(t => t.type.toUpperCase() === "CONTAINER");

  let bills: BillOfLadingGroupInput[] | undefined;
  // No fallback beyond trackingIdentifiers: Shipment has no direct trackingNumber
  // field in the current schema (verified by grep).
  const billNumber = bolTracking?.value;
  if (billNumber) {
    const billTypeIndicator = bolTracking?.type.toUpperCase() === "HBL" ? "H" : "R";
    const issuerCodeOfBillOfLadingNumber = bolTracking?.issuer || primaryLeg?.carrierCode || filing.shipment?.carrierName?.slice(0, 4) || undefined;
    const totalQty = rawLineItems.reduce((acc, item) => acc + item.quantity, 0);

    const billInput: BillOfLadingInput = {
      billTypeIndicator,
      issuerCodeOfBillOfLadingNumber,
      billOfLadingNumber: billNumber.toUpperCase(),
      quantity: totalQty > 0 ? totalQty : 1,
      nonAmsIndicator: "N",
    };

    let conveyances: ConveyanceInput[] | undefined;
    if (primaryLeg || filing.shipment?.carrierName) {
      conveyances = [
        {
          carrierCode: primaryLeg?.carrierCode ?? filing.shipment?.carrierName?.slice(0, 4).toUpperCase() ?? "UNKNOWN",
          voyageFlightTripManifestNumber: primaryLeg?.voyageNumber ?? primaryLeg?.flightNumber ?? "0001",
          dateOfArrival: primaryLeg?.actualArrival ?? primaryLeg?.estimatedArrival ?? filing.shipment?.arrivalDate ?? filing.shipment?.estimatedArrival ?? new Date(),
          quantity: totalQty > 0 ? totalQty : 1,
          conveyanceName: primaryLeg?.vesselName ?? undefined,
        },
      ];
    }

    let equipment: EquipmentInput[] | undefined;
    if (containerTracking.length > 0) {
      equipment = containerTracking.map(c => ({ equipmentNumber: c.value.toUpperCase() }));
    }

    bills = [
      {
        billsOfLading: [billInput],
        conveyances,
        equipment,
      },
    ];
  }

  // Header Entities mapping
  const shipmentParties = filing.shipment?.shipmentParties;
  let headerEntities: HeaderEntityGroupInput[] | undefined;
  if (shipmentParties && shipmentParties.length > 0) {
    headerEntities = shipmentParties.map(p => ({
      entity: {
        entityCode: p.partyTypeCode || (p.role === "MANUFACTURER" ? "MF" : "SE"),
        entityName: p.legalEntity?.legalName?.toUpperCase(),
        entityIdentifierQualifier: p.legalEntity?.taxIdentifierType ?? undefined,
        entityIdentifier: p.legalEntity?.taxIdentifier ?? undefined,
      },
    }));
  }

  // Line Item Groupings mapping
  const lines: LineItemGroupInput[] = rawLineItems.map(item => {
    const lineItem: LineItemInput = {
      lineItemIdentifier: String(item.lineNumber).padStart(3, "0"),
      countryOfOrigin: normalizeCountryCode(item.countryOfOrigin),
      commercialInvoiceDescription: item.description ? item.description.slice(0, 45) : undefined,
    };

    let ftzStatus: FtzDetailInput | undefined;
    const ftzRow = item.ftzDetails?.[0];
    if (ftzRow) {
      ftzStatus = {
        // FtzDetail's real field is merchandiseStatusCode (verified against
        // src/lib/abi/entrySummary/fromCustomsFiling.ts's own FTZ mapping,
        // which uses this exact field for the same P/N/D-style value domain).
        zoneStatus: (ftzRow.merchandiseStatusCode as "P" | "N" | "D" | "Z") ?? "N",
        privilegedFtzMerchandiseFilingDate: ftzRow.privilegedStatusDate ?? undefined,
        ftzLineItemQuantity: ftzRow.lineItemQuantity ? Number(ftzRow.lineItemQuantity) : item.quantity,
      };
    }

    const cleanHts = item.htsCode.replace(/[^A-Za-z0-9]/g, "");
    let ftzPfHts: FtzPfHtsInput | undefined;
    if (ftzRow?.currentHtsNumber) {
      ftzPfHts = {
        currentHtsNumberForPfStatusMerchandise: ftzRow.currentHtsNumber.replace(/[^A-Za-z0-9]/g, ""),
      };
    }

    const htsLines: HtsLineGroupInput[] = [
      {
        htsLine: {
          htsNumber: cleanHts,
          lineItemValue: new Decimal(item.totalValue),
        },
        ftzPfHts,
      },
    ];

    // TODO: No schema home for line-level entities (SE50/51/55/56). ShipmentParty
    // is only scoped to Shipment (shipmentId), not ShipmentLineItem — there is no
    // per-line-item party relation in the current schema (verified by grep).

    return {
      lineItem,
      ftzStatus,
      htsLines,
    };
  });

  return {
    header,
    additionalHeader,
    contactCancellation,
    bills,
    headerEntities,
    lines,
  };
}

/**
 * End-to-end composer function for ACE Cargo Release (SE):
 * Maps loaded CustomsFiling to CargoReleaseTransactionInput, assembles ordered transaction lines,
 * wraps in an "SE" block envelope (B-record), wraps in an "SE" batch envelope (A-record),
 * and returns full transmittable line array.
 *
 * Throws AbiFilingValidationError if required fields are missing.
 */
export function buildAbiTransmissionForCargoReleaseFiling(
  filing: CustomsFilingWithCargoReleaseRelations,
  envelopeHeader: EnvelopeHeaderOptions
): string[] {
  const transactionInput = fromCustomsFiling(filing, envelopeHeader);
  const transactionLines = assembleTransaction(transactionInput);

  const bRecordInput: BRecordInput = {
    processingDistrictPortCode: envelopeHeader.processingDistrictPortCode,
    processingFilerCode: envelopeHeader.processingFilerCode,
    applicationIdentifierCode: envelopeHeader.applicationIdentifierCode ?? "SE",
    processingFilerOfficeCode: envelopeHeader.processingFilerOfficeCode,
    filerPreparerUserDataText: envelopeHeader.filerPreparerUserDataText,
  };

  const blockLines = wrapBlock(bRecordInput, transactionLines);

  const aRecordInput: ARecordInput = {
    senderReceiverSiteCode: envelopeHeader.senderReceiverSiteCode,
    senderReceiverIdCode: envelopeHeader.senderReceiverIdCode,
    communicationPassword: envelopeHeader.communicationPassword,
    transmissionDate: envelopeHeader.transmissionDate,
    applicationIdentifierCode: envelopeHeader.applicationIdentifierCode ?? "SE",
    senderReceiverOfficeCode: envelopeHeader.senderReceiverOfficeCode,
    transmitterUserDataText: envelopeHeader.transmitterUserDataText,
  };

  return wrapBatch(aRecordInput, [blockLines]);
}
