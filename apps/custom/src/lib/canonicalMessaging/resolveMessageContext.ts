import { db } from "@/lib/db";
import type { FilingMessageAction } from "./types";

export interface MessageContextInput {
  /**
   * Country-specific procedure code (e.g., "5100" for NL NCTS, "4000" for IN Import).
   * Required for new multi-country design.
   */
  procedureCode: string | null | undefined;

  /** ISO 3166-1 alpha-2 country code (NL, IE, FR, IN, etc.) */
  country: string | null | undefined;
}

export interface ResolvedMessageContext {
  transactionType: string;
  country: string;
  procedure: string;
  messageName: string;
}

/**
 * Derives the IMPORT/EXPORT wrapper type from a FilingSchema's schemaPath
 * (e.g. ".../filing-schemas/export/1.0.0/ExportDeclaration.schema.json").
 * Replaces the old FilingProcedureConfig.transactionType string column --
 * FilingProcedureConfig now points at a FilingSchema row via filingSchemaId,
 * and the schema path itself is the single source of truth for which
 * wrapper a procedure+message uses. Defaults to "IMPORT" when no schema is
 * linked, matching the previous column's default.
 */
function deriveTransactionTypeFromSchemaPath(schemaPath: string | null | undefined): string {
  if (schemaPath && schemaPath.toLowerCase().includes("export")) return "EXPORT";
  return "IMPORT";
}

/**
 * Derives country/procedure/messageName from filing data and the new
 * multi-country configuration tables (FilingProcedureConfig, FilingActionMessageMapping).
 * 
 * Replaces the old US-centric approach that used entryType + FilingProcedureMapping
 * + FilingMessageCatalog.
 * 
 * No caller may hardcode any of these values -- this is the single resolution point.
 */
export async function resolveMessageContext(
  input: MessageContextInput,
  action: FilingMessageAction
): Promise<ResolvedMessageContext> {
  // Validate required inputs
  const country = input.country?.trim().toUpperCase();
  if (!country) {
    throw new Error(
      "Cannot resolve message context: country is not set. " +
        "The destination country is never inferred -- set it explicitly."
    );
  }

  const procedureCode = input.procedureCode?.trim();
  if (!procedureCode) {
    throw new Error(
      "Cannot resolve message context: procedureCode is not set. " +
        "Set the country-specific procedure code explicitly (e.g., '5100' for NL NCTS)."
    );
  }

  // Look up the action → messageName mapping
  const actionMapping = await db.filingActionMessageMapping.findUnique({
    where: {
      country_procedureCode_action: {
        country,
        procedureCode,
        action,
      },
      isActive: true,
    },
  });

  if (!actionMapping) {
    // BACKWARDS COMPATIBILITY: Handle old US filings that haven't been migrated yet
    if (country === "US") {
      console.warn(
        `[resolveMessageContext] No action mapping found for US filing with ` +
        `procedureCode="${procedureCode}", action="${action}". ` +
        `This is expected for old filings not yet migrated. Using fallback.`
      );
      
      // Return fallback for US CBP entries (old system) -- no FilingProcedureConfig
      // row exists to read a real transactionType from, so fall back to IMPORT
      // (every pre-migration US filing this fallback serves was an import entry).
      return {
        transactionType: "IMPORT",
        country,
        procedure: procedureCode,
        messageName: "CBP_ENTRY_7501", // Generic US entry message (Form 7501)
      };
    }
    
    throw new Error(
      `No message mapping found for action "${action}", country "${country}", ` +
        `procedure "${procedureCode}". Add FilingActionMessageMapping configuration ` +
        `before filing to this destination.`
    );
  }

  // Verify the procedure + messageName combination exists
  const procedureConfig = await db.filingProcedureConfig.findUnique({
    where: {
      country_procedureCode_messageName: {
        country,
        procedureCode,
        messageName: actionMapping.messageName,
      },
      isActive: true,
    },
    include: { filingSchema: true },
  });

  if (!procedureConfig) {
    // BACKWARDS COMPATIBILITY: Skip validation for old US filings
    if (country === "US") {
      console.warn(
        `[resolveMessageContext] No procedure config found for US filing with ` +
        `procedureCode="${procedureCode}", messageName="${actionMapping.messageName}". ` +
        `This is expected for old filings not yet migrated. Skipping validation.`
      );
      
      return {
        transactionType: "IMPORT",
        country,
        procedure: procedureCode,
        messageName: actionMapping.messageName,
      };
    }

    throw new Error(
      `Procedure configuration not found for country "${country}", ` +
        `procedure "${procedureCode}", message "${actionMapping.messageName}". ` +
        `Add FilingProcedureConfig row before filing.`
    );
  }

  const transactionType = deriveTransactionTypeFromSchemaPath(procedureConfig.filingSchema?.schemaPath);

  const procedureCatalogRow = await db.filingProcedureCatalog.findFirst({
    where: { procedureCode: transactionType, isActive: true },
  });
  if (!procedureCatalogRow) {
    throw new Error(
      `Transaction type "${transactionType}" (derived from the FilingSchema linked to ` +
        `FilingProcedureConfig for country "${country}", procedure "${procedureCode}") is not a valid, ` +
        `active FilingProcedureCatalog procedure code. Valid codes: IMPORT, EXPORT, NCTS, TEMP_STORAGE, BONDED_WAREHOUSE, etc.`
    );
  }

  return {
    transactionType,
    country,
    procedure: procedureCode,
    messageName: actionMapping.messageName,
  };
}

/**
 * Looks up just the transactionType for a (country, procedureCode, messageName)
 * combination, for callers that already know their messageName and only need
 * the transaction type (e.g. to pick the ImportDeclaration/ExportDeclaration
 * wrapper) without running the full action → message resolution above.
 * Falls back to "IMPORT" when no config row exists (or none is linked to a
 * FilingSchema), matching the same backwards-compatibility default used for
 * unmigrated US filings.
 */
export async function resolveTransactionType(
  country: string | null | undefined,
  procedureCode: string | null | undefined,
  messageName: string | null | undefined
): Promise<string> {
  const normalizedCountry = country?.trim().toUpperCase();
  const normalizedProcedureCode = procedureCode?.trim();
  const normalizedMessageName = messageName?.trim();
  if (!normalizedCountry || !normalizedProcedureCode || !normalizedMessageName) {
    return "IMPORT";
  }

  const procedureConfig = await db.filingProcedureConfig.findUnique({
    where: {
      country_procedureCode_messageName: {
        country: normalizedCountry,
        procedureCode: normalizedProcedureCode,
        messageName: normalizedMessageName,
      },
      isActive: true,
    },
    include: { filingSchema: true },
  });

  return deriveTransactionTypeFromSchemaPath(procedureConfig?.filingSchema?.schemaPath);
}

