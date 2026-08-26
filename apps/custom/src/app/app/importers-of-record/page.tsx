import { getAccountContext } from "@/lib/auth";
import { db, isDataMode, withDataModeContext } from "@/lib/db";
import { ImportersClient } from "./ImportersClient";

export default async function ImportersPage() {
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
    <ImportersClient
      accountName={context.accountName}
      initialImporters={initialImporters}
    />
  );
}

