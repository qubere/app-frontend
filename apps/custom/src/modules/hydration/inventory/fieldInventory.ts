/**
 * Comprehensive Field Inventory across existing extraction, UI, and storage paths.
 *
 * This is the ONE bridge table between the field-name vocabularies that the
 * document flow uses and that historically never translated to each other:
 *
 *  - `tradeMetadataKey`      camelCase key on `ShipmentDocument.extractedJson.tradeMetadata`
 *                            (what the shipment page + document viewer read)
 *  - `extractionSchemaKeys`  snake_case names from `extractionSchemas.ts`
 *                            (what `MISSING_EXTRACTION:*` exceptions are keyed on)
 *  - `reconciliationKey`     the `fieldKey` in `reconciliationRules.ts`
 *                            (what the cross-document reconciliation engine compares)
 *  - `canonicalKey`          the `CANONICAL_FIELD_REGISTRY_V1` key (materialization),
 *                            or an `annotation.*` sentinel for document-scoped fields
 *                            that have no shipment column
 *
 * `src/lib/documents/fieldDictionary.ts` exposes the lookups built from this table.
 *
 * Original drift keys documented in docs/plans/LLM-UNIVERSAL-FIELD-HYDRATION.md.
 */

import type { FieldInventoryItem } from "../types/canonicalRegistry";

const CI = "Commercial Invoice";
const PACK = "Packing List";
const BOL = "Bill of Lading";
const AWB = "Air Waybill";
const COO = "Certificate of Origin";
const ISF = "ISF";
const ENTRY = "Entry Summary";

export const FIELD_INVENTORY: FieldInventoryItem[] = [
  // ---------------------------------------------------------------------------
  // SHIPMENT SCALARS — materialized onto a Shipment column via the registry
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
    scope: "shipment",
    docTypes: [BOL, AWB, CI],
    notes:
      "Drift: tradeMetadata uses 'carrier', field-review map expects 'carrierName', Shipment column is 'carrierName'.",
  },
  {
    legacyKey: "originCountry",
    tradeMetadataKey: "originCountry",
    fieldReviewLabel: "Country of Origin",
    directShipmentColumn: "countryOfOrigin",
    factFieldName: "countryOfOrigin",
    canonicalKey: "shipment.originCountry",
    entityKind: "SHIPMENT",
    isDriftKey: false,
    scope: "shipment",
    extractionSchemaKeys: ["country_of_origin"],
    reconciliationKey: "countryOfOrigin",
    docTypes: [CI, COO, PACK, ISF],
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
    scope: "shipment",
    docTypes: [CI, BOL],
  },
  {
    legacyKey: "countryOfExport",
    tradeMetadataKey: "countryOfExport",
    fieldReviewLabel: "Country of Export",
    canonicalKey: "annotation.countryOfExport",
    entityKind: "SHIPMENT",
    isDriftKey: false,
    scope: "document",
    docTypes: [CI],
    notes:
      "Distinct from destination. Historically the extractor aliased this to destinationCountry (finding #4).",
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
    scope: "shipment",
    extractionSchemaKeys: ["incoterm"],
    docTypes: [CI],
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
    scope: "shipment",
    extractionSchemaKeys: ["currency"],
    reconciliationKey: "currency",
    docTypes: [CI],
  },
  {
    legacyKey: "invoiceNumber",
    tradeMetadataKey: "invoiceNumber",
    fieldReviewLabel: "Invoice Number",
    factFieldName: "invoiceNumber",
    canonicalKey: "shipment.invoiceNumber",
    entityKind: "SHIPMENT",
    isDriftKey: false,
    scope: "shipment",
    extractionSchemaKeys: ["invoice_number"],
    reconciliationKey: "invoiceNumber",
    docTypes: [CI, PACK],
  },
  {
    legacyKey: "invoiceDate",
    tradeMetadataKey: "invoiceDate",
    fieldReviewLabel: "Invoice Date",
    factFieldName: "invoiceDate",
    canonicalKey: "shipment.invoiceDate",
    entityKind: "SHIPMENT",
    isDriftKey: false,
    scope: "shipment",
    extractionSchemaKeys: ["invoice_date"],
    docTypes: [CI],
  },
  {
    legacyKey: "invoiceSubtotal",
    tradeMetadataKey: "invoiceSubtotal",
    fieldReviewLabel: "Total Invoice Amount",
    factFieldName: "totalAmount",
    canonicalKey: "shipment.financial.invoiceSubtotal",
    entityKind: "SHIPMENT",
    isDriftKey: true,
    scope: "shipment",
    extractionSchemaKeys: ["total_value"],
    reconciliationKey: "totalValue",
    docTypes: [CI],
    notes:
      "Drift: extracted as 'invoiceSubtotal' or 'totalAmount', Fact uses 'totalAmount', no dedicated Shipment column.",
  },

  // ---------------------------------------------------------------------------
  // PARTIES — resolved to a ShipmentParty role
  // ---------------------------------------------------------------------------
  {
    legacyKey: "exporterName",
    tradeMetadataKey: "exporterName",
    fieldReviewLabel: "Exporter / Shipper",
    factFieldName: "exporterName",
    canonicalKey: "party.exporter.name",
    entityKind: "PARTY_ROLE",
    isDriftKey: false,
    scope: "shipment",
    extractionSchemaKeys: ["seller_name", "exporter_name", "shipper_name"],
    reconciliationKey: "shipperName",
    docTypes: [CI, COO, BOL, AWB, ISF],
    notes: "Resolves EXPORTER party role via EntityResolutionService.",
  },
  {
    legacyKey: "importerName",
    tradeMetadataKey: "importerName",
    fieldReviewLabel: "Importer / Consignee",
    factFieldName: "importerName",
    canonicalKey: "party.importer.name",
    entityKind: "PARTY_ROLE",
    isDriftKey: false,
    scope: "shipment",
    extractionSchemaKeys: ["buyer_name", "consignee_name", "importer_name", "importer_of_record"],
    reconciliationKey: "consigneeName",
    docTypes: [CI, BOL, AWB, ISF, ENTRY],
    notes: "Resolves IMPORTER_OF_RECORD party role via EntityResolutionService.",
  },
  {
    legacyKey: "notifyParty",
    tradeMetadataKey: "notifyParty",
    fieldReviewLabel: "Notify Party",
    canonicalKey: "annotation.notifyParty",
    entityKind: "PARTY_ROLE",
    isDriftKey: false,
    scope: "document",
    reconciliationKey: "notifyParty",
    docTypes: [BOL],
  },

  // ---------------------------------------------------------------------------
  // TRANSPORT / TRACKING — document-scoped: no Shipment column, annotation only
  // ---------------------------------------------------------------------------
  {
    legacyKey: "transportDocumentNumber",
    tradeMetadataKey: "transportDocumentNumber",
    fieldReviewLabel: "Bill of Lading Number",
    factFieldName: "billOfLading",
    canonicalKey: "tracking.billOfLading",
    entityKind: "TRACKING_IDENTIFIER",
    isDriftKey: true,
    scope: "document",
    extractionSchemaKeys: ["bl_number"],
    reconciliationKey: "billOfLadingNumber",
    docTypes: [BOL],
    notes: "Drift: extracted as 'transportDocumentNumber' or 'billOfLading'; TrackingMaterializer is a stub.",
  },
  {
    legacyKey: "airWaybill",
    tradeMetadataKey: "airWaybill",
    fieldReviewLabel: "Air Waybill Number",
    factFieldName: "airWaybill",
    canonicalKey: "tracking.airWaybill",
    entityKind: "TRACKING_IDENTIFIER",
    isDriftKey: false,
    scope: "document",
    extractionSchemaKeys: ["awb_number"],
    docTypes: [AWB],
  },
  {
    legacyKey: "vesselName",
    tradeMetadataKey: "vesselName",
    fieldReviewLabel: "Vessel Name",
    canonicalKey: "annotation.vesselName",
    entityKind: "TRACKING_IDENTIFIER",
    isDriftKey: false,
    scope: "document",
    extractionSchemaKeys: ["vessel_name"],
    docTypes: [BOL],
  },
  {
    legacyKey: "voyageNumber",
    tradeMetadataKey: "voyageNumber",
    fieldReviewLabel: "Voyage Number",
    canonicalKey: "annotation.voyageNumber",
    entityKind: "TRACKING_IDENTIFIER",
    isDriftKey: false,
    scope: "document",
    extractionSchemaKeys: ["voyage"],
    docTypes: [BOL],
  },
  {
    legacyKey: "portOfLoading",
    tradeMetadataKey: "portOfLoading",
    fieldReviewLabel: "Port of Loading",
    canonicalKey: "annotation.portOfLoading",
    entityKind: "SHIPMENT",
    isDriftKey: false,
    scope: "document",
    extractionSchemaKeys: ["port_of_loading", "airport_of_origin"],
    docTypes: [BOL, AWB],
  },
  {
    legacyKey: "portOfDischarge",
    tradeMetadataKey: "portOfDischarge",
    fieldReviewLabel: "Port of Discharge",
    canonicalKey: "annotation.portOfDischarge",
    entityKind: "SHIPMENT",
    isDriftKey: false,
    scope: "document",
    extractionSchemaKeys: ["port_of_discharge", "airport_of_dest"],
    docTypes: [BOL, AWB],
  },
  {
    legacyKey: "containerNumber",
    tradeMetadataKey: "containerNumber",
    fieldReviewLabel: "Container Number",
    canonicalKey: "annotation.containerNumber",
    entityKind: "EQUIPMENT",
    isDriftKey: false,
    scope: "document",
    extractionSchemaKeys: ["container_numbers"],
    reconciliationKey: "containerNumber",
    docTypes: [BOL, PACK],
  },
  {
    legacyKey: "onBoardDate",
    tradeMetadataKey: "onBoardDate",
    fieldReviewLabel: "On-Board Date",
    canonicalKey: "annotation.onBoardDate",
    entityKind: "TRACKING_IDENTIFIER",
    isDriftKey: false,
    scope: "document",
    extractionSchemaKeys: ["on_board_date"],
    docTypes: [BOL],
  },

  // ---------------------------------------------------------------------------
  // CARGO — weight / quantity / packaging
  // ---------------------------------------------------------------------------
  {
    legacyKey: "totalWeight",
    tradeMetadataKey: "totalWeight",
    fieldReviewLabel: "Gross Weight",
    factFieldName: "grossWeight",
    canonicalKey: "shipment.cargo.grossWeight",
    entityKind: "SHIPMENT",
    isDriftKey: true,
    scope: "document",
    extractionSchemaKeys: ["gross_weight"],
    reconciliationKey: "grossWeight",
    docTypes: [PACK, BOL, AWB],
    notes: "Drift: tradeMetadata uses 'totalWeight', Fact uses 'grossWeight'. grossWeight column is not materializer-allowlisted → annotation scope.",
  },
  {
    legacyKey: "netWeight",
    tradeMetadataKey: "netWeight",
    fieldReviewLabel: "Net Weight",
    canonicalKey: "annotation.netWeight",
    entityKind: "SHIPMENT",
    isDriftKey: false,
    scope: "document",
    extractionSchemaKeys: ["net_weight"],
    reconciliationKey: "netWeight",
    docTypes: [PACK],
  },
  {
    legacyKey: "cartonCount",
    tradeMetadataKey: "cartonCount",
    fieldReviewLabel: "Carton Count",
    canonicalKey: "annotation.cartonCount",
    entityKind: "SHIPMENT",
    isDriftKey: false,
    scope: "document",
    extractionSchemaKeys: ["carton_count"],
    docTypes: [PACK],
  },
  {
    legacyKey: "totalQuantity",
    tradeMetadataKey: "totalQuantity",
    fieldReviewLabel: "Total Quantity",
    canonicalKey: "annotation.totalQuantity",
    entityKind: "SHIPMENT",
    isDriftKey: false,
    scope: "document",
    reconciliationKey: "totalQuantity",
    docTypes: [CI, PACK, BOL],
    notes: "Computed from the sum of extracted line-item quantities when the scalar is absent — this is what the invoice↔packing quantity reconciliation compares.",
  },

  // ---------------------------------------------------------------------------
  // LINE ITEMS
  // ---------------------------------------------------------------------------
  {
    legacyKey: "hsHtsCode",
    tradeMetadataKey: "hsHtsCode",
    fieldReviewLabel: "HTS Classification Code",
    factFieldName: "htsCode",
    canonicalKey: "lineItem[].htsCode",
    entityKind: "LINE_ITEM",
    isDriftKey: true,
    scope: "lineItem",
    extractionSchemaKeys: ["hs_code", "hs_6_code"],
    // No docTypes → excluded from per-document Field Review; HTS is reviewed
    // per line item in LineItemsTable, not per document (finding #3).
    docTypes: [],
    notes: "Drift: extracted as 'hsHtsCode', 'htsCode', or 'htsCandidate'; Fact uses 'htsCode'.",
  },
  { legacyKey: "lineNumber", factFieldName: "lineNumber", canonicalKey: "lineItem[].lineNumber", entityKind: "LINE_ITEM", isDriftKey: false, scope: "lineItem" },
  { legacyKey: "description", factFieldName: "description", canonicalKey: "lineItem[].description", entityKind: "LINE_ITEM", isDriftKey: false, scope: "lineItem" },
  { legacyKey: "quantity", factFieldName: "quantity", canonicalKey: "lineItem[].quantity", entityKind: "LINE_ITEM", isDriftKey: false, scope: "lineItem" },
  { legacyKey: "unitPrice", factFieldName: "unitPrice", canonicalKey: "lineItem[].unitPrice", entityKind: "LINE_ITEM", isDriftKey: false, scope: "lineItem" },

  // ---------------------------------------------------------------------------
  // FILING DRAFT & CUSTOMS
  // ---------------------------------------------------------------------------
  { legacyKey: "entryNumber", tradeMetadataKey: "entryNumber", factFieldName: "entryNumber", canonicalKey: "filing.entryNumber", entityKind: "FILING_DRAFT", isDriftKey: false, scope: "shipment", extractionSchemaKeys: ["entry_number"] },
  { legacyKey: "entryType", factFieldName: "entryType", canonicalKey: "filing.entryType", entityKind: "FILING_DRAFT", isDriftKey: false, scope: "shipment" },
  { legacyKey: "portOfEntry", tradeMetadataKey: "portOfEntry", factFieldName: "portOfEntry", canonicalKey: "filing.portOfEntry", entityKind: "FILING_DRAFT", isDriftKey: false, scope: "shipment", extractionSchemaKeys: ["port_of_entry"] },
];
