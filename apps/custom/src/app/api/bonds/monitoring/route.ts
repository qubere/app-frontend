import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { BondMonitoringService } from "@/modules/onboarding/bondMonitoring.service";

export const GET = withAuthenticatedRoute(
  async ({ ctx, requestId }) => {
    try {
      const accountId = ctx.accountId;

      const [sufficiencyRes, stackingRes] = await Promise.all([
        BondMonitoringService.checkBondSufficiencyForAccount(accountId),
        BondMonitoringService.checkBondStacking(accountId),
      ]);

      return NextResponse.json({
        accountId,
        sufficiency: {
          requiredAmount: sufficiencyRes.sufficiency.requiredAmount.toFixed(2),
          rawAmount: sufficiencyRes.sufficiency.rawAmount.toFixed(2),
          actualAmount: sufficiencyRes.sufficiency.actualAmount?.toFixed(2) ?? null,
          shortfall: sufficiencyRes.sufficiency.shortfall?.toFixed(2) ?? null,
          sufficient: sufficiencyRes.sufficiency.sufficient,
          basis: sufficiencyRes.sufficiency.basis,
        },
        stacking: {
          stackingRequired: stackingRes.stackingRequired,
          activeContinuousBondAmount: stackingRes.activeContinuousBondAmount?.toFixed(2) ?? null,
          requiredContinuousBondAmount: stackingRes.requiredContinuousBondAmount.toFixed(2),
          shortfallAmount: stackingRes.shortfallAmount?.toFixed(2) ?? null,
          recommendedStbAmount: stackingRes.recommendedStbAmount?.toFixed(2) ?? null,
          recommendationType: stackingRes.recommendationType,
          details: stackingRes.details,
        },
        bondsEvaluated: sufficiencyRes.bondsEvaluated,
        requestId,
      });
    } catch (error: unknown) {
      return buildErrorResponse(
        500,
        "INTERNAL_ERROR",
        errorMessage(error) || "Failed to retrieve bond monitoring status",
        undefined,
        requestId
      );
    }
  },
  { permission: "onboarding.read" }
);
