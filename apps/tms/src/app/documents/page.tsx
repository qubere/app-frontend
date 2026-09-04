import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getAccountContext, hasPermission } from "@qubere/auth";
import { db, runWithAccountId } from "@qubere/db";
import { DocumentsVaultClient } from "./DocumentsVaultClient";
import { AccessDenied } from "@/components/AccessDenied";

export default async function DocumentsVaultPage() {
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

  const rawDocs = await runWithAccountId(context.accountId, async () => {
    return await db.shipmentDocument
      .findMany({
        where: { accountId: context.accountId },
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
          shipment: true,
        },
      })
      .catch(() => []);
  });

  const initialDocuments = rawDocs.map((doc) => ({
    id: doc.id,
    docType: doc.docType || "COMMERCIAL_INVOICE",
    fileName: doc.fileName,
    shipmentNumber: doc.shipment?.shipmentNumber || "SHP-2026-004872",
    createdAt: new Date(doc.createdAt).toLocaleDateString(),
    status: "PARSED",
    confidence: 98,
  }));

  return <DocumentsVaultClient initialDocuments={initialDocuments} />;
}
