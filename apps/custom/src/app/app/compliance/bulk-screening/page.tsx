import { redirect } from "next/navigation";
import { getAccountContext, hasPermission } from "@/lib/auth";
import { ComplianceBatchService } from "@/modules/complianceBatch/service";
import { BulkScreeningListClient } from "./BulkScreeningListClient";

export const dynamic = "force-dynamic";

export default async function BulkScreeningPage() {
  const ctx = await getAccountContext();
  if (!ctx) redirect("/sign-in");
  if (!(await hasPermission("compliance.bulk_screening.view"))) redirect("/app/compliance");

  const mayCreate = await hasPermission("compliance.bulk_screening.create");
  const mayImportPreApprovals = await hasPermission("compliance.restricted_party.approve");
  const initial = await ComplianceBatchService.listBatches(ctx.accountId, { page: 1, pageSize: 20 });

  const batches = initial.batches.map((b) => ({
    id: b.id,
    batchType: b.batchType,
    processingStatus: b.processingStatus,
    complianceStatus: b.complianceStatus,
    originalFileName: b.originalFileName,
    totalRecords: b.totalRecords,
    validRecords: b.validRecords,
    passedRecords: b.passedRecords,
    failedRecords: b.failedRecords,
    reviewRecords: b.reviewRecords,
    errorRecords: b.errorRecords,
    createdAt: b.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-extrabold text-ink tracking-tight">Bulk Compliance Screening</h1>
        <p className="text-sm text-ink-muted mt-1">
          Upload a transaction file to screen every line against Restricted Party and License Determination rules.
        </p>
      </div>

      <BulkScreeningListClient
        initialBatches={batches}
        initialTotal={initial.total}
        initialPage={initial.page}
        initialPageSize={initial.pageSize}
        mayCreate={mayCreate}
        mayImportPreApprovals={mayImportPreApprovals}
      />
    </div>
  );
}
