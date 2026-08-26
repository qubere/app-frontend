import { getAccountContext } from "@/lib/auth";
import { db, isDataMode, withDataModeContext } from "@/lib/db";
import { PscListClient } from "./PscListClient";

export const metadata = {
  title: "Post-Summary Corrections | Qubere",
  description: "Correct entry summaries before CBP liquidation within the 270-day window.",
};

export default async function PscListPage() {
  const ctx = await getAccountContext();
  if (!ctx) return null;

  const pscsRaw = await withDataModeContext(
    isDataMode(ctx.dataMode) ? ctx.dataMode : null,
    async () =>
      db.postSummaryCorrection.findMany({
        where: { accountId: ctx.accountId },
        include: {
          originalFiling: {
            include: {
              shipment: {
                include: {
                  complianceDeadlines: {
                    where: { type: "PSC_WINDOW" },
                    take: 1,
                  },
                },
              },
            },
          },
          refundOpportunity: true,
          Attachments: { orderBy: { uploadedAt: "desc" } },
        },
        orderBy: { createdAt: "desc" },
      })
  );

  const initialPscs = JSON.parse(JSON.stringify(pscsRaw));

  return <PscListClient initialPscs={initialPscs} />;
}

