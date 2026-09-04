import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getAccountContext, hasPermission } from "@qubere/auth";
import { db, runWithAccountId } from "@qubere/db";
import { AccessDenied } from "@/components/AccessDenied";
import { FreightInvoicesClient } from "./FreightInvoicesClient";

export default async function InvoicesPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const context = await getAccountContext();
  if (!context) {
    redirect("/sign-in");
  }

  const canAccess = await hasPermission("tms.access");
  if (!canAccess) {
    return <AccessDenied />;
  }

  const invoices = await runWithAccountId(context.accountId, async () => {
    return await db.carrierInvoice
      .findMany({
        where: { accountId: context.accountId },
        orderBy: { createdAt: "desc" },
        include: {
          lines: true,
        },
      })
      .catch(() => []);
  });

  return <FreightInvoicesClient initialInvoices={invoices as any[]} />;
}
