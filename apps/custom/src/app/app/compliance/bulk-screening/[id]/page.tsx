import { notFound, redirect } from "next/navigation";
import { getAccountContext, hasPermission } from "@/lib/auth";
import { ComplianceBatchService } from "@/modules/complianceBatch/service";
import { BulkScreeningDetailClient } from "./BulkScreeningDetailClient";

export const dynamic = "force-dynamic";

export default async function BulkScreeningDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAccountContext();
  if (!ctx) redirect("/sign-in");
  if (!(await hasPermission("compliance.bulk_screening.view"))) redirect("/app/compliance");

  const { id } = await params;
  const batch = await ComplianceBatchService.getBatch(ctx.accountId, id);
  if (!batch) notFound();

  const initialRecords = await ComplianceBatchService.listRecords(ctx.accountId, id, { page: 1, pageSize: 50 });
  const artifacts = await ComplianceBatchService.listArtifacts(ctx.accountId, id);

  const [mayCancel, mayRetry, mayRescreen, mayDownload] = await Promise.all([
    hasPermission("compliance.bulk_screening.cancel"),
    hasPermission("compliance.bulk_screening.retry"),
    hasPermission("compliance.bulk_screening.rescreen"),
    hasPermission("compliance.bulk_screening.download"),
  ]);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
      <BulkScreeningDetailClient
        batchId={id}
        initialBatch={{
          id: batch.id,
          batchType: batch.batchType,
          processingStatus: batch.processingStatus,
          complianceStatus: batch.complianceStatus,
          originalFileName: batch.originalFileName,
          totalRecords: batch.totalRecords,
          validRecords: batch.validRecords,
          processedRecords: batch.processedRecords,
          passedRecords: batch.passedRecords,
          failedRecords: batch.failedRecords,
          reviewRecords: batch.reviewRecords,
          incompleteRecords: batch.incompleteRecords,
          errorRecords: batch.errorRecords,
          createdAt: batch.createdAt.toISOString(),
          completedAt: batch.completedAt ? batch.completedAt.toISOString() : null,
        }}
        initialRecords={initialRecords.records.map((r) => ({
          id: r.id,
          recordNumber: r.recordNumber,
          transactionId: r.transactionId,
          processingStatus: r.processingStatus,
          complianceStatus: r.complianceStatus,
          errorCode: r.errorCode,
          errorMessage: r.errorMessage,
          rpsResultId: r.rpsResultId,
          licenseDeterminationResultId: r.licenseDeterminationResultId,
          embargoStatus: r.embargoStatus,
          classificationStatus: r.classificationStatus,
          classificationHtsCode: r.classificationHtsCode,
          normalizedInput: r.normalizedInput,
          startedAt: r.startedAt ? r.startedAt.toISOString() : null,
          completedAt: r.completedAt ? r.completedAt.toISOString() : null,
        }))}
        initialTotal={initialRecords.total}
        initialPage={initialRecords.page}
        initialPageSize={initialRecords.pageSize}
        mayCancel={mayCancel}
        mayRetry={mayRetry}
        mayRescreen={mayRescreen}
        mayDownload={mayDownload}
        artifacts={artifacts.map((a) => ({
          id: a.id,
          artifactType: a.artifactType,
          originalFileName: a.originalFileName,
        }))}
      />
    </div>
  );
}
