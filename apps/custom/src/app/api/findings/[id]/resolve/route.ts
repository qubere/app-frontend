import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { validatePathParams } from "@/lib/api/validation";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";

const FINDING_STATUSES = ["Open", "Investigating", "Resolved", "AcceptedRisk", "Closed"];

const paramsSchema = z.object({ id: z.string().min(1) });

export const POST = withAuthenticatedRoute<{ id: string }>(async ({ req, ctx, requestId, params }) => {
  const paramsVal = validatePathParams(params, paramsSchema, requestId);
  if ("response" in paramsVal) return paramsVal.response;
  const { id } = paramsVal.data;

  const body = await req.json();
  const { status, notes, dueAt, remediationNotes, remediationRef } = body;

  if (typeof status !== "string" || !FINDING_STATUSES.includes(status)) {
    return NextResponse.json({ error: `status must be one of ${FINDING_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  if (status === "AcceptedRisk" && !notes && !remediationNotes) {
    return NextResponse.json({ error: "Reasonable-care justification notes are required when accepting risk." },
      { status: 400 }
    );
  }

  const finding = await db.complianceFinding.findFirst({
    where: { id, accountId: ctx.accountId },
  });

  if (!finding) {
    return NextResponse.json({ error: "Compliance finding not found" }, { status: 404 });
  }

  const newStatus = status;
  const finalNotes = notes ?? remediationNotes ?? finding.remediationNotes ?? null;

  const updatedFinding = await db.complianceFinding.update({
    where: { id },
    data: {
      status: newStatus,
      resolvedAt: newStatus === "Resolved" || newStatus === "AcceptedRisk" || newStatus === "Closed" ? new Date() : null,
      dueAt: dueAt !== undefined ? (dueAt ? new Date(dueAt) : null) : finding.dueAt,
      remediationNotes: finalNotes,
      remediationRef: remediationRef !== undefined ? remediationRef : finding.remediationRef,
    },
  });

  // Write event to immutable audit timeline
  await db.auditTimeline.create({
    data: {
      accountId: ctx.accountId,
      filingId: finding.filingId,
      event: `Compliance Finding ${finding.status} -> ${newStatus}: ${finding.rule}`,
      actor: `Compliance Analyst (${ctx.userId})`,
      metadata: { findingId: id, status: newStatus, notes: finalNotes, remediationRef: updatedFinding.remediationRef, dueAt: updatedFinding.dueAt },
    },
  });

  const auditSource = (req.headers?.get?.("x-qubere-source") === "CHAT" || (body as any)?.source === "CHAT") ? "CHAT" : "UI";

  await createAuditLog({
    accountId: ctx.accountId,
    userId: ctx.userId,
    action: "finding.resolve",
    entity: "ComplianceFinding",
    entityId: id,
    source: auditSource,
    metadata: { newStatus, notes: finalNotes, remediationRef: updatedFinding.remediationRef, dueAt: updatedFinding.dueAt },
  });

  return NextResponse.json({ finding: updatedFinding });

}, { permission: "exceptions.resolve", write: true });
