import { getAccountContext } from "@/lib/auth";
import { CaseListClient } from "./CaseListClient";
import { db, type DataMode } from "@/lib/db";

export default async function OnboardingPage() {
  const context = await getAccountContext();
  if (!context) return null;

  const [cases, brokerProfile] = await Promise.all([
      db.onboardingCase.findMany({
        where: { accountId: context.accountId, account: { dataMode: context.dataMode as DataMode } },
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
  ]);

  return (
    <CaseListClient
      cases={JSON.parse(JSON.stringify(cases))}
      brokerProfileStatus={brokerProfile?.status ?? null}
    />
  );
}

