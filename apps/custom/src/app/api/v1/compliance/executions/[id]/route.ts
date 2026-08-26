/**
 * GET /api/v1/compliance/executions/[id]
 *
 * Execution detail/timeline endpoint: one ComplianceExecution plus its
 * related ComplianceFormalOverride rows and linked ComplianceScreeningFinding
 * rows, ordered chronologically. Tenant-scoped -- an id belonging to another
 * account is reported as not found, never forbidden (avoids an
 * account-enumeration oracle). Requires `audit.read` or `compliance.read`.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { validatePathParams } from "@/lib/api/validation";
import { db } from "@/lib/db";

const paramsSchema = z.object({ id: z.string().min(1) });

export const GET = withAuthenticatedRoute<{ id: string }>(
  async ({ ctx, requestId, params }) => {
    const paramsVal = validatePathParams(params, paramsSchema, requestId);
    if ("response" in paramsVal) return paramsVal.response;

    const execution = await db.complianceExecution.findFirst({
      where: { id: paramsVal.data.id, accountId: ctx.accountId },
      include: {
        overrides: { orderBy: { overriddenAt: "asc" } },
        screeningFindings: { orderBy: { createdAt: "asc" } },
        parentExecution: { select: { id: true, executionType: true, startedAt: true } },
        rescreens: { select: { id: true, executionType: true, startedAt: true, status: true } },
        initiatedByUser: { select: { id: true, name: true, email: true } },
      },
    });

    if (!execution) {
      return NextResponse.json({ error: "Execution not found", requestId }, { status: 404 });
    }

    // Chronological timeline -- the execution's own lifecycle events plus its
    // overrides and findings, merged and sorted, so the UI can render one
    // linear history without re-deriving ordering itself.
    const timeline = [
      { at: execution.startedAt, kind: "EXECUTION_STARTED" as const, ref: execution.id },
      ...(execution.completedAt ? [{ at: execution.completedAt, kind: "EXECUTION_COMPLETED" as const, ref: execution.id }] : []),
      ...execution.screeningFindings.map((f) => ({ at: f.createdAt, kind: "FINDING_RECORDED" as const, ref: f.id })),
      ...execution.overrides.map((o) => ({ at: o.overriddenAt, kind: "OVERRIDE_CREATED" as const, ref: o.id })),
      ...execution.overrides.filter((o) => o.revokedAt).map((o) => ({ at: o.revokedAt as Date, kind: "OVERRIDE_REVOKED" as const, ref: o.id })),
    ].sort((a, b) => a.at.getTime() - b.at.getTime());

    return NextResponse.json({ success: true, execution, timeline, requestId }, { status: 200 });
  },
  { permission: { any: ["audit.read", "compliance.read"] } }
);
