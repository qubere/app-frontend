import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getAccountContext } from "@/lib/auth";

/** Creates a draft copy of a configuration, scoped to the source release. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accountContext = await getAccountContext();
    if (!accountContext) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const source = await db.filingUIConfig.findUnique({ where: { id } });
    if (!source) return NextResponse.json({ error: "Source configuration not found" }, { status: 404 });

    const country = body.country ?? source.country;
    const procedureCode = body.procedureCode ?? source.procedureCode;
    const messageName = body.messageName ?? source.messageName;
    const messageType = body.messageType ?? source.messageType;
    const release: string | null = body.release ?? source.release;

    const existingDraft = await db.filingUIConfig.findFirst({
      where: { country, procedureCode, messageName, messageType, release, isDraft: true },
    });
    if (existingDraft) {
      return NextResponse.json(
        { error: "A draft already exists for this release and configuration.", existingDraftId: existingDraft.id },
        { status: 409 }
      );
    }

    const userIdentifier = accountContext.email || accountContext.userId;
    const cloned = await db.filingUIConfig.create({
      data: {
        country,
        procedureCode,
        messageName,
        messageType,
        release,
        configData: source.configData === null ? Prisma.JsonNull : source.configData as Prisma.InputJsonValue,
        version: 1,
        description: body.description ?? source.description,
        isDraft: true,
        isActive: false,
        createdBy: userIdentifier,
        updatedBy: userIdentifier,
      },
    });

    return NextResponse.json(cloned, { status: 201 });
  } catch (error) {
    console.error("Error duplicating UI configuration:", error);
    return NextResponse.json({ error: "Failed to duplicate UI configuration" }, { status: 500 });
  }
}
