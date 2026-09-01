import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { db } from "@/lib/db";
import { Decimal } from "@/lib/tariff/decimal";
import { computeBondSufficiency } from "@/modules/onboarding/bondSufficiency";

export const GET = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const { searchParams } = new URL(req.url);
    const caseId = searchParams.get("caseId");
    if (!caseId) return buildErrorResponse(400, "VALIDATION_ERROR", "caseId is required", undefined, requestId);

    try {
      const onboardingCase = await db.onboardingCase.findUnique({
        where: { id: caseId },
        include: {
          entities: { include: { bond: true } },
        },
      });
      if (!onboardingCase || onboardingCase.accountId !== ctx.accountId) {
        return buildErrorResponse(404, "NOT_FOUND", "Case not found", undefined, requestId);
      }

      const results = await Promise.all(
        onboardingCase.entities.map(async (entity) => {
          if (entity.bondCoverage !== "own" || !entity.bond) {
            return {
              entityId: entity.id,
              bondCoverage: entity.bondCoverage,
              sufficiency: null,
            };
          }

          // Determine basis: historical (actual filings) or projected
          let basis: "HISTORICAL" | "PROJECTED" = "PROJECTED";
          let priorYearDtf = onboardingCase.projectedAnnualDutyTaxFee
            ? new Decimal(onboardingCase.projectedAnnualDutyTaxFee.toString())
            : new Decimal(0);

          if (entity.importerOfRecordId) {
            const since = new Date();
            since.setFullYear(since.getFullYear() - 1);
            const agg = await db.customsFiling.aggregate({
              where: {
                accountId: ctx.accountId,
                importerOfRecordId: entity.importerOfRecordId,
                createdAt: { gte: since },
              },
              _sum: {
                grandTotalDutyAmount: true,
                grandTotalUserFeeAmount: true,
                grandTotalIrTaxAmount: true,
              },
            });
            const sum =
              new Decimal((agg._sum?.grandTotalDutyAmount ?? 0).toString())
                .plus(new Decimal((agg._sum?.grandTotalUserFeeAmount ?? 0).toString()))
                .plus(new Decimal((agg._sum?.grandTotalIrTaxAmount ?? 0).toString()));
            if (sum.gt(0)) {
              priorYearDtf = sum;
              basis = "HISTORICAL";
            }
          }

          const actualAmount = new Decimal(entity.bond.bondAmount.toString());
          const sufficiency = computeBondSufficiency(priorYearDtf, basis, actualAmount);

          return {
            entityId: entity.id,
            bondId: entity.bond.id,
            bondCoverage: entity.bondCoverage,
            sufficiency: {
              requiredAmount: sufficiency.requiredAmount.toFixed(2),
              rawAmount: sufficiency.rawAmount.toFixed(2),
              actualAmount: sufficiency.actualAmount?.toFixed(2) ?? null,
              shortfall: sufficiency.shortfall?.toFixed(2) ?? null,
              sufficient: sufficiency.sufficient,
              basis: sufficiency.basis,
              priorYearDutyTaxFee: priorYearDtf.toFixed(2),
            },
          };
        })
      );

      return NextResponse.json({ entities: results, requestId });
    } catch (error: unknown) {
      return buildErrorResponse(500, "INTERNAL_ERROR", errorMessage(error) || "Failed", undefined, requestId);
    }
  },
  { permission: "onboarding.manage" }
);
