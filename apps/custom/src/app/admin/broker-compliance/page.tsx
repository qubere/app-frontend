import { getAccountContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { BrokerComplianceClient } from "./BrokerComplianceClient";

export default async function BrokerCompliancePage() {
  const context = await getAccountContext();
  if (!context) return null;

  const profile = await db.brokerComplianceProfile.findUnique({
    where: { accountId: context.accountId },
    include: { permitQualifyingOfficers: true, districtPermits: true },
  });

  return (
    <BrokerComplianceClient
      profile={profile ? JSON.parse(JSON.stringify(profile)) : null}
    />
  );
}
