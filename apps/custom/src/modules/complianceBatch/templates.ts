// Bulk Compliance Screening -- saved column-mapping templates. Lets a
// tenant persist its own recurring header spellings (e.g. an ERP export)
// once and reuse them across uploads instead of relying purely on
// columns.ts's built-in alias table for every file.
import { db } from "@/lib/db";
import type { TransactionColumnField, ColumnMappingTemplateFields } from "./columns";

const VALID_FIELDS = new Set<string>([
  "transactionId",
  "lineNumber",
  "correlationId",
  "operationType",
  "partyName",
  "partyAddress",
  "partyCity",
  "partyCountry",
  "originCountry",
  "destinationCountry",
  "complianceCountry",
  "eccn",
  "hts",
  "quantity",
  "value",
  "currency",
  "governmentEndUser",
  "militaryEndUser",
  "productDescription",
  "materialComposition",
  "functionUsage",
  "principalUse",
  "partNumber",
  "brandModel",
] satisfies TransactionColumnField[]);

export class ComplianceBatchTemplateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComplianceBatchTemplateValidationError";
  }
}

/** Fail-closed: an unrecognized field name is rejected rather than silently stored and never matched against anything. */
function validateFieldMappings(raw: unknown): ColumnMappingTemplateFields {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ComplianceBatchTemplateValidationError("fieldMappings must be an object of field name -> header text.");
  }
  const result: ColumnMappingTemplateFields = {};
  for (const [field, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!VALID_FIELDS.has(field)) {
      throw new ComplianceBatchTemplateValidationError(`Unknown column mapping field "${field}".`);
    }
    if (typeof value !== "string" || !value.trim()) {
      throw new ComplianceBatchTemplateValidationError(`fieldMappings.${field} must be a non-empty string.`);
    }
    result[field as TransactionColumnField] = value.trim();
  }
  if (Object.keys(result).length === 0) {
    throw new ComplianceBatchTemplateValidationError("fieldMappings must map at least one field.");
  }
  return result;
}

export class ComplianceBatchTemplateService {
  static async list(accountId: string) {
    return db.complianceBatchColumnMappingTemplate.findMany({
      where: { accountId },
      orderBy: { name: "asc" },
    });
  }

  static async get(accountId: string, id: string) {
    return db.complianceBatchColumnMappingTemplate.findFirst({ where: { id, accountId } });
  }

  static async create(accountId: string, userId: string | null, name: string, rawFieldMappings: unknown) {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new ComplianceBatchTemplateValidationError("name is required.");
    }
    const fieldMappings = validateFieldMappings(rawFieldMappings);

    try {
      return await db.complianceBatchColumnMappingTemplate.create({
        data: {
          accountId,
          createdByUserId: userId,
          name: trimmedName,
          fieldMappings: fieldMappings as unknown as object,
        },
      });
    } catch (err) {
      if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002") {
        throw new ComplianceBatchTemplateValidationError(`A template named "${trimmedName}" already exists.`);
      }
      throw err;
    }
  }

  static async delete(accountId: string, id: string): Promise<boolean> {
    const result = await db.complianceBatchColumnMappingTemplate.deleteMany({ where: { id, accountId } });
    return result.count > 0;
  }
}
