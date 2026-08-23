/**
 * API endpoint for managing UI configuration
 *
 * GET  /api/filing-config/ui-configuration        - List all configurations (active + drafts)
 * POST /api/filing-config/ui-configuration        - Create or update a draft configuration
 *
 * Lifecycle per country+procedureCode+messageName+messageType:
 *   - At most one draft (isDraft=true,  isActive=false)
 *   - At most one active (isDraft=false, isActive=true)
 *   POST always targets the draft row.
 *   Use /[id]/publish to promote a draft to active.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAccountContext } from "@/lib/auth";
import { validateConfig, getValidationSummary, formatValidationErrors } from "@/lib/ui-config/config-validator";
import { FilingUIConfigData } from "@/types/ui-config.types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const country = searchParams.get("country");
    const procedureCode = searchParams.get("procedureCode");
    const messageName = searchParams.get("messageName");
    const messageType = searchParams.get("messageType");

    const where: any = {};
    if (country) where.country = country;
    if (procedureCode) where.procedureCode = procedureCode;
    if (messageName) where.messageName = messageName;
    if (messageType) where.messageType = messageType;
    // FilingUIConfig intentionally does not store transactionType. It belongs
    // to FilingProcedureConfig, which the editor uses to select a schema.
    // Do not add it to this Prisma query: the column was removed by migration.

    const configs = await db.filingUIConfig.findMany({
      where,
      orderBy: [
        { country: "asc" },
        { procedureCode: "asc" },
        { messageName: "asc" },
        // active rows first within the same combo
        { isActive: "desc" },
      ],
    });

    const rows = configs.map((c) => {
      const configData = c.configData as unknown as FilingUIConfigData;
      // Derive status label for the dashboard
      const status = c.isActive ? "active" : c.isDraft ? "draft" : "inactive";
      return {
        id: c.id,
        country: c.country,
        procedureCode: c.procedureCode,
        messageName: c.messageName,
        messageType: c.messageType,
        release: c.release,
        version: c.version,
        description: c.description,
        totalFields: configData.fields?.length || 0,
        totalTabs: configData.tabs?.length || 0,
        totalSections: configData.sections?.length || 0,
        layoutMode: configData.layout?.mode || "single-page",
        configVersion: configData.version || "unknown",
        isActive: c.isActive,
        isDraft: c.isDraft,
        status,
        updatedAt: c.updatedAt.toISOString(),
        createdBy: c.createdBy,
        updatedBy: c.updatedBy,
      };
    });

    return NextResponse.json({ rows });
  } catch (error) {
    console.error("Error fetching UI configurations:", error);
    return NextResponse.json(
      { error: "Failed to fetch UI configurations" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const accountContext = await getAccountContext();
    if (!accountContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userIdentifier = accountContext.email || accountContext.userId;
    const body = await request.json();

    if (!body.country || !body.procedureCode || !body.messageName || !body.messageType) {
      return NextResponse.json(
        { error: "Missing required fields: country, procedureCode, messageName, messageType" },
        { status: 400 }
      );
    }

    if (!body.configData) {
      return NextResponse.json({ error: "configData is required" }, { status: 400 });
    }

    const configData = body.configData as unknown as FilingUIConfigData;
    const validationResult = validateConfig(configData);

    if (!validationResult.valid) {
      return NextResponse.json(
        {
          error: "Configuration validation failed",
          summary: getValidationSummary(validationResult.errors, validationResult.warnings),
          errors: formatValidationErrors(validationResult.errors),
          warnings: formatValidationErrors(validationResult.warnings),
        },
        { status: 400 }
      );
    }

    if (configData.metadata) {
      configData.metadata.lastModifiedBy = userIdentifier;
      configData.metadata.lastModifiedAt = new Date().toISOString();
    }

    // Find the existing draft (if any) for this combination
    // Include release in the lookup so per-release drafts don't overwrite each other
    const release: string | null = body.release ?? null;

    const existingDraft = await db.filingUIConfig.findFirst({
      where: {
        country: body.country,
        procedureCode: body.procedureCode,
        messageName: body.messageName,
        messageType: body.messageType,
        release,
        isDraft: true,
      },
    });

    let config;
    if (existingDraft) {
      // Update the existing draft — never touch the active row
      config = await db.filingUIConfig.update({
        where: { id: existingDraft.id },
        data: {
          configData: body.configData,
          release,
          description: body.description,
          updatedAt: new Date(),
          updatedBy: userIdentifier,
        },
      });
    } else {
      // Create a new draft row (isDraft=true, isActive=false)
      config = await db.filingUIConfig.create({
        data: {
          country: body.country,
          procedureCode: body.procedureCode,
          messageName: body.messageName,
          messageType: body.messageType,
          release,
          configData: body.configData,
          version: 1,
          description: body.description,
          isDraft: true,
          isActive: false,
          createdBy: userIdentifier,
          updatedBy: userIdentifier,
        },
      });
    }

    return NextResponse.json(config, { status: existingDraft ? 200 : 201 });
  } catch (error) {
    console.error("Error saving UI configuration draft:", error);
    return NextResponse.json(
      { error: "Failed to save UI configuration" },
      { status: 500 }
    );
  }
}
