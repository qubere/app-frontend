/**
 * POST /api/compliance/batches/pre-approved-party-import -- bulk version of
 * the one-at-a-time pre-approval API (see
 * /api/v1/parties/[partyId]/restricted-party-screening/pre-approval).
 * Uploads a CSV (multipart/form-data: file) of Party ID / Reason / Expires
 * At rows; each row is later run through createPreApproval() by the
 * compliance-batch-dispatch cron (see processing.ts). Requires
 * `compliance.restricted_party.approve`, same as the single-party route.
 */
import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { ComplianceBatchService, ComplianceBatchValidationError } from "@/modules/complianceBatch/service";

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

    try {
      const { batch, invalidRows } = await ComplianceBatchService.createPreApprovedPartyImportBatch(
        ctx.accountId,
        ctx.userId ?? null,
        file,
        requestId
      );
      return NextResponse.json({ batch, invalidRows, requestId }, { status: 201 });
    } catch (err) {
      if (err instanceof ComplianceBatchValidationError) {
        return NextResponse.json({ error: err.message, invalidRows: err.invalidRows, requestId }, { status: 400 });
      }
      throw err;
    }
  },
  { permission: "compliance.restricted_party.approve", write: true }
);
