import { canWrite } from "@/lib/api/write-access";
import { getAccountContext, hasPermission } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AssistRegistry } from "./AssistRegistry";
export default async function AssistsPage({ searchParams }: { searchParams: Promise<{ supplierId?: string; manufacturerId?: string }> }) {
  const context = await getAccountContext();
  if (!context) redirect("/sign-in");
  if (!await hasPermission("valuation.read")) redirect("/app/dashboard");
  const query = await searchParams;
  return <AssistRegistry canUpdate={canWrite(context) && await hasPermission("valuation.update")} supplierId={query.supplierId} manufacturerId={query.manufacturerId}/>;
}
