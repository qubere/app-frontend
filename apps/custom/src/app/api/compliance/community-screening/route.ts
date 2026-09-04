/**
 * POST /api/compliance/community-screening
 * GET  /api/compliance/community-screening
 *
 * Creates and lists Community Screening runs. All domain logic (input
 * resolution, evaluation, aggregation) lives in
 * modules/compliance/communityScreening -- this route only validates the
 * request, builds the input union, and translates the service's result/errors
 * into HTTP responses.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { createAuditLog, AuditAction } from "@/lib/audit";
import { holdsPermission } from "@/modules/party/partyActor";
import {
  CommunityScreeningService,
  CommunityScreeningValidationError,
} from "@/modules/compliance/communityScreening/service";
import { CommunityScreeningInputError } from "@/modules/compliance/communityScreening/partySource";
import { getCommunityScreeningMaxFileSizeMb } from "@/modules/compliance/communityScreening/config";
import type { CommunityScreeningInputSource } from "@/modules/compliance/communityScreening/types";

const partySchema = z.object({
  partyId: z.string().optional(),
  externalReference: z.string().optional(),
  name: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  contactName: z.string().optional(),
});

const bodySchema = z.object({
  source: z.enum(["UI", "API"]).default("UI"),
  inputMode: z.enum(["DIRECT_ENTRY", "PARTY_MASTER", "FILE_UPLOAD"]),
  parties: z.array(partySchema).optional(),
  partyIds: z.array(z.string()).optional(),
  fileName: z.string().optional(),
  fileType: z.enum(["CSV", "XLSX", "JSON"]).optional(),
  fileContentBase64: z.string().optional(),
  checksEnabled: z.object({
    restrictedParty: z.boolean(),
    embargo: z.boolean(),
  }),
  complianceCountry: z.string().optional(),
  transactionReference: z.string().optional(),
  overrides: z
    .object({
      nameThreshold: z.number().optional(),
      addressThreshold: z.number().optional(),
      countryMatchRequired: z.boolean().optional(),
      redFlagCheckEnabled: z.boolean().optional(),
    })
    .optional(),
});

export const POST = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body", requestId }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation error", issues: parsed.error.issues, requestId }, { status: 400 });
    }
    const data = parsed.data;

    let input: CommunityScreeningInputSource;
    if (data.inputMode === "DIRECT_ENTRY") {
      if (!data.parties || data.parties.length === 0) {
        return NextResponse.json(
          { error: "parties is required for DIRECT_ENTRY input mode", requestId },
          { status: 400 }
        );
      }
      input = { inputMode: "DIRECT_ENTRY", parties: data.parties };
    } else if (data.inputMode === "PARTY_MASTER") {
      if (!data.partyIds || data.partyIds.length === 0) {
        return NextResponse.json(
          { error: "partyIds is required for PARTY_MASTER input mode", requestId },
          { status: 400 }
        );
      }
      input = { inputMode: "PARTY_MASTER", partyIds: data.partyIds };
    } else {
      if (!data.fileName || !data.fileType || !data.fileContentBase64) {
        return NextResponse.json(
          { error: "fileName, fileType, and fileContentBase64 are required for FILE_UPLOAD input mode", requestId },
          { status: 400 }
        );
      }
      const fileContent = Buffer.from(data.fileContentBase64, "base64");
      const maxBytes = getCommunityScreeningMaxFileSizeMb() * 1024 * 1024;
      if (fileContent.byteLength > maxBytes) {
        return NextResponse.json(
          {
            error: `File exceeds maximum size of ${getCommunityScreeningMaxFileSizeMb()}MB`,
            requestId,
          },
          { status: 400 }
        );
      }
      input = { inputMode: "FILE_UPLOAD", fileName: data.fileName, fileType: data.fileType, fileContent };
    }

    try {
      const result = await CommunityScreeningService.createRun(
        ctx.accountId,
        {
          source: data.source,
          input,
          checksEnabled: data.checksEnabled,
          complianceCountry: data.complianceCountry ?? null,
          transactionReference: data.transactionReference ?? null,
          overrides: data.overrides ?? null,
        },
        {
          userId: ctx.userId,
          requestId,
          mayOverride: holdsPermission(ctx, "compliance.community_screening.override"),
        }
      );

      await createAuditLog({
        accountId: ctx.accountId,
        userId: ctx.userId,
        action: AuditAction.COMMUNITY_SCREENING_RUN_CREATED,
        entity: "CommunityScreeningRun",
        entityId: result.run.id,
        source: "UI",
        metadata: {
          inputMode: data.inputMode,
          totalParties: result.run.totalParties,
          checksEnabled: data.checksEnabled,
        },
        requestId,
      });

      return NextResponse.json(
        { success: true, requestId, run: result.run, invalidRows: result.invalidRows },
        { status: 201 }
      );
    } catch (err) {
      if (err instanceof CommunityScreeningValidationError || err instanceof CommunityScreeningInputError) {
        return NextResponse.json(
          { error: err.message, invalidRows: err.invalidRows ?? [], requestId },
          { status: 400 }
        );
      }
      throw err;
    }
  },
  { permission: "compliance.community_screening.screen", write: true }
);

export const GET = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const url = new URL(req.url);
    const page = url.searchParams.get("page");
    const pageSize = url.searchParams.get("pageSize");
    const status = url.searchParams.get("status");
    const source = url.searchParams.get("source");

    const result = await CommunityScreeningService.listRuns(ctx.accountId, {
      page: page ? Number.parseInt(page, 10) : undefined,
      pageSize: pageSize ? Number.parseInt(pageSize, 10) : undefined,
      status: status ?? undefined,
      source: source ?? undefined,
    });

    return NextResponse.json({ ...result, requestId });
  },
  { permission: "compliance.community_screening.read" }
);
