/**
 * GET /api/schemas/[country]/[procedure]/[message]/[type]?version=1.0
 *
 * Serves JSON schema for a customs filing message.
 * Schema file selection:
 *  1. Look up FilingProcedureConfig to get transactionType (IMPORT or EXPORT)
 *  2. Normalize version: "1.0" → "1.0.0"
 *  3. Load public/schemas/customs-filing/filing-schemas/{import|export}/{version}/{schema}.json
 *  4. If version folder not found → 422 with list of available versions
 */

import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir } from "fs/promises";
import { join } from "path";
import { db } from "@/lib/db";

/** Normalise "1.0" → "1.0.0", "2" → "2.0.0", "1.0.0" stays */
function normalizeVersion(raw: string): string {
  const parts = raw.split(".");
  if (parts.length === 1) return `${parts[0]}.0.0`;
  if (parts.length === 2) return `${parts[0]}.${parts[1]}.0`;
  return raw;
}

/** Map transactionType to the directory and schema file on disk.
 * Only IMPORT and EXPORT are supported. */
function resolveSchemaFile(transactionType: string | null): { folder: string; file: string } {
  if ((transactionType ?? "").toUpperCase() === "EXPORT") {
    return { folder: "export", file: "ExportDeclaration.schema.json" };
  }
  return { folder: "import", file: "ImportDeclaration.schema.json" };
}

/** List available version folders for a given transaction type folder */
async function getAvailableVersions(basePath: string): Promise<string[]> {
  try {
    const entries = await readdir(basePath, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ country: string; procedure: string; message: string; type: string }> }
) {
  try {
    const { country, procedure, message, type } = await context.params;
    const searchParams = request.nextUrl.searchParams;

    const version = normalizeVersion(searchParams.get("version") || "1.0.0");

    // ── 1. Look up transactionType from FilingProcedureConfig ─────────────────
    const procConfig = await db.filingProcedureConfig.findFirst({
      where: { country, procedureCode: procedure, messageName: message, isActive: true },
      select: { transactionType: true },
    });

    const rawTransactionType = procConfig?.transactionType
      ?? (procedure.toUpperCase().startsWith("H") ? "IMPORT" : "EXPORT");

    const schemaSource = procConfig?.transactionType ? "db" : "fallback";
    const { folder, file: schemaFileName } = resolveSchemaFile(rawTransactionType);

    // ── 2. Build paths ─────────────────────────────────────────────────────────
    const schemasBase = join(process.cwd(), "public", "schemas", "customs-filing", "filing-schemas", folder);
    const schemaPath = join(schemasBase, version, schemaFileName);

    console.log("📋 Schema API:", { country, procedure, message, type, version, transactionType: rawTransactionType, schemaSource, schemaPath });

    // ── 3. Read the schema file ────────────────────────────────────────────────
    let schemaContent: string;
    try {
      schemaContent = await readFile(schemaPath, "utf-8");
    } catch (fileErr: any) {
      if (fileErr.code === "ENOENT") {
        // Version folder or file not found — list what IS available
        const available = await getAvailableVersions(schemasBase);
        const txLabel = rawTransactionType.toUpperCase(); // "IMPORT" or "EXPORT"

        return NextResponse.json(
          {
            error: "SCHEMA_VERSION_NOT_FOUND",
            message:
              available.length > 0
                ? `Schema version "${version}" is not available for ${txLabel}. Available versions: ${available.join(", ")}.`
                : `No schema versions found for ${txLabel}. Please add schema files to public/schemas/customs-filing/filing-schemas/${folder}/.`,
            details: {
              requested: version,
              transactionType: txLabel,
              schemaFile: schemaFileName,
              availableVersions: available,
            },
          },
          { status: 422 }
        );
      }
      throw fileErr;
    }

    const schema = JSON.parse(schemaContent);

    return NextResponse.json({
      schema,
      metadata: {
        country, procedure, message, type,
        version, transactionType: rawTransactionType,
        schemaFile: schemaFileName, schemaSource,
      },
    });

  } catch (error: any) {
    console.error("Error loading schema:", error);
    return NextResponse.json(
      { error: "Failed to load schema", message: error.message },
      { status: 500 }
    );
  }
}