import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { z } from "zod";

/**
 * Every genuinely global (non-tenant-scoped) reference table the filing
 * workflow reads from. FilingSchemaVersion is deliberately excluded --
 * schemas are authored as version-controlled files and loaded via
 * migration/seed only, never edited live through a runtime admin surface.
 * FilingMessage is excluded too: it's an audit/queue log of real messages,
 * not configuration.
 * 
 * MULTI-COUNTRY MIGRATION NOTE:
 * Many old tables have been dropped and replaced with new design.
 * Commented out entries reference dropped tables.
 */
export type FilingConfigTableKey =
  // NEW TABLES (multi-country design)
  | "procedure-catalog"
  | "action-catalog"
  | "procedure-config"
  | "action-message-mapping"
  | "action-configuration"
  | "ui-configuration"
  | "master-data-source"
  // KEPT TABLES
  | "action-data-requirement"
  // CUSTOMS VERSION MANAGEMENT
  | "country-customs-version"
  | "customer-customs-version"
  // STATUS CATALOG (with multi-language descriptions)
  | "status-catalog"
  // CUSTOMS CODE LIST MASTERS
  | "code-list-type"
  | "code-list"
  // DROPPED TABLES (commented out - kept for reference)
  // | "procedure-mapping" // DROPPED - replaced by procedure-config
  // | "authority-config" // DROPPED - authority names in UI layer
  // | "message-catalog" // DROPPED - replaced by action-message-mapping
  // | "response-status-mapping" // DROPPED - response handling redesigned
  // | "action-rule" // DROPPED - merged into action-configuration
  // | "child-action-rule" // DROPPED - merged into action-configuration
  // | "message-action-catalog"; // DROPPED - replaced by action-catalog


/**
 * The shape of one entry inside a "fieldArray" column -- e.g. one required
 * field of an action-data requirement. type "fieldArray" here makes THIS
 * sub-field itself a nested list (e.g. a "columns" property whose own rows
 * need describing) -- if itemFields is omitted for a nested fieldArray, the
 * editor reuses its own current itemFields, which is how an arbitrarily deep
 * tree (GoodsItem -> Packages -> ...) renders without the server having to
 * serialize a circular structure across the server/client boundary.
 */
export interface SubFieldDef {
  key: string;
  label: string;
  type: "text" | "boolean" | "select" | "fieldArray";
  options?: string[];
  help?: string;
  itemFields?: SubFieldDef[];
}

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "boolean" | "fieldArray" | "date" | "select";
  help?: string;
  /** Only present when type === "fieldArray": the shape of each entry in the array. */
  itemFields?: SubFieldDef[];
  /** Only present when type === "select": options for dropdown */
  options?: Array<{ value: string; label: string }>;
  /** Only present when type === "select": map of option values to readable labels */
  optionLabels?: Record<string, string>;
  /** Only present when type === "select" and options is omitted: API path to fetch `{ codes: string[] }` from. */
  optionsSource?: string;
}

interface TableDef<TRow> {
  label: string;
  description: string;
  idField: string;
  fields: FieldDef[];
  list(): Promise<TRow[]>;
  create(data: Record<string, unknown>): Promise<TRow>;
  update(id: string, data: Record<string, unknown>): Promise<TRow>;
  remove(id: string): Promise<void>;
  createSchema: z.ZodTypeAny;
  updateSchema: z.ZodTypeAny;
}

// ============================================================================
// NEW MULTI-COUNTRY SCHEMAS
// ============================================================================

const procedureCatalogSchema = z.object({
  procedureCode: z.string().trim().min(1).max(50),
  isActive: z.boolean(),
  createdBy: z.string().trim().max(100).optional(),
  updatedBy: z.string().trim().max(100).optional(),
});

const actionCatalogSchema = z.object({
  code: z.string().trim().min(1).max(50),
  isActive: z.boolean(),
  createdBy: z.string().trim().max(100).optional(),
  updatedBy: z.string().trim().max(100).optional(),
});

const procedureConfigSchema = z.object({
  country: z.string().trim().min(1).max(50),
  procedureCode: z.string().trim().min(1).max(50),
  messageName: z.string().trim().min(1).max(100),
  isActive: z.boolean(),
  createdBy: z.string().trim().max(100).optional(),
  updatedBy: z.string().trim().max(100).optional(),
});

const actionMessageMappingSchema = z.object({
  country: z.string().trim().min(1).max(50),
  procedureCode: z.string().trim().min(1).max(50),
  action: z.string().trim().min(1).max(50),
  messageName: z.string().trim().min(1).max(100),
  isActive: z.boolean(),
  createdBy: z.string().trim().max(100).optional(),
  updatedBy: z.string().trim().max(100).optional(),
});

const actionConfigurationSchema = z.object({
  country: z.string().trim().min(1).max(50),
  procedureCode: z.string().trim().min(1).max(50),
  messageName: z.string().trim().min(1).max(100),
  release: z.string().trim().max(50).optional().nullable().transform(val => val || null),
  status: z.string().trim().min(1).max(50),
  availableActions: z.array(z.string().trim().min(1).max(50)).max(20),
  allowSubmit: z.boolean(),
  isActive: z.boolean(),
  createdBy: z.string().trim().max(100).optional(),
  updatedBy: z.string().trim().max(100).optional(),
});

// FilingStatusCatalog.localeDescription is stored as a JSON key-value map
// (locale code -> translated description), but the generic fieldArray editor
// in FilingConfigClient only knows how to edit a list of flat entries, so the
// wire/UI shape is an array of { locale, description } rows -- converted
// to/from the map at the registry boundary (see localeArrayToMap/localeMapToArray).
const localeDescriptionEntrySchema = z.object({
  locale: z.string().trim().min(1).max(20),
  description: z.string().trim().min(1).max(500),
});

const statusCatalogCreateSchema = z.object({
  statusCode: z.string().trim().min(1).max(20),
  defaultDescription: z.string().trim().min(1).max(200),
  localeDescriptions: z.array(localeDescriptionEntrySchema).max(50).default([]),
  createdBy: z.string().trim().max(100).optional(),
});

const statusCatalogUpdateSchema = z.object({
  statusCode: z.string().trim().min(1).max(20).optional(),
  defaultDescription: z.string().trim().min(1).max(200).optional(),
  localeDescriptions: z.array(localeDescriptionEntrySchema).max(50).optional(),
  updatedBy: z.string().trim().max(100).optional(),
});

function localeArrayToMap(entries: Array<{ locale: string; description: string }>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const { locale, description } of entries) {
    if (locale) map[locale] = description;
  }
  return map;
}

function localeMapToArray(map: unknown): Array<{ locale: string; description: string }> {
  if (!map || typeof map !== "object") return [];
  return Object.entries(map as Record<string, unknown>).map(([locale, description]) => ({
    locale,
    description: String(description ?? ""),
  }));
}

// Customs code list masters (FilingCodeListType / Header). Item and
// Translation schemas live in codeListService.ts, next to the hierarchical
// create/update logic they're paired with -- unlike Type/Header, those two
// are never edited through the flat generic /api/filing-config/[table]
// route, only through the dedicated code-list-headers/items endpoints.
const codeListTypeCreateSchema = z.object({
  listType: z.string().trim().min(1).max(50),
  listTypeName: z.string().trim().min(1).max(150),
  description: z.string().trim().max(2000).optional(),
  isActive: z.boolean().default(true),
  createdBy: z.string().trim().max(100).optional(),
});

const codeListTypeUpdateSchema = z.object({
  listTypeName: z.string().trim().min(1).max(150).optional(),
  description: z.string().trim().max(2000).optional(),
  isActive: z.boolean().optional(),
  updatedBy: z.string().trim().max(100).optional(),
});

const codeListHeaderCreateSchema = z
  .object({
    countryIso2: z.string().trim().length(2).toUpperCase(),
    procedureCode: z.string().trim().min(1).max(20),
    listType: z.string().trim().min(1).max(50),
    version: z.string().trim().min(1).max(30),
    effectiveFrom: z.string().min(1),
    effectiveTo: z.string().trim().min(1).optional().nullable(),
    isActive: z.boolean().default(true),
    createdBy: z.string().trim().max(100).optional(),
  })
  .refine((data) => !data.effectiveTo || new Date(data.effectiveTo) > new Date(data.effectiveFrom), {
    message: "Effective To must be after Effective From",
    path: ["effectiveTo"],
  });

const codeListHeaderUpdateSchema = z.object({
  countryIso2: z.string().trim().length(2).toUpperCase().optional(),
  procedureCode: z.string().trim().min(1).max(20).optional(),
  listType: z.string().trim().min(1).max(50).optional(),
  version: z.string().trim().min(1).max(30).optional(),
  effectiveFrom: z.string().min(1).optional(),
  effectiveTo: z.string().trim().min(1).optional().nullable(),
  isActive: z.boolean().optional(),
  updatedBy: z.string().trim().max(100).optional(),
});

// ============================================================================
// OLD SCHEMAS (commented out - tables dropped)
// ============================================================================

// const procedureMappingSchema = z.object({
//   entryType: z.string().trim().min(1).max(50),
//   country: z.string().trim().min(1).max(50),
//   procedureCode: z.string().trim().min(1).max(50),
// });

// const authorityConfigSchema = z.object({
//   country: z.string().trim().min(1).max(50),
//   authorityName: z.string().trim().min(1).max(200),
//   filingSystemLabel: z.string().trim().min(1).max(200),
// });

// const messageCatalogSchema = z.object({
//   action: z.string().trim().min(1).max(50),
//   country: z.string().trim().min(1).max(50),
//   procedureCode: z.string().trim().min(1).max(50),
//   messageName: z.string().trim().min(1).max(100),
//   queueName: z.string().trim().min(1).max(100),
// });

// const responseStatusMappingSchema = z.object({
//   country: z.string().trim().min(1).max(50),
//   messageName: z.string().trim().min(1).max(100),
//   canonicalStatus: z.string().trim().min(1).max(50),
//   filingTransition: z.string().trim().min(1).max(50),
// });

// const actionRuleSchema = z.object({
//   country: z.string().trim().min(1).max(50),
//   procedureCode: z.string().trim().min(1).max(50),
//   messageName: z.string().trim().min(1).max(100),
//   status: z.string().trim().min(1).max(50),
//   allowUpdates: z.boolean(),
// });

// const childActionRuleSchema = z.object({
//   country: z.string().trim().min(1).max(50),
//   procedureCode: z.string().trim().min(1).max(50),
//   messageName: z.string().trim().min(1).max(100),
//   status: z.string().trim().min(1).max(50),
//   action: z.string().trim().min(1).max(50),
// });

// ============================================================================
// KEPT SCHEMAS
// ============================================================================

// Recursive: type "grid" makes a field a list of rows shaped by `columns`,
// and a column can itself be another grid to any depth (e.g. a GoodsItem
// grid whose rows each contain a nested Packages grid). z.lazy() is required
// for a self-referencing Zod schema; TFieldEntry gives it an explicit type
// since Zod can't infer a recursive type on its own.
type TFieldEntry = {
  key: string;
  label: string;
  type: "text" | "boolean" | "number" | "date" | "grid";
  required: boolean;
  source: string;
  helpText?: string;
  columns?: TFieldEntry[];
};

const actionDataFieldEntrySchema: z.ZodType<TFieldEntry> = z.lazy(() =>
  z.object({
    key: z.string().trim().min(1).max(50),
    label: z.string().trim().min(1).max(100),
    type: z.enum(["text", "boolean", "number", "date", "grid"]),
    // Applies to the whole field, never to an individual data row: for a
    // grid this means "at least one row", not "every row/column populated".
    required: z.boolean(),
    // "prompt" (operator supplies it when the action is invoked) or
    // "shipment.<dotted.path>" (resolved automatically, never asked of the operator).
    source: z.string().trim().max(200).optional().transform(val => val || "prompt"),
    helpText: z.string().trim().max(300).optional().transform(val => val || undefined),
    // Only meaningful when type === "grid": the shape of each row, recursively.
    columns: z.array(actionDataFieldEntrySchema).max(50).optional(),
  })
);

const actionDataRequirementSchema = z.object({
  country: z.string().trim().min(1).max(50),
  procedureCode: z.string().trim().min(1).max(50),
  messageName: z.string().trim().min(1).max(100),
  action: z.string().trim().min(1).max(50),
  release: z.string().trim().max(50).optional().nullable().transform(val => val || null),
  fields: z.array(actionDataFieldEntrySchema).max(50),
});

// OLD SCHEMA (commented out - FilingMessageActionCatalog dropped, replaced by FilingActionCatalog)
// const messageActionCatalogCreateSchema = z.object({
//   code: z.string().trim().min(1).max(50),
//   label: z.string().trim().min(1).max(100),
//   requiresPriorMessage: z.boolean(),
// });
// const messageActionCatalogUpdateSchema = messageActionCatalogCreateSchema.omit({ code: true });

/** P2002 (unique constraint) -> a clear, expected 409, not a generic 500. */
export class DuplicateConfigRowError extends Error {}
/** P2025 (row not found for update/delete) -> a clear 404. */
export class ConfigRowNotFoundError extends Error {}

function wrapPrismaErrors<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch((err) => {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") throw new DuplicateConfigRowError("A row with this combination already exists.");
      if (err.code === "P2025") throw new ConfigRowNotFoundError("Row not found.");
    }
    throw err;
  });
}

export const FILING_CONFIG_TABLES: Record<FilingConfigTableKey, TableDef<unknown>> = {
  // ============================================================================
  // NEW MULTI-COUNTRY TABLES (stubs - TODO: Implement full UI)
  // ============================================================================
  "procedure-catalog": {
    label: "Procedure Catalog",
    description: "Universal filing procedures (IMPORT, EXPORT, NCTS, etc.)",
    idField: "id",
    fields: [
      { key: "procedureCode", label: "Procedure Code", type: "text" },
      { key: "isActive", label: "Is Active", type: "boolean" },
    ],
    list: () => db.filingProcedureCatalog.findMany({ orderBy: { procedureCode: "asc" } }),
    create: (data) => wrapPrismaErrors(() => db.filingProcedureCatalog.create({ data: procedureCatalogSchema.parse(data) })),
    update: (id, data) => wrapPrismaErrors(() => db.filingProcedureCatalog.update({ where: { id }, data: procedureCatalogSchema.parse(data) })),
    remove: (id) => wrapPrismaErrors(() => db.filingProcedureCatalog.delete({ where: { id } })).then(() => undefined),
    createSchema: procedureCatalogSchema,
    updateSchema: procedureCatalogSchema,
  },
  "action-catalog": {
    label: "Action Catalog",
    description: "Universal action codes (SUBMIT, AMENDMENT, CANCELLATION, etc.)",
    idField: "id",
    fields: [
      { key: "code", label: "Code", type: "text" },
      { key: "isActive", label: "Is Active", type: "boolean" },
    ],
    list: () => db.filingActionCatalog.findMany({ orderBy: { code: "asc" } }),
    create: (data) => wrapPrismaErrors(() => db.filingActionCatalog.create({ data: actionCatalogSchema.parse(data) })),
    update: (id, data) => wrapPrismaErrors(() => db.filingActionCatalog.update({ where: { id }, data: actionCatalogSchema.parse(data) })),
    remove: (id) => wrapPrismaErrors(() => db.filingActionCatalog.delete({ where: { id } })).then(() => undefined),
    createSchema: actionCatalogSchema,
    updateSchema: actionCatalogSchema,
  },
  "procedure-config": {
    label: "Procedure Configuration",
    description: "(country, procedureCode, messageName) - lists valid messages per country/procedure",
    idField: "id",
    fields: [
      { key: "country", label: "Country", type: "text" },
      { key: "procedureCode", label: "Procedure Code", type: "select", optionsSource: "/api/filing-config/procedure-catalog-codes" },
      { key: "messageName", label: "Message Name", type: "text" },
      { key: "isActive", label: "Is Active", type: "boolean" },
    ],
    list: () => db.filingProcedureConfig.findMany({
      orderBy: [{ country: "asc" }, { procedureCode: "asc" }]
    }),
    create: (data) => wrapPrismaErrors(() => db.filingProcedureConfig.create({ data: procedureConfigSchema.parse(data) })),
    update: (id, data) => wrapPrismaErrors(() => db.filingProcedureConfig.update({ where: { id }, data: procedureConfigSchema.parse(data) })),
    remove: (id) => wrapPrismaErrors(() => db.filingProcedureConfig.delete({ where: { id } })).then(() => undefined),
    createSchema: procedureConfigSchema,
    updateSchema: procedureConfigSchema,
  },
  "action-message-mapping": {
    label: "Action Message Mapping",
    description: "(country, procedureCode, action) → messageName - maps user actions to outbound messages",
    idField: "id",
    fields: [
      { key: "country", label: "Country", type: "select", optionsSource: "/api/filing-config/countries" },
      { key: "procedureCode", label: "Procedure Code", type: "select", optionsSource: "/api/filing-config/procedure-codes" },
      { key: "action", label: "Action", type: "select", optionsSource: "/api/filing-config/actions" },
      { key: "messageName", label: "Message Name", type: "select", optionsSource: "/api/filing-config/message-names" },
      { key: "isActive", label: "Is Active", type: "boolean" },
    ],
    list: async () => {
      return db.filingActionMessageMapping.findMany({ 
        orderBy: [{ country: "asc" }, { action: "asc" }] 
      });
    },
    create: (data) => wrapPrismaErrors(() => db.filingActionMessageMapping.create({ data: actionMessageMappingSchema.parse(data) })),
    update: (id, data) => wrapPrismaErrors(() => db.filingActionMessageMapping.update({ where: { id }, data: actionMessageMappingSchema.parse(data) })),
    remove: (id) => wrapPrismaErrors(() => db.filingActionMessageMapping.delete({ where: { id } })).then(() => undefined),
    createSchema: actionMessageMappingSchema,
    updateSchema: actionMessageMappingSchema,
  },
  "action-configuration": {
    label: "Action Configuration",
    description: "(country, procedureCode, messageName, status) → availableActions, allowSubmit - determines UI actions",
    idField: "id",
    fields: [
      { key: "country", label: "Country", type: "select", optionsSource: "/api/filing-config/countries" },
      { key: "procedureCode", label: "Procedure Code", type: "select", optionsSource: "/api/filing-config/procedure-codes" },
      { key: "messageName", label: "Message Name", type: "select", optionsSource: "/api/filing-config/message-names" },
      { key: "release", label: "Release", type: "select", optionsSource: "/api/filing-config/releases", help: "Select customs version release" },
      { key: "status", label: "Status", type: "text" },
      { 
        key: "availableActions", 
        label: "Available Actions", 
        type: "fieldArray",
        help: "List of actions available in this state. Select from the Action Catalog.",
        itemFields: [
          { 
            key: "action", 
            label: "Action", 
            type: "select",
            // Will be populated dynamically - see getFilingConfigTableMeta()
            options: [],
            help: "Select an action from the catalog" 
          }
        ]
      },
      { key: "allowSubmit", label: "Allow Submit", type: "boolean" },
      { key: "isActive", label: "Is Active", type: "boolean" },
    ],
    list: async () => {
      const rows = await db.filingActionConfiguration.findMany({ 
        orderBy: [{ country: "asc" }, { status: "asc" }] 
      });
      
      // Transform string[] to object[] for UI
      return rows.map((row) => ({
        ...row,
        availableActions: row.availableActions.map((action) => ({ action })),
      }));
    },
    create: async (data) => {
      // Data already comes as string[] from client, no need to transform
      return wrapPrismaErrors(() => db.filingActionConfiguration.create({ data: actionConfigurationSchema.parse(data) }));
    },
    update: async (id, data) => {
      // Data already comes as string[] from client, no need to transform
      return wrapPrismaErrors(() => db.filingActionConfiguration.update({ where: { id }, data: actionConfigurationSchema.parse(data) }));
    },
    remove: (id) => wrapPrismaErrors(() => db.filingActionConfiguration.delete({ where: { id } })).then(() => undefined),
    createSchema: actionConfigurationSchema,
    updateSchema: actionConfigurationSchema,
  },
  "status-catalog": {
    label: "Filing Status Catalog",
    description: "Master list of filing status codes with a default description and optional per-locale (multi-language) description overrides",
    idField: "id",
    fields: [
      { key: "statusCode", label: "Status Code", type: "text", help: "Business/system code, e.g. DRAFT, SUBMITTED, APPROVED" },
      { key: "defaultDescription", label: "Default Description", type: "text", help: "Fallback description shown when no locale-specific override exists" },
      {
        key: "localeDescriptions",
        label: "Locale Descriptions",
        type: "fieldArray",
        help: "Per-language description overrides. Add one row per locale (e.g. en, fr, nl).",
        itemFields: [
          { key: "locale", label: "Locale", type: "text", help: "Locale/language code, e.g. en, fr, nl" },
          { key: "description", label: "Description", type: "text" },
        ],
      },
    ],
    list: async () => {
      const rows = await db.filingStatusCatalog.findMany({ orderBy: { statusCode: "asc" } });
      return rows.map((row) => ({
        ...row,
        localeDescriptions: localeMapToArray(row.localeDescription),
      }));
    },
    create: (data) => wrapPrismaErrors(async () => {
      const parsed = statusCatalogCreateSchema.parse(data);
      const row = await db.filingStatusCatalog.create({
        data: {
          statusCode: parsed.statusCode,
          defaultDescription: parsed.defaultDescription,
          localeDescription: localeArrayToMap(parsed.localeDescriptions),
          createdBy: parsed.createdBy ?? null,
        },
      });
      return { ...row, localeDescriptions: localeMapToArray(row.localeDescription) };
    }),
    update: (id, data) => wrapPrismaErrors(async () => {
      const parsed = statusCatalogUpdateSchema.parse(data);
      const row = await db.filingStatusCatalog.update({
        where: { id },
        data: {
          statusCode: parsed.statusCode,
          defaultDescription: parsed.defaultDescription,
          localeDescription: parsed.localeDescriptions ? localeArrayToMap(parsed.localeDescriptions) : undefined,
          updatedBy: parsed.updatedBy,
        },
      });
      return { ...row, localeDescriptions: localeMapToArray(row.localeDescription) };
    }),
    remove: (id) => wrapPrismaErrors(() => db.filingStatusCatalog.delete({ where: { id } })).then(() => undefined),
    createSchema: statusCatalogCreateSchema,
    updateSchema: statusCatalogUpdateSchema,
  },
  // ============================================================================
  // KEPT TABLE (existing functionality)
  // ============================================================================
  "action-data-requirement": {
    label: "Action Data Requirement",
    description:
      "(country, procedure, messageName, action) → extra fields a child action needs beyond the declaration itself (e.g. a guarantee reference a German NCTS cancellation needs that a US consumption cancellation doesn't). No match = no extra fields required -- cancelFiling()/amendFiling() stay single, country-agnostic implementations that just ask this table what a context needs.",
    idField: "id",
    fields: [
      { key: "country", label: "Country", type: "select", optionsSource: "/api/filing-config/countries" },
      { key: "procedureCode", label: "Procedure Code", type: "select", optionsSource: "/api/filing-config/procedure-codes" },
      { key: "messageName", label: "Message Name", type: "select", optionsSource: "/api/filing-config/message-names" },
      { key: "action", label: "Action", type: "select", optionsSource: "/api/filing-config/actions", help: "e.g. CANCELLATION, AMENDMENT -- a FilingMessageActionCatalog code." },
      { key: "release", label: "Release", type: "select", optionsSource: "/api/filing-config/releases", help: "Select customs version release" },
      {
        key: "fields",
        label: "Required Fields",
        type: "fieldArray",
        help: 'Each field is either "prompt" (the operator supplies it when invoking the action) or "shipment.<dotted.path>" (resolved automatically, never asked of the operator).',
        itemFields: [
          { key: "key", label: "Field Key", type: "text", help: "The key this value is stored under in the message's extensions." },
          { key: "label", label: "Display Label", type: "text" },
          { key: "type", label: "Type", type: "select", options: ["text", "boolean", "number", "date", "grid"] },
          { key: "required", label: "Required", type: "boolean", help: "Applies to the whole field, always -- for a grid, means at least one row. Never set per data row." },
          { key: "source", label: "Source", type: "text", help: '"prompt" or "shipment.<dotted.path>"' },
          { key: "helpText", label: "Help Text (optional)", type: "text" },
          {
            key: "columns",
            label: "Grid Columns (only used when Type = grid)",
            type: "fieldArray",
            help: 'Defines each row\'s own fields. Set a column\'s own Type to "grid" to nest another list inside it (e.g. GoodsItem rows each containing a Packages grid) -- no depth limit.',
            // itemFields intentionally omitted: the editor reuses this same
            // shape recursively, since a self-referencing array can't be
            // serialized across the server/client boundary.
          },
        ],
      },
    ],
    list: async () => {
      return db.filingActionDataRequirement.findMany({ 
        orderBy: [{ country: "asc" }, { action: "asc" }] 
      });
    },
    create: (data) => wrapPrismaErrors(() => db.filingActionDataRequirement.create({ data: actionDataRequirementSchema.parse(data) })),
    update: (id, data) => wrapPrismaErrors(() => db.filingActionDataRequirement.update({ where: { id }, data: actionDataRequirementSchema.parse(data) })),
    remove: (id) => wrapPrismaErrors(() => db.filingActionDataRequirement.delete({ where: { id } })).then(() => undefined),
    createSchema: actionDataRequirementSchema,
    updateSchema: actionDataRequirementSchema,
  },

  // ============================================================================
  // UI CONFIGURATION TABLES
  // ============================================================================

  "ui-configuration": {
    label: "UI Configuration",
    description: "Configure form fields and layouts for declaration and response views",
    idField: "id",
    fields: [
      { key: "country", label: "Country", type: "text" },
      { key: "procedureCode", label: "Procedure Code", type: "text" },
      { key: "messageName", label: "Message Name", type: "text" },
      { key: "messageType", label: "Message Type", type: "text", help: "request or response" },
      { key: "version", label: "Version", type: "text" },
      { key: "description", label: "Description", type: "text" },
      { key: "totalFields", label: "Total Fields", type: "text", help: "Number of configured fields" },
      { key: "isActive", label: "Active", type: "boolean" },
      { key: "updatedAt", label: "Updated At", type: "text" },
      { key: "createdBy", label: "Created By", type: "text" },
      { key: "updatedBy", label: "Updated By", type: "text" },
    ],
    list: async () => {
      const model = (db as any).filingUiConfig || (db as any).filingUIConfig;
      const rows = await model.findMany({
        where: { isActive: true },
        orderBy: [
          { country: "asc" },
          { procedureCode: "asc" },
          { messageName: "asc" },
          { messageType: "asc" },
        ],
      });
      
      // Transform rows to include totalFields from configData
      return rows.map((row: any) => ({
        id: row.id,
        country: row.country,
        procedureCode: row.procedureCode,
        messageName: row.messageName,
        messageType: row.messageType,
        version: row.version,
        description: row.description,
        totalFields: (row.configData as any)?.fields?.length || 0,
        isActive: row.isActive,
        updatedAt: row.updatedAt.toISOString(),
        createdBy: row.createdBy,
        updatedBy: row.updatedBy,
      }));
    },
    create: (data) => wrapPrismaErrors(() => {
      const model = (db as any).filingUiConfig || (db as any).filingUIConfig;
      return model.create({ 
        data: {
          country: String(data.country || ""),
          procedureCode: String(data.procedureCode || ""),
          messageName: String(data.messageName || ""),
          messageType: String(data.messageType || "request"),
          configData: data.configData || { fields: [], totalFields: 0, sections: [] },
          version: Number(data.version || 1),
          description: data.description ? String(data.description) : null,
          isActive: data.isActive !== false,
          createdBy: data.createdBy ? String(data.createdBy) : 'system',
          updatedBy: data.updatedBy ? String(data.updatedBy) : 'system',
        } 
      });
    }),
    update: (id, data) => wrapPrismaErrors(() => {
      const model = (db as any).filingUiConfig || (db as any).filingUIConfig;
      return model.update({ 
        where: { id }, 
        data: {
          country: data.country ? String(data.country) : undefined,
          procedureCode: data.procedureCode ? String(data.procedureCode) : undefined,
          messageName: data.messageName ? String(data.messageName) : undefined,
          messageType: data.messageType ? String(data.messageType) : undefined,
          configData: data.configData || undefined,
          version: data.version !== undefined ? Number(data.version) : undefined,
          description: data.description !== undefined ? String(data.description) : undefined,
          isActive: data.isActive !== undefined ? Boolean(data.isActive) : undefined,
          updatedBy: data.updatedBy ? String(data.updatedBy) : undefined,
        } 
      });
    }),
    remove: (id) => wrapPrismaErrors(() => {
      const model = (db as any).filingUiConfig || (db as any).filingUIConfig;
      return model.delete({ where: { id } });
    }).then(() => undefined),
    createSchema: z.object({
      country: z.string(),
      procedureCode: z.string(),
      messageName: z.string(),
      messageType: z.enum(["request", "response"]),
      configData: z.object({
        fields: z.array(z.any()),
        totalFields: z.number(),
        sections: z.array(z.string()),
      }),
      description: z.string().optional(),
      isActive: z.boolean().default(true),
      createdBy: z.string().optional(),
      updatedBy: z.string().optional(),
    }),
    updateSchema: z.object({
      country: z.string().optional(),
      procedureCode: z.string().optional(),
      messageName: z.string().optional(),
      messageType: z.enum(["request", "response"]).optional(),
      configData: z.object({
        fields: z.array(z.any()),
        totalFields: z.number(),
        sections: z.array(z.string()),
      }).optional(),
      version: z.number().optional(),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
      updatedBy: z.string().optional(),
    }),
  },

  "master-data-source": {
    label: "Master Data Sources",
    description: "Define master data sources for dropdown and lookup fields",
    idField: "id",
    fields: [
      { key: "sourceName", label: "Source Name", type: "text", help: "Unique identifier (e.g., Country, Currency)" },
      { key: "sourceType", label: "Source Type", type: "text", help: "table, enum, api, or static" },
      { key: "tableName", label: "Table Name", type: "text", help: "Prisma model name for table-based sources" },
      { key: "valueField", label: "Value Field", type: "text", help: "Field to use as option value" },
      { key: "labelField", label: "Label Field", type: "text", help: "Field to use as option label" },
      { key: "apiEndpoint", label: "API Endpoint", type: "text", help: "For API-based sources" },
      { key: "apiMethod", label: "API Method", type: "text" },
      { key: "isActive", label: "Active", type: "boolean" },
    ],
    list: async () => {
      const model = (db as any).filingMasterDataSource;
      const rows = await model.findMany({
        orderBy: { sourceName: "asc" },
      });
      return rows;
    },
    create: (data) => wrapPrismaErrors(() => {
      const model = (db as any).filingMasterDataSource;
      return model.create({ 
        data: {
          sourceName: String(data.sourceName || ""),
          sourceType: String(data.sourceType || "static"),
          tableName: data.tableName ? String(data.tableName) : null,
          valueField: data.valueField ? String(data.valueField) : null,
          labelField: data.labelField ? String(data.labelField) : null,
          apiEndpoint: data.apiEndpoint ? String(data.apiEndpoint) : null,
          apiMethod: String(data.apiMethod || "GET"),
          isActive: data.isActive !== false,
        } 
      });
    }),
    update: (id, data) => wrapPrismaErrors(() => {
      const model = (db as any).filingMasterDataSource;
      return model.update({ 
        where: { id }, 
        data: {
          sourceName: data.sourceName ? String(data.sourceName) : undefined,
          sourceType: data.sourceType ? String(data.sourceType) : undefined,
          tableName: data.tableName !== undefined ? (data.tableName ? String(data.tableName) : null) : undefined,
          valueField: data.valueField !== undefined ? (data.valueField ? String(data.valueField) : null) : undefined,
          labelField: data.labelField !== undefined ? (data.labelField ? String(data.labelField) : null) : undefined,
          apiEndpoint: data.apiEndpoint !== undefined ? (data.apiEndpoint ? String(data.apiEndpoint) : null) : undefined,
          apiMethod: data.apiMethod ? String(data.apiMethod) : undefined,
          isActive: data.isActive !== undefined ? Boolean(data.isActive) : undefined,
        } 
      });
    }),
    remove: (id) => wrapPrismaErrors(() => {
      const model = (db as any).filingMasterDataSource;
      return model.delete({ where: { id } });
    }).then(() => undefined),
    createSchema: z.object({
      sourceName: z.string(),
      sourceType: z.enum(["table", "enum", "api", "static"]),
      tableName: z.string().optional(),
      valueField: z.string().optional(),
      labelField: z.string().optional(),
      apiEndpoint: z.string().optional(),
      apiMethod: z.string().default("GET"),
      isActive: z.boolean().default(true),
    }),
    updateSchema: z.object({
      sourceName: z.string().optional(),
      sourceType: z.enum(["table", "enum", "api", "static"]).optional(),
      tableName: z.string().optional(),
      valueField: z.string().optional(),
      labelField: z.string().optional(),
      apiEndpoint: z.string().optional(),
      apiMethod: z.string().optional(),
      isActive: z.boolean().optional(),
    }),
  },

  // ============================================================================
  // CUSTOMS VERSION MANAGEMENT
  // ============================================================================
  "country-customs-version": {
    label: "Country Customs Versions",
    description: "Master table for country-specific customs versions",
    idField: "id",
    fields: [
      { key: "country", label: "Country", type: "text", help: "Two-letter country code (e.g., NL, BE)" },
      { key: "procedureCode", label: "Procedure Code", type: "text", help: "Procedure code (e.g., IMPORT, EXPORT)" },
      { key: "release", label: "Release", type: "text", help: "Version number (e.g., 1.0, 2.0)" },
      { key: "validFrom", label: "Valid From", type: "date", help: "Start date for this version" },
      { key: "validTo", label: "Valid To", type: "date", help: "End date for this version (optional)" },
      { key: "description", label: "Description", type: "text" },
      { key: "isActive", label: "Active", type: "boolean" },
    ],
    list: () => db.filingCountryCustomsVersion.findMany({
      orderBy: [
        { country: "asc" },
        { procedureCode: "asc" },
        { release: "asc" },
      ],
    }),
    create: (data) => wrapPrismaErrors(() => {
      return db.filingCountryCustomsVersion.create({
        data: {
          country: String(data.country || ""),
          procedureCode: String(data.procedureCode || ""),
          release: String(data.release || "1.0"),
          validFrom: data.validFrom ? new Date(String(data.validFrom)) : new Date(),
          validTo: data.validTo ? new Date(String(data.validTo)) : null,
          description: data.description ? String(data.description) : null,
          isActive: data.isActive !== false,
          createdBy: data.createdBy ? String(data.createdBy) : null,
        },
      });
    }),
    update: (id, data) => wrapPrismaErrors(() => {
      return db.filingCountryCustomsVersion.update({
        where: { id },
        data: {
          country: data.country ? String(data.country) : undefined,
          procedureCode: data.procedureCode ? String(data.procedureCode) : undefined,
          release: data.release ? String(data.release) : undefined,
          validFrom: data.validFrom ? new Date(String(data.validFrom)) : undefined,
          validTo: data.validTo ? new Date(String(data.validTo)) : undefined,
          description: data.description !== undefined ? (data.description ? String(data.description) : null) : undefined,
          isActive: data.isActive !== undefined ? Boolean(data.isActive) : undefined,
          updatedBy: data.updatedBy ? String(data.updatedBy) : undefined,
        },
      });
    }),
    remove: (id) => wrapPrismaErrors(() => {
      return db.filingCountryCustomsVersion.delete({ where: { id } });
    }).then(() => undefined),
    createSchema: z.object({
      country: z.string().min(2).max(2),
      procedureCode: z.string().min(1),
      release: z.string().default("1.0"),
      validFrom: z.string().optional(),
      validTo: z.string().optional(),
      description: z.string().optional(),
      isActive: z.boolean().default(true),
      createdBy: z.string().optional(),
    }),
    updateSchema: z.object({
      country: z.string().min(2).max(2).optional(),
      procedureCode: z.string().min(1).optional(),
      release: z.string().optional(),
      validFrom: z.string().optional(),
      validTo: z.string().optional(),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
      updatedBy: z.string().optional(),
    }),
  },

  "customer-customs-version": {
    label: "Customer Customs Versions",
    description: "Map customers to specific customs versions",
    idField: "id",
    fields: [
      { key: "applyToAllCustomers", label: "Apply to All Customers", type: "boolean", help: "When checked, this version applies to all customers" },
      { key: "customerId", label: "Customer", type: "select", help: "Select specific customer (leave empty if Apply to All is checked)", optionsSource: "/api/filing-config/customers" },
      { key: "filingCountryCustomsId", label: "Country Customs Version", type: "select", help: "Select country customs version", optionsSource: "/api/filing-config/country-customs-versions" },
      { key: "notes", label: "Notes", type: "text" },
      { key: "isActive", label: "Active", type: "boolean" },
    ],
    list: async () => {
      const rows = await db.filingCustomerCustomsVersion.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          countryCustomsVersion: true,
        },
      });

      // customerId has no DB-level FK to Account (it's a plain string so the
      // mapping stays valid even if the account is later deleted), so the
      // display name has to be joined here rather than via `include`.
      const customerIds = Array.from(new Set(rows.map((r) => r.customerId).filter((id): id is string => Boolean(id))));
      const accounts = customerIds.length
        ? await db.account.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true } })
        : [];
      const accountNameById = new Map(accounts.map((a) => [a.id, a.name]));

      return rows.map((row) => ({
        ...row,
        customerName: row.customerId ? accountNameById.get(row.customerId) ?? null : null,
      }));
    },
    create: (data) => wrapPrismaErrors(() => {
      return db.filingCustomerCustomsVersion.create({
        data: {
          applyToAllCustomers: Boolean(data.applyToAllCustomers),
          customerId: data.applyToAllCustomers ? null : String(data.customerId || ""),
          filingCountryCustomsId: String(data.filingCountryCustomsId || ""),
          notes: data.notes ? String(data.notes) : null,
          isActive: data.isActive !== false,
          createdBy: data.createdBy ? String(data.createdBy) : null,
        },
        include: {
          countryCustomsVersion: true,
        },
      });
    }),
    update: (id, data) => wrapPrismaErrors(() => {
      return db.filingCustomerCustomsVersion.update({
        where: { id },
        data: {
          applyToAllCustomers: data.applyToAllCustomers !== undefined ? Boolean(data.applyToAllCustomers) : undefined,
          customerId: data.applyToAllCustomers ? null : (data.customerId ? String(data.customerId) : undefined),
          filingCountryCustomsId: data.filingCountryCustomsId ? String(data.filingCountryCustomsId) : undefined,
          notes: data.notes !== undefined ? (data.notes ? String(data.notes) : null) : undefined,
          isActive: data.isActive !== undefined ? Boolean(data.isActive) : undefined,
          updatedBy: data.updatedBy ? String(data.updatedBy) : undefined,
        },
        include: {
          countryCustomsVersion: true,
        },
      });
    }),
    remove: (id) => wrapPrismaErrors(() => {
      return db.filingCustomerCustomsVersion.delete({ where: { id } });
    }).then(() => undefined),
    createSchema: z.object({
      applyToAllCustomers: z.boolean().default(false),
      customerId: z.string().optional(),
      filingCountryCustomsId: z.string().min(1),
      notes: z.string().optional(),
      isActive: z.boolean().default(true),
      createdBy: z.string().optional(),
    }).refine(
      (data) => data.applyToAllCustomers || data.customerId,
      { message: "Either applyToAllCustomers must be true or customerId must be provided" }
    ),
    updateSchema: z.object({
      applyToAllCustomers: z.boolean().optional(),
      customerId: z.string().optional(),
      filingCountryCustomsId: z.string().min(1).optional(),
      notes: z.string().optional(),
      isActive: z.boolean().optional(),
      updatedBy: z.string().optional(),
    }),
  },

  // ============================================================================
  // CUSTOMS CODE LIST MASTERS
  // ============================================================================

  "code-list-type": {
    label: "Filing Code List Type",
    description: "Lookup of code-list categories (e.g. PACKAGE_TYPES, INCOTERMS) that a code list header belongs to",
    idField: "listType",
    fields: [
      { key: "listType", label: "List Type", type: "text", help: "Unique identifier, e.g. PACKAGE_TYPES" },
      { key: "listTypeName", label: "List Type Name", type: "text", help: "Human-readable title" },
      { key: "description", label: "Description", type: "text" },
      { key: "isActive", label: "Active", type: "boolean" },
    ],
    list: () => db.filingCodeListType.findMany({ orderBy: { listType: "asc" } }),
    create: (data) => wrapPrismaErrors(() => {
      const parsed = codeListTypeCreateSchema.parse(data);
      return db.filingCodeListType.create({
        data: {
          listType: parsed.listType,
          listTypeName: parsed.listTypeName,
          description: parsed.description ?? null,
          isActive: parsed.isActive,
          createdBy: parsed.createdBy ?? "system",
          // updatedBy/updatedAt are deliberately left unset here: they stay
          // null until this row is genuinely edited, not stamped at creation.
        },
      });
    }),
    update: (id, data) => wrapPrismaErrors(() => {
      const parsed = codeListTypeUpdateSchema.parse(data);
      return db.filingCodeListType.update({
        where: { listType: id },
        data: {
          listTypeName: parsed.listTypeName,
          description: parsed.description,
          isActive: parsed.isActive,
          updatedBy: parsed.updatedBy,
          updatedAt: new Date(),
        },
      });
    }),
    remove: (id) => wrapPrismaErrors(() => db.filingCodeListType.delete({ where: { listType: id } })).then(() => undefined),
    createSchema: codeListTypeCreateSchema,
    updateSchema: codeListTypeUpdateSchema,
  },

  // "code-list" is rendered by a dedicated FilingCodeListManager component
  // (header -> item -> translation drill-down + CSV upload), not the generic
  // TablePanel, because that hierarchy doesn't fit the flat single-table CRUD
  // this registry's create/update/remove are shaped for. This entry only
  // supplies the label/description page.tsx reads for the tab header, and a
  // best-effort header-level list/CRUD so the type stays sound if the
  // generic endpoint is ever hit directly.
  "code-list": {
    label: "Filing Code List",
    description: "Country/procedure-scoped customs reference codes (headers, items, and per-language translations)",
    idField: "codeListId",
    fields: [
      { key: "countryIso2", label: "Country", type: "text" },
      { key: "procedureCode", label: "Procedure Code", type: "text" },
      { key: "listType", label: "List Type", type: "select", optionsSource: "/api/filing-config/list-types" },
      { key: "version", label: "Version", type: "text" },
      { key: "isActive", label: "Active", type: "boolean" },
    ],
    list: () => db.filingCodeListHeader.findMany({
      orderBy: [{ countryIso2: "asc" }, { procedureCode: "asc" }, { listType: "asc" }, { version: "asc" }],
    }),
    create: (data) => wrapPrismaErrors(() => {
      const parsed = codeListHeaderCreateSchema.parse(data);
      return db.filingCodeListHeader.create({
        data: {
          countryIso2: parsed.countryIso2,
          procedureCode: parsed.procedureCode,
          listType: parsed.listType,
          version: parsed.version,
          effectiveFrom: new Date(parsed.effectiveFrom),
          effectiveTo: parsed.effectiveTo ? new Date(parsed.effectiveTo) : null,
          isActive: parsed.isActive,
          createdBy: parsed.createdBy ?? "system",
          // updatedBy/updatedAt are deliberately left unset here: they stay
          // null until this row is genuinely edited, not stamped at creation.
        },
      });
    }),
    update: (id, data) => wrapPrismaErrors(() => {
      const parsed = codeListHeaderUpdateSchema.parse(data);
      return db.filingCodeListHeader.update({
        where: { codeListId: id },
        data: {
          countryIso2: parsed.countryIso2,
          procedureCode: parsed.procedureCode,
          listType: parsed.listType,
          version: parsed.version,
          effectiveFrom: parsed.effectiveFrom ? new Date(parsed.effectiveFrom) : undefined,
          effectiveTo: parsed.effectiveTo !== undefined ? (parsed.effectiveTo ? new Date(parsed.effectiveTo) : null) : undefined,
          isActive: parsed.isActive,
          updatedBy: parsed.updatedBy,
          updatedAt: new Date(),
        },
      });
    }),
    remove: (id) => wrapPrismaErrors(() => db.filingCodeListHeader.delete({ where: { codeListId: id } })).then(() => undefined),
    createSchema: codeListHeaderCreateSchema,
    updateSchema: codeListHeaderUpdateSchema,
  },
};

/**
 * Get table metadata with dynamically populated options (for select fields)
 * This is called from the page component to populate dropdown options from the database
 */
export async function getFilingConfigTableMeta(tableKey: FilingConfigTableKey): Promise<TableMeta<unknown>> {
  const tableDef = FILING_CONFIG_TABLES[tableKey];
  
  // For action-configuration table, populate action options from FilingActionCatalog
  if (tableKey === "action-configuration") {
    const actions = await db.filingActionCatalog.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: { code: true }
    });
    const actionOptions = actions.map(a => a.code);

    // Deep clone and update the itemFields options
    const fieldsWithOptions: FieldDef[] = tableDef.fields.map(field => {
      if (field.key === "availableActions" && field.type === "fieldArray" && field.itemFields) {
        return {
          ...field,
          itemFields: field.itemFields.map(subField => {
            if (subField.key === "action" && subField.type === "select") {
              return { ...subField, options: actionOptions };
            }
            return subField;
          })
        };
      }
      return field;
    });

    return {
      ...tableDef,
      fields: fieldsWithOptions
    };
  }

  return tableDef;
}

type TableMeta<TRow> = Omit<TableDef<TRow>, 'list' | 'create' | 'update' | 'remove' | 'createSchema' | 'updateSchema'>;

export function isFilingConfigTableKey(key: string): key is FilingConfigTableKey {
  return Object.prototype.hasOwnProperty.call(FILING_CONFIG_TABLES, key);
}
