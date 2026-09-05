import { redirect } from "next/navigation";
import { getAccountContext, hasPermission } from "@/lib/auth";
import { isDataMode, withDataModeContext } from "@/lib/db";
import { listPriorDisclosures } from "@/modules/postEntry/priorDisclosureCalculator";
import { PriorDisclosureClient } from "./PriorDisclosureClient";

export const metadata = {
  title: "Prior Disclosure (§1592) | Qubere",
  description: "Model 19 U.S.C. § 1592 penalty exposure and record prior disclosures.",
};

export default async function PriorDisclosurePage() {
  const ctx = await getAccountContext();
  if (!ctx) return null;
  if (!(await hasPermission("psc.read"))) redirect("/app/dashboard");

  const disclosures = await withDataModeContext(
    isDataMode(ctx.dataMode) ? ctx.dataMode : null,
    () => listPriorDisclosures(ctx.accountId)
  );

  return <PriorDisclosureClient initialDisclosures={JSON.parse(JSON.stringify(disclosures))} />;
}
