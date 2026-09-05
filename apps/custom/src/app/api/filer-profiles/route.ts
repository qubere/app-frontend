import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { db } from "@/lib/db";
import { validateFilerProfileInput, SecretInTransportConfigError } from "@/modules/entrySummary/filerProfile";

export const GET = withAuthenticatedRoute(
  async ({ ctx, requestId }) => {
    const profiles = await db.filerProfile.findMany({ where: { accountId: ctx.accountId }, orderBy: { name: "asc" } });
    return NextResponse.json({ filerProfiles: profiles, requestId });
  },
  { permission: "filing.filer_profile.manage" }
);

export const POST = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return buildErrorResponse(400, "MALFORMED_JSON", "Failed to parse JSON body", undefined, requestId);
    }

    let input;
    try {
      input = validateFilerProfileInput({ ...(raw as object), accountId: ctx.accountId });
    } catch (err) {
      if (err instanceof ZodError) {
        return buildErrorResponse(400, "INVALID_INPUT", "Invalid filer profile", err.issues, requestId);
      }
      if (err instanceof SecretInTransportConfigError) {
        return buildErrorResponse(400, "SECRET_IN_TRANSPORT_CONFIG", err.message, undefined, requestId);
      }
      throw err;
    }

    const created = await db.filerProfile.create({
      data: {
        accountId: input.accountId,
        name: input.name,
        filerCode: input.filerCode,
        defaultPortCode: input.defaultPortCode ?? null,
        format: input.format,
        formatVersion: input.formatVersion,
        fieldMap: input.fieldMap as object,
        transport: input.transport,
        transportConfig: input.transportConfig != null ? (input.transportConfig as object) : Prisma.JsonNull,
        active: input.active ?? true,
      },
    });

    return NextResponse.json({ filerProfile: created, requestId }, { status: 201 });
  },
  { permission: "filing.filer_profile.manage", write: true }
);
