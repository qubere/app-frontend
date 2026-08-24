/**
 * API endpoint for updating/deleting a specific UI configuration row
 *
 * GET    /api/filing-config/ui-configuration/[id] - Get specific config
 * PUT    /api/filing-config/ui-configuration/[id] - Update this config row in place
 * DELETE /api/filing-config/ui-configuration/[id] - Delete a config (active row requires confirmation flag)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAccountContext } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const config = await db.filingUIConfig.findUnique({
      where: { id },
    });

    if (!config) {
      return NextResponse.json(
        { error: "Configuration not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("Error fetching UI configuration:", error);
    return NextResponse.json(
      { error: "Failed to fetch UI configuration" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accountContext = await getAccountContext();
    if (!accountContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userIdentifier = accountContext.email || accountContext.userId;
    const body = await request.json();
    const { id } = await params;

    const existing = await db.filingUIConfig.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Configuration not found" }, { status: 404 });
    }

    // The dashboard can disable an already-published configuration so the
    // application falls back to the schema renderer. Reactivation is limited
    // to published rows; drafts must go through the validated publish route.
    if (typeof body.isActive === "boolean" && body.configData === undefined && body.description === undefined) {
      if (body.isActive && existing.isDraft) {
        return NextResponse.json(
          { error: "Draft configurations must be published before activation." },
          { status: 409 }
        );
      }

      const config = body.isActive
        ? await db.$transaction(async (tx) => {
            await tx.filingUIConfig.updateMany({
              where: {
                country: existing.country,
                procedureCode: existing.procedureCode,
                messageName: existing.messageName,
                messageType: existing.messageType,
                release: existing.release,
                isActive: true,
                id: { not: id },
              },
              data: { isActive: false },
            });
            return tx.filingUIConfig.update({
              where: { id },
              data: { isActive: true, updatedBy: userIdentifier },
            });
          })
        : await db.filingUIConfig.update({
            where: { id },
            data: { isActive: false, updatedBy: userIdentifier },
          });

      return NextResponse.json(config);
    }

    const config = await db.filingUIConfig.update({
      where: { id },
      data: {
        configData: body.configData,
        release: body.release ?? existing.release,
        description: body.description,
        updatedAt: new Date(),
        updatedBy: userIdentifier,
      },
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error("Error updating UI configuration:", error);
    return NextResponse.json(
      { error: "Failed to update UI configuration" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accountContext = await getAccountContext();
    if (!accountContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const confirmed = searchParams.get("confirmed") === "true";

    const existing = await db.filingUIConfig.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Configuration not found" }, { status: 404 });
    }

    // Deleting an active config is destructive — require explicit confirmation
    if (existing.isActive && !confirmed) {
      return NextResponse.json(
        {
          error: "Deleting an active configuration requires confirmation.",
          hint: "Re-send with ?confirmed=true to permanently delete.",
        },
        { status: 409 }
      );
    }

    await db.filingUIConfig.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting UI configuration:", error);
    return NextResponse.json(
      { error: "Failed to delete UI configuration" },
      { status: 500 }
    );
  }
}
