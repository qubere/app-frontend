import { getAccountContext, hasPermission } from "@/lib/auth";
import { db, type DataMode } from "@/lib/db";
import { computeReadiness } from "@/modules/onboarding/readiness";
import { notFound, redirect } from "next/navigation";
import { OnboardingWizardClient } from "@/components/onboarding/OnboardingWizardClient";
import { logger } from "@/lib/logging/logger";

interface Props {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ step?: string }>;
}

export default async function OnboardingCasePage({ params, searchParams }: Props) {
  const { caseId } = await params;
  const { step } = await searchParams;
  const context = await getAccountContext();
  if (!context) redirect("/sign-in");
  if (!(await hasPermission("onboarding.manage"))) redirect("/app/dashboard");

  // Explicit account.dataMode in where bypasses the middleware's AsyncLocalStorage-based
  // injection (which is unreliable in RSC) and directly matches the tenant's data mode.
  const c = await db.onboardingCase.findFirst({
    where: {
      id: caseId,
      accountId: context.accountId,
      account: { dataMode: context.dataMode as DataMode },
    },
    include: {
      client: true,
      primaryImporter: true,
      entities: {
        include: {
          legalEntity: true,
          importerOfRecord: true,
          poa: { include: { envelope: true } },
          bond: {
            include: {
              verifications: { orderBy: { performedAt: "desc" }, take: 1 },
            },
          },
        },
      },
      fiveOhSixRecords: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!c) {
    logger.warn("Onboarding case not found in DB", { caseId, accountId: context.accountId, dataMode: context.dataMode });
    notFound();
  }

  const readiness = computeReadiness(c as Parameters<typeof computeReadiness>[0]);
  const stepParam = step ? parseInt(step) : c.currentStep;

  return (
    <OnboardingWizardClient
      initialCase={JSON.parse(JSON.stringify({ ...c, readiness }))}
      initialStep={stepParam}
    />
  );
}
