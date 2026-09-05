import { redirect } from "next/navigation";
import { getAccountContext, hasPermission } from "@/lib/auth";
import { isDataMode, withDataModeContext } from "@/lib/db";
import { listDutyPaymentInstructions } from "@/modules/payments/achDutyPaymentService";
import { DutyPaymentsClient } from "./DutyPaymentsClient";

export const metadata = {
  title: "Duty Statement Payments | Qubere",
  description: "Track ACH payment instructions for CBP daily and Periodic Monthly Statements.",
};

export default async function DutyPaymentsPage() {
  const ctx = await getAccountContext();
  if (!ctx) return null;
  if (!(await hasPermission("billing.payment.view"))) redirect("/app/dashboard");

  const payments = await withDataModeContext(
    isDataMode(ctx.dataMode) ? ctx.dataMode : null,
    () => listDutyPaymentInstructions(ctx.accountId)
  );

  return <DutyPaymentsClient initialPayments={JSON.parse(JSON.stringify(payments))} />;
}
