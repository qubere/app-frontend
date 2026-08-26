import { getAccountContext } from "@/lib/auth";
import { db, isDataMode, withDataModeContext } from "@/lib/db";
import { ProtestListClient } from "./ProtestListClient";

export const metadata = {
  title: "Protests (Form 19) | Qubere",
  description: "Challenge CBP liquidation decisions under 19 U.S.C. § 1514 within the 180-day window.",
};

export default async function ProtestListPage() {
  const ctx = await getAccountContext();
  if (!ctx) return null;

  const protestsRaw = await withDataModeContext(
    isDataMode(ctx.dataMode) ? ctx.dataMode : null,
    async () =>
      db.protest.findMany({
        where: { accountId: ctx.accountId },
        include: {
          protestEntries: true,
          Attachments: { orderBy: { uploadedAt: "desc" } },
          Notes: { orderBy: { createdAt: "desc" }, take: 5 },
          linkedPsc: { select: { id: true, status: true, correctionType: true } },
        },
        orderBy: { protestDeadline: "asc" },
      })
  );

  const initialProtests = JSON.parse(JSON.stringify(protestsRaw));

  return <ProtestListClient initialProtests={initialProtests} />;
}

