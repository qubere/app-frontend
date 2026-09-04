import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAccountContext, hasPermission } from "@/lib/auth";
import { CommunityScreeningService } from "@/modules/compliance/communityScreening/service";
import { LICENSE_DETERMINATION_NOTICE } from "@/modules/compliance/communityScreening/types";
import { CommunityScreeningRunClient } from "./CommunityScreeningRunClient";

export const revalidate = 0;

export default async function CommunityScreeningRunPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAccountContext();
  if (!ctx) redirect("/sign-in");
  if (!(await hasPermission("compliance.community_screening.read"))) redirect("/app/compliance");

  const { id } = await params;
  const mayScreen = await hasPermission("compliance.community_screening.screen");

  const initial = await CommunityScreeningService.getRunResults(ctx.accountId, id, { page: 1, pageSize: 50 });
  if (!initial) notFound();

  const run = {
    id: initial.run.id,
    status: initial.run.status,
    source: initial.run.source,
    inputMode: initial.run.inputMode,
    totalParties: initial.run.totalParties,
    passedCount: initial.run.passedCount,
    failedCount: initial.run.failedCount,
    incompleteCount: initial.run.incompleteCount,
    errorCount: initial.run.errorCount,
    checksEnabled: initial.run.checksEnabled as { restrictedParty: boolean; embargo: boolean },
    complianceCountry: initial.run.complianceCountry,
    transactionReference: initial.run.transactionReference,
    createdAt: initial.run.createdAt.toISOString(),
    startedAt: initial.run.startedAt ? initial.run.startedAt.toISOString() : null,
    completedAt: initial.run.completedAt ? initial.run.completedAt.toISOString() : null,
  };

  const results = initial.results.map((r) => ({
    id: r.id,
    rowNumber: r.rowNumber,
    partyId: r.partyId,
    externalReference: r.externalReference,
    snapshotName: r.snapshotName,
    snapshotCountry: r.snapshotCountry,
    snapshotAddress: r.snapshotAddress,
    snapshotCity: r.snapshotCity,
    restrictedPartyEnabled: r.restrictedPartyEnabled,
    embargoEnabled: r.embargoEnabled,
    restrictedPartyStatus: r.restrictedPartyStatus,
    restrictedPartyResultId: r.restrictedPartyResultId,
    restrictedPartyMatchFound: r.restrictedPartyMatchFound,
    restrictedPartyRedFlagFound: r.restrictedPartyRedFlagFound,
    restrictedPartyFindingCategory: r.restrictedPartyFindingCategory,
    embargoStatus: r.embargoStatus,
    embargoEvidence: r.embargoEvidence as Record<string, unknown> | null,
    aggregateStatus: r.aggregateStatus,
    failureReason: r.failureReason,
    errorMessage: r.errorMessage,
    evaluatedAt: r.evaluatedAt ? r.evaluatedAt.toISOString() : null,
  }));

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/app/compliance?tab=community-screening" className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Community Screening
          </Link>
          <h1 className="text-2xl font-extrabold text-ink tracking-tight mt-1">Screening Run</h1>
        </div>
      </div>

      <CommunityScreeningRunClient
        runId={id}
        initialRun={run}
        initialResults={results}
        initialTotal={initial.total}
        initialPage={initial.page}
        initialPageSize={initial.pageSize}
        mayScreen={mayScreen}
        licenseNotice={LICENSE_DETERMINATION_NOTICE}
      />
    </div>
  );
}
