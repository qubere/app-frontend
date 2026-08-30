import { redirect } from "next/navigation";
import { getAccountContext, hasPermission } from "@/lib/auth";
import { db, isDataMode, withDataModeContext } from "@/lib/db";
import { UnauthorizedModuleState } from "@/components/UnauthorizedModuleState";
import { ClassificationInboxClient, type InboxCase } from "./ClassificationInboxClient";

export const dynamic = "force-dynamic";

export default async function ClassificationInboxPage() {
  const ctx = await getAccountContext();
  if (!ctx) redirect("/sign-in");

  if (!(await hasPermission("classification.read"))) {
    return (
      <UnauthorizedModuleState
        moduleName="HTS Classification"
        requiredPermission="classification.read"
        adminEmail={ctx.adminEmail}
        isUserAdmin={ctx.isPlatformAdmin || ctx.roleNames.includes("OWNER") || ctx.roleNames.includes("ADMIN")}
      />
    );
  }

  const canRun = await hasPermission("classification.create");

  const cases = await withDataModeContext(isDataMode(ctx.dataMode) ? ctx.dataMode : null, async () =>
    db.classificationCase.findMany({
      where: { accountId: ctx.accountId },
      include: {
        subjects: { select: { rawDescription: true, canonicalProductId: true, countryOfOrigin: true } },
        documents: { select: { id: true } },
        runs: {
          take: 1,
          orderBy: { startedAt: "desc" },
          include: {
            proposals: {
              take: 1,
              orderBy: { rank: "asc" },
              include: { proposedNode: { select: { htsNumberDisplay: true, description: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    })
  );

  const serialized: InboxCase[] = cases.map((c) => {
    const subject = c.subjects[0];
    const run = c.runs[0];
    const proposal = run?.proposals[0];
    return {
      id: c.id,
      status: c.status,
      priority: c.priority,
      createdAt: c.createdAt.toISOString(),
      dueAt: c.dueAt ? c.dueAt.toISOString() : null,
      description: subject?.rawDescription ?? "(no description)",
      countryOfOrigin: subject?.countryOfOrigin ?? null,
      canonicalProductId: subject?.canonicalProductId ?? null,
      documentCount: c.documents.length,
      latestRun: run
        ? {
            status: run.status,
            startedAt: run.startedAt.toISOString(),
            topProposal: proposal
              ? {
                  hts: proposal.proposedNode.htsNumberDisplay,
                  description: proposal.proposedNode.description,
                  confidence: proposal.calibratedConfidence,
                  band: proposal.confidenceBand,
                }
              : null,
          }
        : null,
    };
  });

  return <ClassificationInboxClient cases={serialized} canRun={canRun} />;
}
