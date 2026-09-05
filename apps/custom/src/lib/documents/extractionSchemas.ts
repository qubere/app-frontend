/**
 * Per-document-type extraction field schemas (C-2).
 *
 * Each entry names a field that the extraction pipeline must attempt to locate
 * in the document. `required: true` means the field's absence creates a
 * MISSING_DATA ExceptionItem (C-5). `type` drives downstream validation and
 * display formatting.
 */
import type { DocumentType } from "@prisma/client";

export type ExtractionFieldType = "string" | "number" | "date" | "array";

export interface ExtractionFieldSchema {
  fieldName: string;
  label: string;
  required: boolean;
  type: ExtractionFieldType;
}

export type ExtractionSchema = ExtractionFieldSchema[];

const COMMERCIAL_INVOICE_SCHEMA: ExtractionSchema = [
  { fieldName: "seller_name",     label: "Seller / Exporter",    required: true,  type: "string" },
  { fieldName: "buyer_name",      label: "Buyer / Consignee",    required: true,  type: "string" },
  { fieldName: "invoice_number",  label: "Invoice Number",        required: true,  type: "string" },
  { fieldName: "invoice_date",    label: "Invoice Date",          required: true,  type: "date"   },
  { fieldName: "currency",        label: "Currency",              required: true,  type: "string" },
  { fieldName: "total_value",     label: "Total Invoice Value",   required: true,  type: "number" },
  { fieldName: "incoterm",        label: "Incoterm",              required: false, type: "string" },
  { fieldName: "line_items",      label: "Line Items",            required: true,  type: "array"  },
];

const PACKING_LIST_SCHEMA: ExtractionSchema = [
  { fieldName: "carton_count",    label: "Carton Count",          required: true,  type: "number" },
  { fieldName: "gross_weight",    label: "Gross Weight",          required: true,  type: "number" },
  { fieldName: "net_weight",      label: "Net Weight",            required: false, type: "number" },
  { fieldName: "package_marks",   label: "Package Marks",         required: false, type: "string" },
];

const BILL_OF_LADING_SCHEMA: ExtractionSchema = [
  { fieldName: "bl_number",          label: "B/L Number",               required: true,  type: "string" },
  { fieldName: "vessel_name",        label: "Vessel Name",               required: true,  type: "string" },
  { fieldName: "voyage",             label: "Voyage Number",             required: false, type: "string" },
  { fieldName: "port_of_loading",    label: "Port of Loading",           required: true,  type: "string" },
  { fieldName: "port_of_discharge",  label: "Port of Discharge",         required: true,  type: "string" },
  { fieldName: "container_numbers",  label: "Container Numbers",         required: false, type: "array"  },
  { fieldName: "on_board_date",      label: "On-Board Date",             required: true,  type: "date"   },
];

const AIR_WAYBILL_SCHEMA: ExtractionSchema = [
  { fieldName: "awb_number",         label: "AWB Number",                required: true,  type: "string" },
  { fieldName: "shipper_name",       label: "Shipper",                   required: true,  type: "string" },
  { fieldName: "consignee_name",     label: "Consignee",                 required: true,  type: "string" },
  { fieldName: "airport_of_origin",  label: "Airport of Departure",      required: true,  type: "string" },
  { fieldName: "airport_of_dest",    label: "Airport of Destination",    required: true,  type: "string" },
  { fieldName: "gross_weight",       label: "Gross Weight",              required: true,  type: "number" },
];

const CERTIFICATE_OF_ORIGIN_SCHEMA: ExtractionSchema = [
  { fieldName: "exporter_name",      label: "Exporter",                  required: true,  type: "string" },
  { fieldName: "consignee_name",     label: "Consignee",                 required: true,  type: "string" },
  { fieldName: "country_of_origin",  label: "Country of Origin",         required: true,  type: "string" },
  { fieldName: "goods_description",  label: "Description of Goods",      required: true,  type: "string" },
  { fieldName: "hs_code",            label: "HS Code",                   required: false, type: "string" },
];

const PHYTOSANITARY_SCHEMA: ExtractionSchema = [
  { fieldName: "issuing_authority",  label: "Issuing Authority",         required: true,  type: "string" },
  { fieldName: "exporter_name",      label: "Exporter",                  required: true,  type: "string" },
  { fieldName: "goods_description",  label: "Description of Goods",      required: true,  type: "string" },
  { fieldName: "issue_date",         label: "Issue Date",                required: true,  type: "date"   },
];

const FUMIGATION_SCHEMA: ExtractionSchema = [
  { fieldName: "treatment_method",   label: "Treatment Method",          required: true,  type: "string" },
  { fieldName: "chemical_used",      label: "Chemical / Fumigant",       required: true,  type: "string" },
  { fieldName: "treatment_date",     label: "Treatment Date",            required: true,  type: "date"   },
  { fieldName: "goods_description",  label: "Description of Goods",      required: true,  type: "string" },
];

const CUSTOMS_BOND_SCHEMA: ExtractionSchema = [
  { fieldName: "bond_number",        label: "Bond Number",               required: true,  type: "string" },
  { fieldName: "surety_name",        label: "Surety Company",            required: true,  type: "string" },
  { fieldName: "bond_amount",        label: "Bond Amount",               required: true,  type: "number" },
  { fieldName: "effective_date",     label: "Effective Date",            required: true,  type: "date"   },
];

const POWER_OF_ATTORNEY_SCHEMA: ExtractionSchema = [
  { fieldName: "grantor_name",       label: "Grantor",                   required: true,  type: "string" },
  { fieldName: "grantee_name",       label: "Grantee (Broker)",          required: true,  type: "string" },
  { fieldName: "effective_date",     label: "Effective Date",            required: false, type: "date"   },
];

const ENTRY_SUMMARY_SCHEMA: ExtractionSchema = [
  { fieldName: "entry_number",       label: "Entry Number",              required: true,  type: "string" },
  { fieldName: "entry_date",         label: "Entry Date",                required: true,  type: "date"   },
  { fieldName: "importer_name",      label: "Importer of Record",        required: true,  type: "string" },
  { fieldName: "port_of_entry",      label: "Port of Entry",             required: true,  type: "string" },
  { fieldName: "total_duties",       label: "Total Duties & Taxes",      required: true,  type: "number" },
];

const ISF_SCHEMA: ExtractionSchema = [
  { fieldName: "importer_of_record", label: "Importer of Record",        required: true,  type: "string" },
  { fieldName: "seller_name",        label: "Seller",                    required: true,  type: "string" },
  { fieldName: "buyer_name",         label: "Buyer",                     required: true,  type: "string" },
  { fieldName: "manufacturer_name",  label: "Manufacturer",              required: true,  type: "string" },
  { fieldName: "ship_to_party",      label: "Ship-to Party",             required: true,  type: "string" },
  { fieldName: "country_of_origin",  label: "Country of Origin",         required: true,  type: "string" },
  { fieldName: "hs_6_code",          label: "HS-6 Code",                 required: true,  type: "string" },
  { fieldName: "container_stuffing", label: "Container Stuffing Location", required: true, type: "string" },
  { fieldName: "consolidator_name",  label: "Consolidator",              required: false, type: "string" },
];

const FORWARDING_INSTRUCTION_SCHEMA: ExtractionSchema = [
  { fieldName: "instruction_reference", label: "Instruction Reference",   required: true,  type: "string" },
  { fieldName: "instruction_date",      label: "Instruction Date",        required: true,  type: "date"   },
  { fieldName: "exporter_name",         label: "Exporter",                required: true,  type: "string" },
  { fieldName: "consignee_name",        label: "Consignee",               required: true,  type: "string" },
  { fieldName: "booking_number",        label: "Booking Number",          required: false, type: "string" },
  { fieldName: "vessel_name",           label: "Vessel Name",             required: false, type: "string" },
  { fieldName: "port_of_loading",       label: "Port of Loading",         required: true,  type: "string" },
  { fieldName: "port_of_discharge",     label: "Port of Discharge",       required: true,  type: "string" },
  { fieldName: "final_destination",     label: "Final Destination",       required: false, type: "string" },
  { fieldName: "container_count",       label: "Container Count",         required: false, type: "number" },
  { fieldName: "goods_description",     label: "Description of Goods",    required: true,  type: "string" },
];

const BOOKING_REQUEST_SCHEMA: ExtractionSchema = [
  { fieldName: "booking_number",        label: "Booking Number",          required: true,  type: "string" },
  { fieldName: "shipper_name",          label: "Shipper",                 required: true,  type: "string" },
  { fieldName: "consignee_name",        label: "Consignee",               required: true,  type: "string" },
  { fieldName: "carrier_name",          label: "Carrier",                 required: false, type: "string" },
  { fieldName: "mode_of_transport",     label: "Mode of Transport",       required: false, type: "string" },
  { fieldName: "port_of_loading",       label: "Port of Loading",         required: true,  type: "string" },
  { fieldName: "port_of_discharge",     label: "Port of Discharge",       required: true,  type: "string" },
  { fieldName: "cutoff_date",           label: "Cutoff Date",             required: false, type: "date"   },
  { fieldName: "etd",                   label: "ETD",                     required: false, type: "date"   },
  { fieldName: "eta",                   label: "ETA",                     required: false, type: "date"   },
  { fieldName: "container_count",       label: "Container Count",         required: false, type: "number" },
];

const ARRIVAL_NOTICE_SCHEMA: ExtractionSchema = [
  { fieldName: "arrival_notice_number", label: "Arrival Notice Number",   required: true,  type: "string" },
  { fieldName: "notice_date",           label: "Notice Date",             required: true,  type: "date"   },
  { fieldName: "bol_or_awb_reference",  label: "B/L or AWB Reference",    required: true,  type: "string" },
  { fieldName: "consignee_name",        label: "Consignee",               required: true,  type: "string" },
  { fieldName: "carrier_name",          label: "Carrier",                 required: false, type: "string" },
  { fieldName: "vessel_name",           label: "Vessel / Flight",         required: false, type: "string" },
  { fieldName: "estimated_arrival_date", label: "Estimated Arrival Date", required: true,  type: "date"   },
  { fieldName: "last_free_date",        label: "Last Free Date",         required: false, type: "date"   },
  { fieldName: "release_status",        label: "Release Status",         required: false, type: "string" },
  { fieldName: "gross_weight",          label: "Gross Weight",           required: false, type: "number" },
];

const PURCHASE_ORDER_SCHEMA: ExtractionSchema = [
  { fieldName: "po_number",             label: "Purchase Order Number",   required: true,  type: "string" },
  { fieldName: "po_date",               label: "Purchase Order Date",     required: true,  type: "date"   },
  { fieldName: "buyer_name",            label: "Buyer",                   required: true,  type: "string" },
  { fieldName: "seller_name",           label: "Seller",                  required: true,  type: "string" },
  { fieldName: "currency",              label: "Currency",                required: false, type: "string" },
  { fieldName: "total_value",           label: "Total Order Value",       required: false, type: "number" },
  { fieldName: "line_items",            label: "Line Items",              required: true,  type: "array"  },
];

const DELIVERY_NOTE_SCHEMA: ExtractionSchema = [
  { fieldName: "delivery_note_number",  label: "Delivery Note Number",    required: true,  type: "string" },
  { fieldName: "delivery_note_date",    label: "Delivery Note Date",      required: true,  type: "date"   },
  { fieldName: "consignee_name",        label: "Consignee",               required: true,  type: "string" },
  { fieldName: "delivery_location",     label: "Delivery Location",       required: false, type: "string" },
  { fieldName: "carrier_name",          label: "Carrier",                 required: false, type: "string" },
  { fieldName: "total_quantity",        label: "Total Quantity",          required: false, type: "number" },
  { fieldName: "received_by",           label: "Received By",             required: false, type: "string" },
  { fieldName: "received_date",         label: "Received Date",           required: false, type: "date"   },
  { fieldName: "line_items",            label: "Line Items",              required: true,  type: "array"  },
];

const SHIPPING_INSTRUCTION_SCHEMA: ExtractionSchema = [
  { fieldName: "instruction_number",    label: "Instruction Number",      required: true,  type: "string" },
  { fieldName: "instruction_date",      label: "Instruction Date",        required: true,  type: "date"   },
  { fieldName: "shipper_name",          label: "Shipper",                 required: true,  type: "string" },
  { fieldName: "consignee_name",        label: "Consignee",               required: true,  type: "string" },
  { fieldName: "booking_number",        label: "Booking Number",          required: false, type: "string" },
  { fieldName: "port_of_loading",       label: "Port of Loading",         required: true,  type: "string" },
  { fieldName: "port_of_discharge",     label: "Port of Discharge",       required: true,  type: "string" },
  { fieldName: "requested_sailing_date", label: "Requested Sailing Date", required: false, type: "date"   },
  { fieldName: "goods_description",     label: "Description of Goods",    required: false, type: "string" },
];

const CMR_SCHEMA: ExtractionSchema = [
  { fieldName: "cmr_number",            label: "CMR Number",              required: true,  type: "string" },
  { fieldName: "issue_date",            label: "Issue Date",              required: true,  type: "date"   },
  { fieldName: "sender_name",           label: "Sender",                  required: true,  type: "string" },
  { fieldName: "carrier_name",          label: "Carrier",                 required: true,  type: "string" },
  { fieldName: "consignee_name",        label: "Consignee",               required: true,  type: "string" },
  { fieldName: "place_of_taking_over_goods", label: "Place of Taking Over Goods", required: false, type: "string" },
  { fieldName: "place_of_delivery",     label: "Place of Delivery",       required: true,  type: "string" },
  { fieldName: "vehicle_registration",  label: "Vehicle Registration",    required: false, type: "string" },
  { fieldName: "goods_lines",           label: "Goods Lines",             required: true,  type: "array"  },
];

const SEA_WAYBILL_SCHEMA: ExtractionSchema = [
  { fieldName: "sea_waybill_number",    label: "Sea Waybill Number",      required: true,  type: "string" },
  { fieldName: "shipper_name",          label: "Shipper",                 required: true,  type: "string" },
  { fieldName: "consignee_name",        label: "Consignee",               required: true,  type: "string" },
  { fieldName: "vessel_name",           label: "Vessel Name",             required: false, type: "string" },
  { fieldName: "port_of_loading",       label: "Port of Loading",         required: true,  type: "string" },
  { fieldName: "port_of_discharge",     label: "Port of Discharge",       required: true,  type: "string" },
  { fieldName: "on_board_date",         label: "On-Board Date",           required: false, type: "date"   },
  { fieldName: "gross_weight",          label: "Gross Weight",            required: false, type: "number" },
];

/**
 * Also used for EXPORT_DECLARATION and IMPORT_DECLARATION: the spec calls
 * these out as distinct document types but gives no field list separate from
 * CUSTOMS_ENTRY_V1 (both are government customs-filing variants of the same
 * declaration facts) — reusing the customs-entry schema follows the spec's
 * own "base document + jurisdiction overlay" composition principle rather
 * than inventing a distinct field set that was never specified.
 */
const CUSTOMS_ENTRY_SCHEMA: ExtractionSchema = [
  { fieldName: "entry_number",          label: "Entry / Declaration Number", required: true, type: "string" },
  { fieldName: "filing_date",           label: "Filing Date",             required: true,  type: "date"   },
  { fieldName: "importer_name",         label: "Importer / Declarant",    required: true,  type: "string" },
  { fieldName: "port_of_entry",         label: "Customs Office / Port of Entry", required: true, type: "string" },
  { fieldName: "total_customs_value",   label: "Total Customs Value",     required: true,  type: "number" },
  { fieldName: "total_duty",            label: "Total Duty",              required: false, type: "number" },
  { fieldName: "total_tax",             label: "Total Tax",               required: false, type: "number" },
  { fieldName: "release_status",        label: "Release Status",          required: false, type: "string" },
  { fieldName: "line_items",            label: "Tariff Lines",            required: true,  type: "array"  },
];

const EUR1_CERTIFICATE_SCHEMA: ExtractionSchema = [
  { fieldName: "certificate_number",    label: "Certificate Number",      required: true,  type: "string" },
  { fieldName: "issue_date",            label: "Issue Date",              required: true,  type: "date"   },
  { fieldName: "exporter_name",         label: "Exporter",                required: true,  type: "string" },
  { fieldName: "consignee_name",        label: "Consignee",               required: true,  type: "string" },
  { fieldName: "origin_country",        label: "Origin Country / Group",  required: true,  type: "string" },
  { fieldName: "destination_country",   label: "Destination Country / Group", required: false, type: "string" },
  { fieldName: "invoice_reference",     label: "Invoice Reference",       required: false, type: "string" },
  { fieldName: "customs_endorsement",   label: "Customs Endorsement",     required: false, type: "string" },
  { fieldName: "goods_description",     label: "Description of Goods",    required: true,  type: "string" },
];

const ATR_CERTIFICATE_SCHEMA: ExtractionSchema = [
  { fieldName: "certificate_number",    label: "Certificate Number",      required: true,  type: "string" },
  { fieldName: "issue_date",            label: "Issue Date",              required: true,  type: "date"   },
  { fieldName: "exporter_name",         label: "Exporter",                required: true,  type: "string" },
  { fieldName: "consignee_name",        label: "Consignee",               required: true,  type: "string" },
  { fieldName: "exporting_country",     label: "Exporting Country",       required: true,  type: "string" },
  { fieldName: "destination_country",   label: "Destination Country",     required: false, type: "string" },
  { fieldName: "goods_description",     label: "Description of Goods",    required: true,  type: "string" },
  { fieldName: "customs_endorsement",   label: "Customs Endorsement",     required: false, type: "string" },
];

const SCHEMAS: Partial<Record<DocumentType, ExtractionSchema>> = {
  COMMERCIAL_INVOICE:       COMMERCIAL_INVOICE_SCHEMA,
  PACKING_LIST:             PACKING_LIST_SCHEMA,
  BILL_OF_LADING:           BILL_OF_LADING_SCHEMA,
  AIR_WAYBILL:              AIR_WAYBILL_SCHEMA,
  CERTIFICATE_OF_ORIGIN:    CERTIFICATE_OF_ORIGIN_SCHEMA,
  PHYTOSANITARY_CERTIFICATE: PHYTOSANITARY_SCHEMA,
  FUMIGATION_CERTIFICATE:   FUMIGATION_SCHEMA,
  CUSTOMS_BOND:             CUSTOMS_BOND_SCHEMA,
  POWER_OF_ATTORNEY:        POWER_OF_ATTORNEY_SCHEMA,
  ENTRY_SUMMARY:            ENTRY_SUMMARY_SCHEMA,
  ISF:                      ISF_SCHEMA,
  FORWARDING_INSTRUCTION:   FORWARDING_INSTRUCTION_SCHEMA,
  BOOKING_REQUEST:          BOOKING_REQUEST_SCHEMA,
  ARRIVAL_NOTICE:           ARRIVAL_NOTICE_SCHEMA,
  PURCHASE_ORDER:           PURCHASE_ORDER_SCHEMA,
  DELIVERY_NOTE:            DELIVERY_NOTE_SCHEMA,
  SHIPPING_INSTRUCTION:     SHIPPING_INSTRUCTION_SCHEMA,
  CMR:                      CMR_SCHEMA,
  SEA_WAYBILL:              SEA_WAYBILL_SCHEMA,
  CUSTOMS_ENTRY:            CUSTOMS_ENTRY_SCHEMA,
  EUR1_CERTIFICATE:         EUR1_CERTIFICATE_SCHEMA,
  ATR_CERTIFICATE:          ATR_CERTIFICATE_SCHEMA,
  EXPORT_DECLARATION:       CUSTOMS_ENTRY_SCHEMA,
  IMPORT_DECLARATION:       CUSTOMS_ENTRY_SCHEMA,
  // OTHER has no required fields — extraction is opportunistic.
};

/**
 * One version number per document type's field list, bumped whenever that
 * type's `_SCHEMA` array above gains, loses, or renames a field. A type
 * absent here has never changed since it was added -- version 1.
 *
 * This is a traceability signal only: it does not gate anything today. It
 * lets a future consumer (e.g. a re-review sweep after a schema change) ask
 * "which extractions were reviewed against an older field list" without
 * guessing from a git log.
 */
const SCHEMA_VERSIONS: Partial<Record<DocumentType, number>> = {};

/**
 * The field-list version currently in force for a document type. Types with
 * no entry in `SCHEMA_VERSIONS` are version 1 (their original definition).
 */
export function getSchemaVersion(docType: DocumentType | null | undefined): number {
  if (!docType) return 1;
  return SCHEMA_VERSIONS[docType] ?? 1;
}

/**
 * Returns the extraction schema for a given document type.
 * Returns an empty array for OTHER or unknown types.
 */
export function getExtractionSchema(docType: DocumentType | null | undefined): ExtractionSchema {
  if (!docType) return [];
  return SCHEMAS[docType] ?? [];
}

/**
 * Returns only the fields marked `required: true` for a document type.
 */
export function getRequiredFields(docType: DocumentType | null | undefined): ExtractionFieldSchema[] {
  return getExtractionSchema(docType).filter((f) => f.required);
}

/**
 * Whether a field belongs on a document type at all, and if so whether it's
 * required. A field absent from the schema (or a doc type with no schema,
 * e.g. OTHER) is NOT_EXPECTED — distinct from a required field the pipeline
 * simply failed to locate, which is what `evaluateFieldVerification` in
 * `extractionReview.ts` calls MISSING_REQUIRED.
 */
export type FieldExpectation = "EXPECTED" | "OPTIONAL" | "NOT_EXPECTED";

export function getFieldExpectation(
  docType: DocumentType | null | undefined,
  fieldName: string
): FieldExpectation {
  const entry = getExtractionSchema(docType).find((f) => f.fieldName === fieldName);
  if (!entry) return "NOT_EXPECTED";
  return entry.required ? "EXPECTED" : "OPTIONAL";
}

/**
 * Doc-type-specific field guidance for the extraction prompt, built from the
 * same schema `getRequiredFields`/`getFieldExpectation` already use for
 * post-hoc review. Returns null when there is no schema for this type (e.g.
 * OTHER, PROOF_OF_DELIVERY, CARRIER_INVOICE) — the caller falls back to its
 * generic instructions in that case rather than emitting an empty section.
 *
 * This only ever narrows the model's attention toward fields this document
 * type is known to carry; it does not replace or restrict the universal
 * response schema, so nothing else the pipeline extracts (entities, tables,
 * line items, filing determination) is affected.
 */
export function buildSchemaScopedInstructions(docType: DocumentType | null | undefined): string | null {
  const schema = getExtractionSchema(docType);
  if (schema.length === 0) return null;

  const required = schema.filter((f) => f.required).map((f) => f.label);
  const optional = schema.filter((f) => !f.required).map((f) => f.label);

  const lines = [
    `This document was classified as ${docType}. For this document type, prioritize locating:`,
    `- Required: ${required.join(", ")}`,
  ];
  if (optional.length > 0) {
    lines.push(`- Optional (capture if present): ${optional.join(", ")}`);
  }
  lines.push(
    "If a required field genuinely does not appear anywhere on the document, leave it null and list it in missingCriticalFields — do not force a value onto a field this document type doesn't carry, and do not invent one."
  );
  return lines.join("\n");
}
