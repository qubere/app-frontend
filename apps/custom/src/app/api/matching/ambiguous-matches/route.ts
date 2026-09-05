import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { listPendingMatchProposals } from "@/modules/matching/ambiguousMatchService";
import { MatchProposalDomain, MatchProposalStatus } from "@prisma/client";

export const GET = withAuthenticatedRoute(async ({ req, ctx }) => {
  const url = new URL(req.url);
  const domainRaw = url.searchParams.get("domain");
  const statusRaw = url.searchParams.get("status");
  const pageRaw = url.searchParams.get("page");
  const pageSizeRaw = url.searchParams.get("pageSize");

  const domain = domainRaw === "PARTY" || domainRaw === "PRODUCT" ? (domainRaw as MatchProposalDomain) : undefined;
  const status =
    statusRaw === "PENDING" || statusRaw === "CONFIRMED" || statusRaw === "REJECTED" || statusRaw === "CREATED_NEW"
      ? (statusRaw as MatchProposalStatus)
      : undefined;

  const pageParsed = pageRaw ? parseInt(pageRaw, 10) : 1;
  const pageSizeParsed = pageSizeRaw ? parseInt(pageSizeRaw, 10) : 20;
  const page = Number.isInteger(pageParsed) && pageParsed > 0 ? pageParsed : 1;
  const pageSize = Number.isInteger(pageSizeParsed) && pageSizeParsed > 0 ? pageSizeParsed : 20;

  const result = await listPendingMatchProposals(
    { accountId: ctx.accountId },
    { domain, status, page, pageSize }
  );

  return NextResponse.json(result);
});
