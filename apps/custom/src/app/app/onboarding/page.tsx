import { getAccountContext } from "@/lib/auth";
import { CaseListClient } from "./CaseListClient";
import { db } from "@/lib/db";

export default async function OnboardingPage() {
  const context = await getAccountContext();
  if (!context) return null;

  const cases = await db.onboardingCase.findMany({
    where: { accountId: context.accountId },
    include: {
      client: { select: { id: true, name: true } },
      primaryImporter: { select: { id: true, name: true } },
      entities: { select: { id: true, screeningStatus: true, bondCoverage: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const brokerProfile = await db.brokerComplianceProfile.findUnique({
    where: { accountId: context.accountId },
    select: { status: true },
  });

  return (
    <CaseListClient
      cases={JSON.parse(JSON.stringify(cases))}
      brokerProfileStatus={brokerProfile?.status ?? null}
    />
  );
}
