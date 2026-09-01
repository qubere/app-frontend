import { getAccountContext } from "@/lib/auth";
import { holdsPermission } from "@/modules/party/partyActor";
import { redirect } from "next/navigation";
import { TradeRepositoryClient } from "./TradeRepositoryClient";

export const dynamic = "force-dynamic";

export default async function TradeRepositoryPage() {
  const context = await getAccountContext();
  if (!context) return null;

  if (!holdsPermission(context, "document.read")) {
    redirect("/app/dashboard");
  }

  return <TradeRepositoryClient canManage={holdsPermission(context, "document.update")} />;
}
