import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { validatePathParams, validateQueryParams } from "@/lib/api/validation";
import { buildErrorResponse } from "@/lib/api/error";
import { db } from "@/lib/db";
import { assembleEntrySummaryDraft } from "@/modules/entrySummary/assembler";
import { bindDutyFields } from "@/modules/entrySummary/duty";
import { validateDraft } from "@/modules/entrySummary/validation/engine";
import { RULES_7501 } from "@/modules/entrySummary/validation/rules7501";
import { generateDraft, latestVersion, getDraft, type DraftDbClient } from "@/modules/entrySummary/draft.service";
import { getActiveProfile, NoFilerProfileConfigured, AmbiguousFilerProfile } from "@/modules/entrySummary/filerProfile";
import { supersedeExportsForDraft, type ExportDbClient } from "@/modules/entrySummary/export.service";
import { loadShipmentForEntrySummary, ShipmentNotFoundError } from "@/modules/entrySummary/dbLoader";
import { recordDraftGenerated } from "@/modules/entrySummary/lifecycle";
import { loadHtsCodesMap, type DutyRateInput } from "@/lib/tariff/dutyEngine";

const paramsSchema = z.object({ id: z.string().min(1) });
const querySchema = z.object({ version: z.coerce.number().int().positive().optional() });

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ ctx, requestId, params }) => {
    const parsedParams = validatePathParams(params, paramsSchema, requestId);
    if ("response" in parsedParams) return parsedParams.response;
    const shipmentId = parsedParams.data.id;

    let loaded;
    try {
      loaded = await loadShipmentForEntrySummary(ctx.accountId, shipmentId);
    } catch (err) {
      if (err instanceof ShipmentNotFoundError) {
        return buildErrorResponse(404, "SHIPMENT_NOT_FOUND", err.message, undefined, requestId);
      }
      throw err;
    }

    let filerProfileRecord;
    try {
      filerProfileRecord = await getActiveProfile(db, ctx.accountId);
    } catch (err) {
      if (err instanceof NoFilerProfileConfigured) {
        return buildErrorResponse(422, "NO_FILER_PROFILE", err.message, undefined, requestId);
      }
      if (err instanceof AmbiguousFilerProfile) {
        return buildErrorResponse(422, "AMBIGUOUS_FILER_PROFILE", err.message, undefined, requestId);
      }
      throw err;
    }

    const clock = () => new Date();
    const filerProfileLike = {
      id: filerProfileRecord.id,
      filerCode: filerProfileRecord.filerCode,
      defaultPortCode: filerProfileRecord.defaultPortCode,
    };

    const assembled = assembleEntrySummaryDraft({ ...loaded.assemblerInput, filerProfile: filerProfileLike, clock });

    // Load real HTS duty-rate metadata for every HTS number the assembler
    // actually resolved (which may differ from ShipmentLineItem.htsCode when
    // a Fact/approval overrides it), then bind duty/fee totals (U4).
    const htsInputs = assembled.lines
      .filter((l) => l.fields.B29A_HTSUS_NUMBER.value)
      .map((l) => ({ htsCode: l.fields.B29A_HTSUS_NUMBER.value as string, totalValue: null, quantity: 1, unitPrice: 0 }));
    const htsCodesMap = await loadHtsCodesMap(htsInputs);
    const lineDutyInputs: Record<number, DutyRateInput | undefined> = {};
    for (const line of assembled.lines) {
      const hts = line.fields.B29A_HTSUS_NUMBER.value;
      lineDutyInputs[line.lineNumber] = hts ? htsCodesMap[hts] : undefined;
    }

    const draft = bindDutyFields({ draft: assembled, lineDutyInputs, clock });
    const validation = validateDraft(draft, RULES_7501, loaded.rulesContext);

    const normalizedInput = {
      assemblerInput: loaded.assemblerInput,
      filerProfile: filerProfileLike,
      lineDutyInputs,
    };

    const row = await generateDraft(db as unknown as DraftDbClient, {
      accountId: ctx.accountId,
      shipmentId,
      filingId: loaded.filingId,
      normalizedInput,
      draft,
      validation,
      generatedBy: ctx.userId,
      onSuperseded: (priorDraftId) => supersedeExportsForDraft(db as unknown as ExportDbClient, ctx.accountId, priorDraftId),
    });

    await recordDraftGenerated(
      { accountId: ctx.accountId, userId: ctx.userId, shipmentId, filingId: loaded.filingId },
      { version: row.version, blockingCount: row.blockingCount, warningCount: row.warningCount, isExportable: row.isExportable }
    );

    return NextResponse.json({
      draft: {
        version: row.version,
        shipmentId: row.shipmentId,
        filingId: row.filingId,
        draftData: row.draftData,
        validationData: row.validationData,
        isExportable: row.isExportable,
        blockingCount: row.blockingCount,
        warningCount: row.warningCount,
        approvedAt: row.approvedAt,
        approvedBy: row.approvedBy,
        supersededAt: row.supersededAt,
        createdAt: row.createdAt,
      },
      requestId,
    });
  },
  { permission: "filing.entry_summary.generate", write: true }
);

export const GET = withAuthenticatedRoute<{ id: string }>(
  async ({ req, requestId, params, ctx }) => {
    const parsedParams = validatePathParams(params, paramsSchema, requestId);
    if ("response" in parsedParams) return parsedParams.response;
    const shipmentId = parsedParams.data.id;

    const parsedQuery = validateQueryParams(req.url, querySchema, requestId);
    if ("response" in parsedQuery) return parsedQuery.response;

    const row = parsedQuery.data.version
      ? await getDraft(db as unknown as DraftDbClient, ctx.accountId, shipmentId, parsedQuery.data.version)
      : await latestVersion(db as unknown as DraftDbClient, ctx.accountId, shipmentId);

    if (!row) {
      return buildErrorResponse(404, "DRAFT_NOT_FOUND", `No EntrySummaryDraft found for shipment ${shipmentId}.`, undefined, requestId);
    }

    return NextResponse.json({
      draft: {
        version: row.version,
        shipmentId: row.shipmentId,
        filingId: row.filingId,
        draftData: row.draftData,
        validationData: row.validationData,
        isExportable: row.isExportable,
        blockingCount: row.blockingCount,
        warningCount: row.warningCount,
        approvedAt: row.approvedAt,
        approvedBy: row.approvedBy,
        supersededAt: row.supersededAt,
        createdAt: row.createdAt,
      },
      requestId,
    });
  },
  { permission: "filing.read" }
);
