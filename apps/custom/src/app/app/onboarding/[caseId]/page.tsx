import { getAccountContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeReadiness } from "@/modules/onboarding/readiness";
import { notFound } from "next/navigation";
import { OnboardingWizardClient } from "@/components/onboarding/OnboardingWizardClient";

interface Props {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ step?: string }>;
}

export default async function OnboardingCasePage({ params, searchParams }: Props) {
  const { caseId } = await params;
  const { step } = await searchParams;
  const context = await getAccountContext();
  if (!context) return null;

  const c = await db.onboardingCase.findUnique({
    where: { id: caseId },
    include: {
      client: true,
      primaryImporter: true,
      entities: {
        include: {
          legalEntity: true,
          importerOfRecord: true,
          poa: true,
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

  if (!c || c.accountId !== context.accountId) notFound();

  const readiness = computeReadiness(c as Parameters<typeof computeReadiness>[0]);
  const stepParam = step ? parseInt(step) : c.currentStep;

  return (
    <OnboardingWizardClient
      initialCase={JSON.parse(JSON.stringify({ ...c, readiness }))}
      initialStep={stepParam}
    />
  );
}
