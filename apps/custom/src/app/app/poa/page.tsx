import { getAccountContext } from "@/lib/auth";
import { db, isDataMode, withDataModeContext } from "@/lib/db";
import { PoaClient } from "./PoaClient";

export default async function PoaPage() {
  const context = await getAccountContext();

  if (!context) {
    return null;
  }

  const importersRaw = await withDataModeContext(
    isDataMode(context.dataMode) ? context.dataMode : null,
    async () =>
      db.importerOfRecord.findMany({
        where: { accountId: context.accountId },
        include: {
          bond: true,
          powersOfAttorney: true,
          client: true,
        },
        orderBy: { createdAt: "desc" },
      })
  );

  const initialImporters = JSON.parse(JSON.stringify(importersRaw));

  return (
    <PoaClient
      accountName={context.accountName}
      initialImporters={initialImporters}
    />
  );
}

