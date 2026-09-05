import { redirect } from "next/navigation";
import { getAccountContext } from "@/lib/auth";
import { listPendingMatchProposals } from "@/modules/matching/ambiguousMatchService";
import { AmbiguousMatchReviewClient } from "./AmbiguousMatchReviewClient";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ domain?: string; status?: string }>;
}

export default async function MatchingReviewPage({ searchParams }: Props) {
  const ctx = await getAccountContext();
  if (!ctx) redirect("/sign-in");

  const query = await searchParams;
  const domain = query.domain === "PARTY" || query.domain === "PRODUCT" ? query.domain : undefined;
  const status =
    query.status === "PENDING" || query.status === "CONFIRMED" || query.status === "REJECTED" || query.status === "CREATED_NEW"
      ? query.status
      : "PENDING";

  const { rows, total } = await listPendingMatchProposals(
    { accountId: ctx.accountId },
    { domain, status, page: 1, pageSize: 50 }
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">Ambiguous Match Review Queue</h1>
        <p className="text-sm text-ink-muted mt-1">
          Review candidate match proposals from document intelligence and master data matching. Confirm a candidate, create a new record, or reject.
        </p>
      </div>

      <AmbiguousMatchReviewClient
        initialProposals={JSON.parse(JSON.stringify(rows))}
        totalCount={total}
        currentDomain={domain ?? "ALL"}
        currentStatus={status}
      />
    </div>
  );
}
