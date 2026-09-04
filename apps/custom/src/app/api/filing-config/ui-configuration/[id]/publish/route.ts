import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAccountContext } from "@/lib/auth";
import { validateConfig, getValidationSummary, formatValidationErrors } from "@/lib/ui-config/config-validator";
import type { FilingUIConfigData } from "@/types/ui-config.types";

/** Promotes a validated draft and retires the prior active configuration for the same release. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accountContext = await getAccountContext();
    if (!accountContext) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const config = await db.filingUIConfig.findUnique({ where: { id } });
    if (!config) return NextResponse.json({ error: "Configuration not found" }, { status: 404 });

    const validation = validateConfig(config.configData as unknown as FilingUIConfigData);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Cannot publish: configuration has validation errors.",
          summary: getValidationSummary(validation.errors, validation.warnings),
          errors: formatValidationErrors(validation.errors),
          warnings: formatValidationErrors(validation.warnings),
        },
        { status: 422 }
      );
    }

    const userIdentifier = accountContext.email || accountContext.userId;
    const published = await db.$transaction(async (tx) => {
      await tx.filingUIConfig.updateMany({
        where: {
          country: config.country,
          procedureCode: config.procedureCode,
          messageName: config.messageName,
          messageType: config.messageType,
          release: config.release,
          isActive: true,
          id: { not: id },
        },
        data: { isActive: false },
      });

      return tx.filingUIConfig.update({
        where: { id },
        data: {
          isDraft: false,
          isActive: true,
          version: { increment: 1 },
          updatedBy: userIdentifier,
        },
      });
    });

    return NextResponse.json(published);
  } catch (error) {
    console.error("Error publishing UI configuration:", error);
    return NextResponse.json({ error: "Failed to publish UI configuration" }, { status: 500 });
  }
}
