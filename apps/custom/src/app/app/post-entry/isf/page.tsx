import { redirect } from "next/navigation";
import { getAccountContext, hasPermission } from "@/lib/auth";
import { isDataMode, withDataModeContext } from "@/lib/db";
import { listImporterSecurityFilings } from "@/modules/isf/isfTransactionService";
import { IsfClient } from "./IsfClient";

export const metadata = {
  title: "ISF 10+2 Filings | Qubere",
  description: "Prepare and submit Importer Security Filings with deadline and penalty tracking.",
};

export default async function IsfPage() {
  const ctx = await getAccountContext();
  if (!ctx) return null;
  if (!(await hasPermission("entry.read"))) redirect("/app/dashboard");

  const filings = await withDataModeContext(
    isDataMode(ctx.dataMode) ? ctx.dataMode : null,
    () => listImporterSecurityFilings(ctx.accountId)
  );

  return <IsfClient initialFilings={JSON.parse(JSON.stringify(filings))} />;
}
