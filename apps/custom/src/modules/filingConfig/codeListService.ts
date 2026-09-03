/**
 * Business logic for the customs code list masters: Header -> Item ->
 * Translation CRUD (used by the dedicated /api/filing-config/code-list-*
 * routes, not the flat generic [table] route -- this hierarchy doesn't fit
 * that shape) and the combined CSV bulk importer.
 *
 * createdBy/updatedBy on every write are the caller's Clerk user id, passed
 * in as `actor` by the route handler (never trusted from the request body).
 */

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { DuplicateConfigRowError, ConfigRowNotFoundError } from "./registry";
import { parseOrThrow, validateImport, type ImportCodeListRow } from "./codeListCsv";

function wrapPrismaErrors<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch((err) => {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") throw new DuplicateConfigRowError("A row with this combination already exists.");
      if (err.code === "P2025") throw new ConfigRowNotFoundError("Row not found.");
      if (err.code === "P2003") throw new DomainCodeListError("Referenced row does not exist (check the List Type or parent header/item).");
    }
    throw err;
  });
}

export class DomainCodeListError extends Error {}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

export function listHeaders() {
  return db.filingCodeListHeader.findMany({
    orderBy: [{ countryIso2: "asc" }, { procedureCode: "asc" }, { listType: "asc" }, { version: "asc" }],
    include: {
      codeListType: { select: { listTypeName: true } },
      _count: { select: { items: true } },
    },
  });
}

export const headerCreateSchema = z
  .object({
    countryIso2: z.string().trim().length(2).toUpperCase(),
    procedureCode: z.string().trim().min(1).max(20),
    listType: z.string().trim().min(1).max(50),
    version: z.string().trim().min(1).max(30),
    effectiveFrom: z.string().min(1),
    effectiveTo: z.string().trim().min(1).optional().nullable(),
    isActive: z.boolean().default(true),
  })
  .refine((data) => !data.effectiveTo || new Date(data.effectiveTo) > new Date(data.effectiveFrom), {
    message: "Effective To must be after Effective From",
    path: ["effectiveTo"],
  });

export const headerUpdateSchema = z.object({
  countryIso2: z.string().trim().length(2).toUpperCase().optional(),
  procedureCode: z.string().trim().min(1).max(20).optional(),
  listType: z.string().trim().min(1).max(50).optional(),
  version: z.string().trim().min(1).max(30).optional(),
  effectiveFrom: z.string().min(1).optional(),
  effectiveTo: z.string().trim().min(1).optional().nullable(),
  isActive: z.boolean().optional(),
});

export function createHeader(data: z.infer<typeof headerCreateSchema>, actor: string) {
  return wrapPrismaErrors(() =>
    db.filingCodeListHeader.create({
      data: {
        countryIso2: data.countryIso2,
        procedureCode: data.procedureCode,
        listType: data.listType,
        version: data.version,
        effectiveFrom: new Date(data.effectiveFrom),
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
        isActive: data.isActive,
        createdBy: actor,
        // updatedBy/updatedAt are deliberately left unset here: they stay
        // null until this row is genuinely edited, not stamped at creation.
      },
    })
  );
}

export function updateHeader(id: string, data: z.infer<typeof headerUpdateSchema>, actor: string) {
  return wrapPrismaErrors(() =>
    db.filingCodeListHeader.update({
      where: { codeListId: id },
      data: {
        countryIso2: data.countryIso2,
        procedureCode: data.procedureCode,
        listType: data.listType,
        version: data.version,
        effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : undefined,
        effectiveTo: data.effectiveTo !== undefined ? (data.effectiveTo ? new Date(data.effectiveTo) : null) : undefined,
        isActive: data.isActive,
        updatedBy: actor,
        updatedAt: new Date(),
      },
    })
  );
}

export function deleteHeader(id: string) {
  return wrapPrismaErrors(() => db.filingCodeListHeader.delete({ where: { codeListId: id } })).then(() => undefined);
}

// ---------------------------------------------------------------------------
// Item + Translation
// ---------------------------------------------------------------------------

const translationInputSchema = z.object({
  languageCode: z.string().trim().min(1).max(10),
  displayName: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).optional().nullable(),
});

export const itemCreateSchema = z.object({
  code: z.string().trim().min(1).max(50),
  attributes: z.record(z.string(), z.unknown()).default({}),
  isDeprecated: z.boolean().default(false),
  translations: z.array(translationInputSchema).max(50).default([]),
});

export const itemUpdateSchema = z.object({
  code: z.string().trim().min(1).max(50).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  isDeprecated: z.boolean().optional(),
  // Full replace when provided: simpler and safer than a partial merge for a
  // small (<=50 language) per-item translation set edited wholesale from one
  // form.
  translations: z.array(translationInputSchema).max(50).optional(),
});

export function listItems(codeListId: string) {
  return db.filingCodeListItem.findMany({
    where: { codeListId },
    orderBy: { code: "asc" },
    include: { translations: { orderBy: { languageCode: "asc" } } },
  });
}

export function createItem(codeListId: string, data: z.infer<typeof itemCreateSchema>, actor: string) {
  return wrapPrismaErrors(() =>
    db.filingCodeListItem.create({
      data: {
        codeListId,
        code: data.code,
        attributes: data.attributes as Prisma.InputJsonValue,
        isDeprecated: data.isDeprecated,
        createdBy: actor,
        // updatedBy/updatedAt are deliberately left unset here: they stay
        // null until this row is genuinely edited, not stamped at creation.
        translations: {
          create: data.translations.map((t) => ({
            languageCode: t.languageCode,
            displayName: t.displayName,
            description: t.description ?? null,
            createdBy: actor,
            // Same rule for each translation: it's newly created alongside
            // the item, not an edit of an existing translation row.
          })),
        },
      },
      include: { translations: true },
    })
  );
}

export function updateItem(itemId: string, data: z.infer<typeof itemUpdateSchema>, actor: string) {
  return wrapPrismaErrors(() =>
    db.$transaction(async (tx) => {
      const item = await tx.filingCodeListItem.update({
        where: { itemId },
        data: {
          code: data.code,
          attributes: data.attributes as Prisma.InputJsonValue | undefined,
          isDeprecated: data.isDeprecated,
          updatedBy: actor,
          updatedAt: new Date(),
        },
      });

      if (data.translations !== undefined) {
        await tx.filingCodeListItemTranslation.deleteMany({ where: { itemId } });
        if (data.translations.length > 0) {
          await tx.filingCodeListItemTranslation.createMany({
            data: data.translations.map((t) => ({
              itemId,
              languageCode: t.languageCode,
              displayName: t.displayName,
              description: t.description ?? null,
              createdBy: actor,
              // Full-replace recreates every translation row from scratch,
              // so each one is a brand-new row (not an edit of an existing
              // one) -- updatedBy/updatedAt stay unset, same as any create.
            })),
          });
        }
      }

      return tx.filingCodeListItem.findUniqueOrThrow({
        where: { itemId: item.itemId },
        include: { translations: { orderBy: { languageCode: "asc" } } },
      });
    })
  );
}

export function deleteItem(itemId: string) {
  return wrapPrismaErrors(() => db.filingCodeListItem.delete({ where: { itemId } })).then(() => undefined);
}

// ---------------------------------------------------------------------------
// CSV bulk import
// ---------------------------------------------------------------------------

export interface ImportRowOutcome {
  rowNumber: number;
  status: "HEADER_CREATED" | "HEADER_UPDATED" | "ITEM_CREATED" | "ITEM_UPDATED" | "TRANSLATION_UPSERTED" | "SKIPPED" | "FAILED";
  message?: string;
}

export interface ImportSummary {
  headersCreated: number;
  headersUpdated: number;
  itemsCreated: number;
  itemsUpdated: number;
  translationsUpserted: number;
  rowsFailed: number;
  rowResults: ImportRowOutcome[];
  fileErrors: readonly { column: string | null; message: string }[];
}

interface GroupedRow {
  rowNumber: number;
  data: ImportCodeListRow;
}

/** Key that identifies which header a row belongs to. */
function headerKey(row: ImportCodeListRow): string {
  return `${row.countryIso2}|${row.procedureCode}|${row.listType}|${row.version}`;
}

/**
 * Parses, validates, and writes a code-list CSV in one pass. Each row is
 * independent for write purposes ("a bad row fails alone", matching the
 * party importer): a row that fails to parse/validate is reported and
 * skipped; rows that validate are grouped back into their header/item tree
 * and upserted level by level so a header/item created earlier in the same
 * file is immediately available to later rows that reference it.
 */
export async function importCodeListCsv(content: string, actor: string): Promise<ImportSummary> {
  const parsed = parseOrThrow(content);
  const validation = validateImport(parsed);

  if (validation.fileErrors.length > 0) {
    return {
      headersCreated: 0,
      headersUpdated: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      translationsUpserted: 0,
      rowsFailed: 0,
      rowResults: [],
      fileErrors: validation.fileErrors,
    };
  }

  const summary: ImportSummary = {
    headersCreated: 0,
    headersUpdated: 0,
    itemsCreated: 0,
    itemsUpdated: 0,
    translationsUpserted: 0,
    rowsFailed: 0,
    rowResults: [],
    fileErrors: [],
  };

  // Header groups, in first-seen order, so a header is only written once
  // even though every one of its item/translation rows repeats its columns.
  const groups = new Map<string, GroupedRow[]>();
  for (const row of validation.rows) {
    if (row.status === "INVALID" || row.data === null) {
      summary.rowsFailed += 1;
      summary.rowResults.push({
        rowNumber: row.rowNumber,
        status: "FAILED",
        message: row.errors.map((e) => (e.column ? `${e.column}: ${e.message}` : e.message)).join(" "),
      });
      continue;
    }
    const key = headerKey(row.data);
    const list = groups.get(key) ?? [];
    list.push({ rowNumber: row.rowNumber, data: row.data });
    groups.set(key, list);
  }

  // Cache header names -> whether that list type exists, to fail every row
  // in an unknown-list-type group with one lookup instead of one per row.
  const listTypes = new Set((await db.filingCodeListType.findMany({ select: { listType: true } })).map((t) => t.listType));

  for (const [, rows] of groups) {
    const first = rows[0].data;

    if (!listTypes.has(first.listType)) {
      for (const { rowNumber } of rows) {
        summary.rowsFailed += 1;
        summary.rowResults.push({
          rowNumber,
          status: "FAILED",
          message: `List Type "${first.listType}" does not exist. Create it first under Filing Code List Type.`,
        });
      }
      continue;
    }

    // A header's own columns (effectiveFrom/effectiveTo/isActive) must agree
    // across every row that shares it -- a mismatch is ambiguous, not
    // silently resolved by "last row wins".
    const mismatched = rows.filter(
      (r) =>
        r.data.effectiveFrom.getTime() !== first.effectiveFrom.getTime() ||
        (r.data.effectiveTo?.getTime() ?? null) !== (first.effectiveTo?.getTime() ?? null) ||
        r.data.headerIsActive !== first.headerIsActive
    );
    if (mismatched.length > 0) {
      for (const { rowNumber } of rows) {
        summary.rowsFailed += 1;
        summary.rowResults.push({
          rowNumber,
          status: "FAILED",
          message: "Rows sharing the same Country/Procedure/List Type/Version disagree on Effective From/To or Header Is Active.",
        });
      }
      continue;
    }

    const existingHeader = await db.filingCodeListHeader.findUnique({
      where: {
        countryIso2_procedureCode_listType_version: {
          countryIso2: first.countryIso2,
          procedureCode: first.procedureCode,
          listType: first.listType,
          version: first.version,
        },
      },
    });

    const header = existingHeader
      ? await db.filingCodeListHeader.update({
          where: { codeListId: existingHeader.codeListId },
          data: {
            effectiveFrom: first.effectiveFrom,
            effectiveTo: first.effectiveTo,
            isActive: first.headerIsActive,
            updatedBy: actor,
            updatedAt: new Date(),
          },
        })
      : await db.filingCodeListHeader.create({
          data: {
            countryIso2: first.countryIso2,
            procedureCode: first.procedureCode,
            listType: first.listType,
            version: first.version,
            effectiveFrom: first.effectiveFrom,
            effectiveTo: first.effectiveTo,
            isActive: first.headerIsActive,
            createdBy: actor,
            // updatedBy/updatedAt stay unset on creation, same rule as the
            // dedicated create-header endpoint.
          },
        });
    if (existingHeader) summary.headersUpdated += 1;
    else summary.headersCreated += 1;

    // Sub-group by item code within this header.
    const itemGroups = new Map<string, GroupedRow[]>();
    for (const row of rows) {
      const list = itemGroups.get(row.data.code) ?? [];
      list.push(row);
      itemGroups.set(row.data.code, list);
    }

    for (const [code, itemRows] of itemGroups) {
      const firstItemRow = itemRows[0].data;
      const existingItem = await db.filingCodeListItem.findUnique({
        where: { codeListId_code: { codeListId: header.codeListId, code } },
      });

      const item = existingItem
        ? await db.filingCodeListItem.update({
            where: { itemId: existingItem.itemId },
            data: {
              attributes: firstItemRow.attributes as Prisma.InputJsonValue,
              isDeprecated: firstItemRow.isDeprecated,
              updatedBy: actor,
              updatedAt: new Date(),
            },
          })
        : await db.filingCodeListItem.create({
            data: {
              codeListId: header.codeListId,
              code,
              attributes: firstItemRow.attributes as Prisma.InputJsonValue,
              isDeprecated: firstItemRow.isDeprecated,
              createdBy: actor,
              // updatedBy/updatedAt stay unset on creation.
            },
          });
      if (existingItem) summary.itemsUpdated += 1;
      else summary.itemsCreated += 1;

      for (const { rowNumber, data: rowData } of itemRows) {
        await db.filingCodeListItemTranslation.upsert({
          where: { itemId_languageCode: { itemId: item.itemId, languageCode: rowData.languageCode } },
          create: {
            itemId: item.itemId,
            languageCode: rowData.languageCode,
            displayName: rowData.displayName,
            description: rowData.description,
            createdBy: actor,
            // updatedBy/updatedAt stay unset on creation.
          },
          update: {
            displayName: rowData.displayName,
            description: rowData.description,
            updatedBy: actor,
            updatedAt: new Date(),
          },
        });
        summary.translationsUpserted += 1;
        summary.rowResults.push({
          rowNumber,
          status: existingItem ? "TRANSLATION_UPSERTED" : "ITEM_CREATED",
        });
      }
    }
  }

  return summary;
}
