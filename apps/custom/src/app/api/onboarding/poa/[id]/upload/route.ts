import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { PoaService } from "@/modules/onboarding/poa.service";

// Wet-ink upload: multipart/form-data
// Fields: file (pdf), attestationNote, notarized?, apostille?, caseId
export const POST = withAuthenticatedRoute(
  async ({ req, ctx, params, requestId }) => {
    const poaId = params.id as string;

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return buildErrorResponse(400, "BAD_REQUEST", "Expected multipart/form-data", undefined, requestId);
    }

    const file = formData.get("file") as File | null;
    if (!file) return buildErrorResponse(400, "BAD_REQUEST", "file field is required", undefined, requestId);
    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      return buildErrorResponse(400, "BAD_REQUEST", "Only PDF files are accepted", undefined, requestId);
    }

    const attestationNote = (formData.get("attestationNote") as string | null)?.trim();
    if (!attestationNote) {
      return buildErrorResponse(400, "BAD_REQUEST", "attestationNote is required", undefined, requestId);
    }
    const caseId = (formData.get("caseId") as string | null)?.trim() ?? "";
    const notarized = formData.get("notarized") === "true";
    const apostille = formData.get("apostille") === "true";

    const buf = Buffer.from(await file.arrayBuffer());

    try {
      const poa = await PoaService.uploadWetInk(ctx.accountId, ctx.userId, caseId, {
        poaId,
        documentBuffer: buf,
        documentName: file.name,
        attestation: { verifiedAuthority: true, note: attestationNote },
        notarized,
        apostille,
      });
      return NextResponse.json({ poa, requestId });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === "NOT_FOUND")
        return buildErrorResponse(404, "NOT_FOUND", "POA not found", undefined, requestId);
      return buildErrorResponse(400, "BUSINESS_RULE_FAILURE", errorMessage(error) || "Failed", undefined, requestId);
    }
  },
  { permission: "onboarding.manage", write: true }
);
