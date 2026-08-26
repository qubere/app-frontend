import { getAccountContext } from "@/lib/auth";
import { isDataMode, withDataModeContext } from "@/lib/db";
import { BondService } from "@/modules/bonds/bond.service";
import { BondsClient } from "./BondsClient";

export default async function BondsPage() {
  const context = await getAccountContext();

  if (!context) {
    return null;
  }

  const bondsRaw = await withDataModeContext(
    isDataMode(context.dataMode) ? context.dataMode : null,
    async () => BondService.listBonds(context.accountId)
  );

  const initialBonds = JSON.parse(JSON.stringify(bondsRaw));

  return (
    <BondsClient
      accountName={context.accountName}
      initialBonds={initialBonds}
    />
  );
}

