/**
 * Comprehensive Field Inventory across existing extraction, UI, and storage paths.
 *
 * Captures all legacy extraction keys, tradeMetadata properties, review labels,
 * direct shipment columns, and Fact.field names, explicitly tagging drift keys
 * identified in section 0 & section 2 of docs/plans/LLM-UNIVERSAL-FIELD-HYDRATION.md.
 */

import type { FieldInventoryItem } from "../types/canonicalRegistry";

export const FIELD_INVENTORY: FieldInventoryItem[] = [
  // ---------------------------------------------------------------------------
  // DRIFT KEYS (Directly documented in live incidents)
  // ---------------------------------------------------------------------------
  {
    legacyKey: "carrier",
    tradeMetadataKey: "carrier",
    fieldReviewLabel: "Carrier",
    directShipmentColumn: "carrierName",
    factFieldName: "carrierName",
    canonicalKey: "shipment.carrier.name",
    entityKind: "SHIPMENT",
    isDriftKey: true,
    notes:
      "Drift: tradeMetadata uses 'carrier', field-review map expects 'carrierName', Shipment column is 'carrierName'.",
  },
  {
    legacyKey: "invoiceSubtotal",
    tradeMetadataKey: "invoiceSubtotal",
    fieldReviewLabel: "Total Invoice Amount",
    directShipmentColumn: undefined,
    factFieldName: "totalAmount",
    canonicalKey: "shipment.financial.invoiceSubtotal",
    entityKind: "SHIPMENT",
    isDriftKey: true,
    notes:
      "Drift: extracted as 'invoiceSubtotal' or 'totalAmount', Fact uses 'totalAmount', no dedicated Shipment column.",
  },
  {
    legacyKey: "transportDocumentNumber",
    tradeMetadataKey: "transportDocumentNumber",
    fieldReviewLabel: "Bill of Lading",
    directShipmentColumn: undefined,
    factFieldName: "billOfLading",
    canonicalKey: "tracking.billOfLading",
    entityKind: "TRACKING_IDENTIFIER",
    isDriftKey: true,
    notes:
      "Drift: extracted as 'transportDocumentNumber' or 'billOfLading', Fact uses 'billOfLading'.",
  },
  {
    legacyKey: "hsHtsCode",
    tradeMetadataKey: "hsHtsCode",
    fieldReviewLabel: "HTS Classification Code",
    directShipmentColumn: undefined,
    factFieldName: "htsCode",
    canonicalKey: "lineItem[].htsCode",
    entityKind: "LINE_ITEM",
    isDriftKey: true,
    notes:
      "Drift: extracted as 'hsHtsCode', 'htsCode', or 'htsCandidate'; Fact uses 'htsCode'.",
  },
  {
    legacyKey: "totalWeight",
    tradeMetadataKey: "totalWeight",
    fieldReviewLabel: "Gross Weight",
    directShipmentColumn: undefined,
    factFieldName: "grossWeight",
    canonicalKey: "shipment.cargo.grossWeight",
    entityKind: "SHIPMENT",
    isDriftKey: true,
    notes:
      "Drift: tradeMetadata uses 'totalWeight', Fact uses 'grossWeight'.",
  },

  // ---------------------------------------------------------------------------
  // SHIPMENT SCALARS
  // ---------------------------------------------------------------------------
  {
    legacyKey: "originCountry",
    tradeMetadataKey: "originCountry",
    fieldReviewLabel: "Country of Origin",
    directShipmentColumn: "countryOfOrigin",
    factFieldName: "countryOfOrigin",
    canonicalKey: "shipment.originCountry",
    entityKind: "SHIPMENT",
    isDriftKey: false,
    notes: "Mapped via dedicated originCountry handler in field-review route.",
  },
  {
    legacyKey: "destinationCountry",
    tradeMetadataKey: "destinationCountry",
    fieldReviewLabel: "Destination Country",
    directShipmentColumn: "destinationCountry",
    factFieldName: "destinationCountry",
    canonicalKey: "shipment.destinationCountry",
    entityKind: "SHIPMENT",
    isDriftKey: false,
  },
  {
    legacyKey: "incoterm",
    tradeMetadataKey: "incoterm",
    fieldReviewLabel: "Incoterm",
    directShipmentColumn: "incoterm",
    factFieldName: "incoterm",
    canonicalKey: "shipment.incoterm",
    entityKind: "SHIPMENT",
    isDriftKey: false,
  },
  {
    legacyKey: "currency",
    tradeMetadataKey: "currency",
    fieldReviewLabel: "Invoice Currency",
    directShipmentColumn: "invoiceCurrency",
    factFieldName: "invoiceCurrency",
    canonicalKey: "shipment.financial.invoiceCurrency",
    entityKind: "SHIPMENT",
    isDriftKey: false,
  },
  {
    legacyKey: "invoiceNumber",
    tradeMetadataKey: "invoiceNumber",
    fieldReviewLabel: "Invoice Number",
    directShipmentColumn: undefined,
    factFieldName: "invoiceNumber",
    canonicalKey: "shipment.invoiceNumber",
    entityKind: "SHIPMENT",
    isDriftKey: false,
  },
  {
    legacyKey: "invoiceDate",
    tradeMetadataKey: "invoiceDate",
    fieldReviewLabel: "Invoice Date",
    directShipmentColumn: undefined,
    factFieldName: "invoiceDate",
    canonicalKey: "shipment.invoiceDate",
    entityKind: "SHIPMENT",
    isDriftKey: false,
  },

  // ---------------------------------------------------------------------------
  // PARTIES
  // ---------------------------------------------------------------------------
  {
    legacyKey: "exporterName",
    tradeMetadataKey: "exporterName",
    fieldReviewLabel: "Exporter Name",
    directShipmentColumn: undefined,
    factFieldName: "exporterName",
    canonicalKey: "party.exporter.name",
    entityKind: "PARTY_ROLE",
    isDriftKey: false,
    notes: "Resolves EXPORTER party role via EntityResolutionService.",
  },
  {
    legacyKey: "importerName",
    tradeMetadataKey: "importerName",
    fieldReviewLabel: "Importer / Consignee Name",
    directShipmentColumn: undefined,
    factFieldName: "importerName",
    canonicalKey: "party.importer.name",
    entityKind: "PARTY_ROLE",
    isDriftKey: false,
    notes: "Resolves IMPORTER_OF_RECORD party role via EntityResolutionService.",
  },

  // ---------------------------------------------------------------------------
  // LINE ITEMS
  // ---------------------------------------------------------------------------
  {
    legacyKey: "lineNumber",
    tradeMetadataKey: undefined,
    fieldReviewLabel: undefined,
    directShipmentColumn: undefined,
    factFieldName: "lineNumber",
    canonicalKey: "lineItem[].lineNumber",
    entityKind: "LINE_ITEM",
    isDriftKey: false,
  },
  {
    legacyKey: "description",
    tradeMetadataKey: undefined,
    fieldReviewLabel: undefined,
    directShipmentColumn: undefined,
    factFieldName: "description",
    canonicalKey: "lineItem[].description",
    entityKind: "LINE_ITEM",
    isDriftKey: false,
  },
  {
    legacyKey: "quantity",
    tradeMetadataKey: undefined,
    fieldReviewLabel: undefined,
    directShipmentColumn: undefined,
    factFieldName: "quantity",
    canonicalKey: "lineItem[].quantity",
    entityKind: "LINE_ITEM",
    isDriftKey: false,
  },
  {
    legacyKey: "unitPrice",
    tradeMetadataKey: undefined,
    fieldReviewLabel: undefined,
    directShipmentColumn: undefined,
    factFieldName: "unitPrice",
    canonicalKey: "lineItem[].unitPrice",
    entityKind: "LINE_ITEM",
    isDriftKey: false,
  },

  // ---------------------------------------------------------------------------
  // FILING DRAFT & CUSTOMS
  // ---------------------------------------------------------------------------
  {
    legacyKey: "entryNumber",
    tradeMetadataKey: "entryNumber",
    fieldReviewLabel: undefined,
    directShipmentColumn: undefined,
    factFieldName: "entryNumber",
    canonicalKey: "filing.entryNumber",
    entityKind: "FILING_DRAFT",
    isDriftKey: false,
  },
  {
    legacyKey: "entryType",
    tradeMetadataKey: undefined,
    fieldReviewLabel: undefined,
    directShipmentColumn: undefined,
    factFieldName: "entryType",
    canonicalKey: "filing.entryType",
    entityKind: "FILING_DRAFT",
    isDriftKey: false,
  },
  {
    legacyKey: "portOfEntry",
    tradeMetadataKey: "portOfEntry",
    fieldReviewLabel: undefined,
    directShipmentColumn: undefined,
    factFieldName: "portOfEntry",
    canonicalKey: "filing.portOfEntry",
    entityKind: "FILING_DRAFT",
    isDriftKey: false,
  },
];
