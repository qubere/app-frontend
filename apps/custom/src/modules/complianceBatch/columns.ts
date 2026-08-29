// TRANSACTION_COMPLIANCE CSV -- column-alias mapping. Mirrors
// communityScreening/upload/columns.ts's alias approach; only the field set
// differs (transaction/party/classification/country facts instead of just
// party identity).
import { normalizeCountry, trimToNull } from "@/modules/party/partyNormalization";
import type { ClassificationType, TriState } from "@/modules/licenses/types";
import type { LicenseOperationType } from "@prisma/client";
import type { CanonicalComplianceRequest, ComplianceBatchServiceFlags } from "./types";

export type TransactionColumnField =
  | "transactionId"
  | "lineNumber"
  | "correlationId"
  | "operationType"
  | "partyName"
  | "partyAddress"
  | "partyCity"
  | "partyCountry"
  | "originCountry"
  | "destinationCountry"
  | "complianceCountry"
  | "eccn"
  | "hts"
  | "quantity"
  | "value"
  | "currency"
  | "governmentEndUser"
  | "militaryEndUser"
  | "productDescription"
  | "materialComposition"
  | "functionUsage"
  | "principalUse"
  | "partNumber"
  | "brandModel";

const COLUMN_ALIASES: Record<TransactionColumnField, readonly string[]> = {
  transactionId: ["transactionid", "transaction id"],
  lineNumber: ["linenumber", "line number", "line"],
  correlationId: ["correlationid", "correlation id"],
  operationType: ["operationtype", "operation type", "type"],
  partyName: ["partyname", "party name", "name"],
  partyAddress: ["partyaddress", "party address", "address", "addressline1", "address line 1"],
  partyCity: ["partycity", "party city", "city"],
  partyCountry: ["partycountry", "party country"],
  originCountry: ["origincountry", "origin country", "countryoforigin", "country of origin"],
  destinationCountry: ["destinationcountry", "destination country", "destination"],
  complianceCountry: ["compliancecountry", "compliance country", "shipfromcountry", "ship from country"],
  eccn: ["eccn"],
  hts: ["hts", "htscode", "hts code"],
  quantity: ["quantity", "qty"],
  value: ["value", "linevalue", "line value"],
  currency: ["currency"],
  governmentEndUser: ["governmentenduser", "government end user"],
  militaryEndUser: ["militaryenduser", "military end user"],
  productDescription: ["productdescription", "product description", "description"],
  materialComposition: ["materialcomposition", "material composition"],
  functionUsage: ["functionusage", "function usage", "function/usage", "function"],
  principalUse: ["principaluse", "principal use"],
  partNumber: ["partnumber", "part number"],
  brandModel: ["brandmodel", "brand/model", "brand model"],
};

function canonicalHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export interface TransactionColumnMapping {
  indexByField: Partial<Record<TransactionColumnField, number>>;
}

/** A tenant-saved header override per field (see ComplianceBatchColumnMappingTemplate) -- supplements, never replaces, the built-in alias table. */
export type ColumnMappingTemplateFields = Partial<Record<TransactionColumnField, string>>;

export function mapTransactionColumns(
  headers: readonly string[],
  templateFields?: ColumnMappingTemplateFields
): TransactionColumnMapping {
  const canonicalHeaders = headers.map(canonicalHeader);
  const indexByField: Partial<Record<TransactionColumnField, number>> = {};

  for (const field of Object.keys(COLUMN_ALIASES) as TransactionColumnField[]) {
    const templateHeader = templateFields?.[field];
    const aliases = COLUMN_ALIASES[field].map(canonicalHeader);
    if (templateHeader) aliases.push(canonicalHeader(templateHeader));
    const index = canonicalHeaders.findIndex((h) => aliases.includes(h));
    if (index >= 0) indexByField[field] = index;
  }

  return { indexByField };
}

function toTriState(raw: string | null): TriState | undefined {
  if (!raw) return undefined;
  const v = raw.trim().toUpperCase();
  if (v === "TRUE" || v === "FALSE" || v === "UNKNOWN") return v as TriState;
  return "UNKNOWN";
}

/** Row -> CanonicalComplianceRequest, plus the row's own validation errors (fail-closed: an unrecognized required field never becomes a guess). */
export function rowToCanonicalRequest(
  mapping: TransactionColumnMapping,
  row: readonly string[],
  rowNumber: number,
  serviceFlags: ComplianceBatchServiceFlags
): { request: CanonicalComplianceRequest | null; errors: string[] } {
  const get = (field: TransactionColumnField): string | null => {
    const index = mapping.indexByField[field];
    if (index === undefined) return null;
    return trimToNull(row[index] ?? "");
  };

  const errors: string[] = [];

  const partyName = get("partyName");
  const country = (raw: string | null) => (raw ? normalizeCountry(raw).code ?? raw : null);

  if (serviceFlags.partyScreening && !partyName) {
    errors.push("partyName is required when Party Screening is enabled.");
  }

  const eccn = get("eccn");
  const hts = get("hts");
  let classification: CanonicalComplianceRequest["classification"] = null;
  if (eccn) classification = { type: "ECCN" as ClassificationType, value: eccn };
  else if (hts) classification = { type: "HTS" as ClassificationType, value: hts };
  else if (serviceFlags.licenseScreening) {
    errors.push("A classification (ECCN or HTS column) is required when License Screening is enabled.");
  }

  const operationTypeRaw = (get("operationType") ?? "EXPORT").toUpperCase();
  if (operationTypeRaw !== "EXPORT" && operationTypeRaw !== "IMPORT") {
    errors.push(`operationType must be EXPORT or IMPORT, got "${operationTypeRaw}".`);
  }

  if (serviceFlags.embargoScreening && (!get("destinationCountry") || (!get("complianceCountry") && !get("originCountry")))) {
    errors.push("destinationCountry and complianceCountry (or originCountry) are required when Embargo Screening is enabled.");
  }

  const productDescription = get("productDescription");
  if (serviceFlags.productClassification && !productDescription) {
    errors.push("productDescription is required when Product Classification is enabled.");
  }

  if (errors.length > 0) return { request: null, errors };

  const request: CanonicalComplianceRequest = {
    transactionId: get("transactionId"),
    lineNumber: get("lineNumber") ? Number(get("lineNumber")) : null,
    correlationId: get("correlationId") ?? crypto.randomUUID(),
    party: partyName
      ? {
          name: partyName,
          address: get("partyAddress"),
          city: get("partyCity"),
          country: country(get("partyCountry")) ?? country(get("destinationCountry")),
        }
      : null,
    operationType: operationTypeRaw as LicenseOperationType,
    classification,
    originCountry: country(get("originCountry")),
    destinationCountry: country(get("destinationCountry")),
    complianceCountry: country(get("complianceCountry")) ?? country(get("originCountry")),
    conditions: {
      governmentEndUser: toTriState(get("governmentEndUser")),
      militaryEndUser: toTriState(get("militaryEndUser")),
    },
    quantity: get("quantity"),
    value: get("value"),
    currency: get("currency"),
    product: productDescription
      ? {
          description: productDescription,
          materialComposition: get("materialComposition"),
          functionUsage: get("functionUsage"),
          principalUse: get("principalUse"),
          partNumber: get("partNumber"),
          brandModel: get("brandModel"),
        }
      : null,
    serviceFlags,
  };

  return { request, errors: [] };
}
