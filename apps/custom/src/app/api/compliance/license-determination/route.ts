/**
 * POST /api/compliance/license-determination
 *
 * Runs a new License Determination via the canonical
 * LicenseDeterminationService -- this route performs NO rule evaluation
 * itself, it only validates the request shape and delegates.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { runLicenseDetermination } from "@/modules/licenses/determinationService";
import { CLASSIFICATION_TYPES } from "@/modules/licenses/classification";

const triState = z.enum(["TRUE", "FALSE", "UNKNOWN", "DISABLED"]).optional();

const requestSchema = z.object({
  operationType: z.enum(["EXPORT", "IMPORT"]),
  classification: z.object({
    type: z.enum(CLASSIFICATION_TYPES as [string, ...string[]]),
    value: z.string().min(1),
  }),
  complianceCountry: z.string().optional().nullable(),
  destinationCountry: z.string().optional().nullable(),
  originCountry: z.string().optional().nullable(),
  conditions: z
    .object({
      governmentEndUser: triState,
      militaryEndUser: triState,
      nuclearEndUse: triState,
      missileTechnologyEndUse: triState,
      chemicalBiologicalEndUse: triState,
      internalUseOnly: triState,
      usSubsidiary: triState,
      encryptionItem: triState,
      encryptionSelfClassified: triState,
      replacementPartsIndicator: triState,
      militaryEndUseCountry: triState,
    })
    .optional(),
  quantity: z.union([z.number(), z.string()]).optional().nullable(),
  value: z.union([z.number(), z.string()]).optional().nullable(),
  currency: z.string().optional().nullable(),
  shipmentId: z.string().optional().nullable(),
  lineItemId: z.string().optional().nullable(),
  productId: z.string().optional().nullable(),
  transactionId: z.string().optional().nullable(),
  transactionLineId: z.string().optional().nullable(),
  exceptionClaim: z.object({ exceptionCode: z.string().min(1), reason: z.string().min(1) }).optional(),
});

export const POST = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const body = await req.json().catch(() => null);
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return buildErrorResponse(400, "INVALID_INPUT", "Request validation failed", parsed.error.issues, requestId);
    }

    const { exceptionClaim, ...input } = parsed.data;
    const record = await runLicenseDetermination(
      {
        accountId: ctx.accountId,
        userId: ctx.userId,
        source: "API",
        operationType: input.operationType,
        classification: input.classification as { type: (typeof CLASSIFICATION_TYPES)[number]; value: string },
        complianceCountry: input.complianceCountry,
        destinationCountry: input.destinationCountry,
        originCountry: input.originCountry,
        conditions: input.conditions,
        quantity: input.quantity,
        value: input.value,
        currency: input.currency,
        shipmentId: input.shipmentId,
        lineItemId: input.lineItemId,
        productId: input.productId,
        transactionId: input.transactionId,
        transactionLineId: input.transactionLineId,
      },
      { exceptionClaim }
    );

    return NextResponse.json({ determination: record, requestId }, { status: 201 });
  },
  { permission: "compliance.license_determination.execute", write: true }
);
