import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { validatePathParams } from "@/lib/api/validation";
import { FieldReviewService, type FieldReviewAction } from "@/modules/hydration/review/fieldReviewService";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string().min(1) });

const postBodySchema = z.object({
  fieldKey: z.string().min(1),
  action: z.enum(["APPROVE", "EDIT", "REJECT", "MARK_NOT_APPLICABLE", "SELECT_ALTERNATE"]),
  value: z.string().optional(),
  candidateId: z.string().optional(),
  expectedVersion: z.number().int().nonnegative(),
});

export const GET = withAuthenticatedRoute<{ id: string }>(async ({ ctx, requestId, params, req }) => {
  const paramsVal = validatePathParams(params, paramsSchema, requestId);
  if ("response" in paramsVal) return paramsVal.response;
  const { id: shipmentId } = paramsVal.data;

  const url = new URL(req.url);
  const documentId = url.searchParams.get("documentId") || "";

  try {
    const summary = await FieldReviewService.getShipmentDocumentFieldReview(
      ctx.accountId,
      shipmentId,
      documentId
    );
    return NextResponse.json({ summary, requestId });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg, requestId }, { status: 400 });
  }
});

export const POST = withAuthenticatedRoute<{ id: string }>(async ({ ctx, requestId, params, req }) => {
  const paramsVal = validatePathParams(params, paramsSchema, requestId);
  if ("response" in paramsVal) return paramsVal.response;
  const { id: shipmentId } = paramsVal.data;

  try {
    const body = await req.json();
    const parsedBody = postBodySchema.parse(body);

    const result = await FieldReviewService.submitFieldReviewAction({
      accountId: ctx.accountId,
      userId: ctx.userId,
      userName: ctx.userId,
      shipmentId,
      documentId: body.documentId || "",
      fieldKey: parsedBody.fieldKey,
      action: parsedBody.action as FieldReviewAction,
      value: parsedBody.value || "",
      candidateId: parsedBody.candidateId,
      expectedVersion: parsedBody.expectedVersion,
    });

    return NextResponse.json({ result, requestId });
  } catch (err: any) {
    const status = err?.status === 409 || err?.message?.includes("STALE_SHIPMENT") ? 409 : 400;
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg, requestId }, { status });
  }
});
