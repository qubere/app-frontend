import { redirect } from "next/navigation";
import { getAccountContext, hasPermission } from "@/lib/auth";
import { isDataMode, withDataModeContext } from "@/lib/db";
import {
  listCbpReconciliationEntries,
  listCbpReconciliationFlags,
} from "@/modules/reconciliation/cbpReconciliationService";
import { CbpReconciliationClient } from "./CbpReconciliationClient";

export const metadata = {
  title: "CBP Reconciliation Program | Qubere",
  description: "Flag entries for the 21-month CBP Reconciliation Program and bundle them for transmission.",
};

export default async function CbpReconciliationPage() {
  const ctx = await getAccountContext();
  if (!ctx) return null;
  if (!(await hasPermission("psc.read"))) redirect("/app/dashboard");

  const [flags, entries] = await withDataModeContext(
    isDataMode(ctx.dataMode) ? ctx.dataMode : null,
    async () =>
      Promise.all([
        listCbpReconciliationFlags(ctx.accountId),
        listCbpReconciliationEntries(ctx.accountId),
      ])
  );

  return (
    <CbpReconciliationClient
      initialFlags={JSON.parse(JSON.stringify(flags))}
      initialEntries={JSON.parse(JSON.stringify(entries))}
    />
  );
}
