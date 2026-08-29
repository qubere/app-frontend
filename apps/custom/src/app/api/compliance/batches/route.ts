/**
 * POST /api/compliance/batches -- uploads a file and creates a
 * TRANSACTION_COMPLIANCE ComplianceBatch (multipart/form-data: file,
 * servicesEnabled JSON string). Parsing/validation happens synchronously;
 * screening itself is queued and runs via the compliance-batch-dispatch cron.
 *
 * GET /api/compliance/batches -- lists batches for the current tenant.
 */
import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { ComplianceBatchService, ComplianceBatchValidationError } from "@/modules/complianceBatch/service";
import type { ComplianceBatchServiceFlags } from "@/modules/complianceBatch/types";

export const POST = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: "Expected multipart/form-data body", requestId }, { status: 400 });
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required", requestId }, { status: 400 });
    }

    let servicesEnabled: ComplianceBatchServiceFlags = {
      partyScreening: true,
      licenseScreening: false,
      embargoScreening: false,
      productClassification: false,
    };
    const rawFlags = form.get("servicesEnabled");
    if (typeof rawFlags === "string") {
      try {
        const parsed = JSON.parse(rawFlags);
        servicesEnabled = {
          partyScreening: Boolean(parsed.partyScreening),
          licenseScreening: Boolean(parsed.licenseScreening),
          embargoScreening: Boolean(parsed.embargoScreening),
          productClassification: Boolean(parsed.productClassification),
        };
      } catch {
        return NextResponse.json({ error: "servicesEnabled must be valid JSON", requestId }, { status: 400 });
      }
    }

    if (
      !servicesEnabled.partyScreening &&
      !servicesEnabled.licenseScreening &&
      !servicesEnabled.embargoScreening &&
      !servicesEnabled.productClassification
    ) {
      return NextResponse.json(
        {
          error:
            "At least one of partyScreening, licenseScreening, embargoScreening, or productClassification must be enabled.",
          requestId,
        },
        { status: 400 }
      );
    }

    const columnMappingTemplateId = form.get("columnMappingTemplateId");

    try {
      const { batch, invalidRows } = await ComplianceBatchService.createTransactionComplianceBatch(
        ctx.accountId,
        ctx.userId ?? null,
        file,
        servicesEnabled,
        requestId,
        typeof columnMappingTemplateId === "string" ? columnMappingTemplateId : null
      );
      return NextResponse.json({ batch, invalidRows, requestId }, { status: 201 });
    } catch (err) {
      if (err instanceof ComplianceBatchValidationError) {
        return NextResponse.json({ error: err.message, invalidRows: err.invalidRows, requestId }, { status: 400 });
      }
      throw err;
    }
  },
  { permission: "compliance.bulk_screening.create", write: true }
);

export const GET = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? undefined;
    const batchType = url.searchParams.get("batchType") ?? undefined;
    const search = url.searchParams.get("search") ?? undefined;
    const page = Number(url.searchParams.get("page") ?? 1) || 1;
    const pageSize = Number(url.searchParams.get("pageSize") ?? 20) || 20;

    const result = await ComplianceBatchService.listBatches(ctx.accountId, { status, batchType, search, page, pageSize });
    return NextResponse.json({ ...result, requestId });
  },
  { permission: "compliance.bulk_screening.view" }
);
