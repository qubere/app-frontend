import { getAccountContext } from "@/lib/auth";
import { CaseListClient } from "./CaseListClient";
import { db, runWithDataMode, type DataMode } from "@/lib/db";

export default async function OnboardingPage() {
  const context = await getAccountContext();
  if (!context) return null;

  const [cases, brokerProfile] = await runWithDataMode(context.dataMode as DataMode, () =>
    Promise.all([
      db.onboardingCase.findMany({
        where: { accountId: context.accountId },
        include: {
          client: { select: { id: true, name: true } },
          primaryImporter: { select: { id: true, name: true } },
          entities: { select: { id: true, screeningStatus: true, bondCoverage: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      db.brokerComplianceProfile.findUnique({
        where: { accountId: context.accountId },
        select: { status: true },
      }),
    ])
  );

  return (
    <CaseListClient
      cases={JSON.parse(JSON.stringify(cases))}
      brokerProfileStatus={brokerProfile?.status ?? null}
    />
  );
}

