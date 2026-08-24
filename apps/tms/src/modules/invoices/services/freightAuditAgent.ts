import { db } from "@qubere/db";
import type { AccountContext } from "@qubere/auth";
import { createAuditLog } from "@qubere/decisions";
import { evaluateAutonomyPolicy } from "../../autonomy/services/policyEngineService";
import {
  performFreightAudit,
  getPendingAuditsForShipment,
} from "./freightAuditService";
import { publishTransportationEvent } from "../../events/services/eventService";
import { queueTmsMemoryEvent } from "../../../lib/inngest/functions/tmsMemoryExtraction";
import { TmsAccountContextBuilder } from "../../memory/memory.context-builder";
import { emitTmsBillingEvent } from "../../../lib/billingTelemetry";

// ---------------------------------------------------------------------------
// Freight Audit Agent
//
// OBSERVE:  Sweeps all PENDING carrier invoices (or processes a single one)
// UNDERSTAND: Calls performFreightAudit — 3-way match against ShipmentCost
// PREDICT:  Determines if variance is auto-approvable under tolerance
// DECIDE:   Evaluates autonomy policy — can agent approve payment?
// ACT:      Updates matchStatus, writes AgentDecision, creates AP remittance signal
// VERIFY:   Emits INVOICE_AUDITED event
// ESCALATE: Creates ExceptionItem for disputes; requires human review
// ---------------------------------------------------------------------------

export interface AuditAgentResult {
  carrierInvoiceId: string;
  shipmentId: string;
  auditStatus: string;
  agentDecisionId: string;
  autoApproved: boolean;
  varianceUsd: number;
  notes: string;
}

export interface SweepResult {
  evaluated: number;
  autoApproved: number;
  escalated: number;
  errors: number;
  results: AuditAgentResult[];
}

/**
 * Runs the Freight Audit Agent on a single carrier invoice.
 */
export async function runFreightAuditAgent(
  ctx: AccountContext,
  carrierInvoiceId: string
): Promise<AuditAgentResult> {
  // ---- OBSERVE + UNDERSTAND: 3-way match ----
  const auditResult = await performFreightAudit(ctx, carrierInvoiceId);
  const accountMemory = await TmsAccountContextBuilder.build({
    accountId: ctx.accountId,
    task: "FREIGHT_AUDIT",
    query: [carrierInvoiceId, auditResult.auditStatus].join(" "),
    scope: {
      shipmentId: auditResult.shipmentId,
      invoiceId: carrierInvoiceId,
    },
  });

  const isClean =
    (auditResult.auditStatus === "MATCHED" ||
      auditResult.auditStatus === "WITHIN_TOLERANCE") &&
    auditResult.hasSignedPod &&
    !auditResult.podHasException &&
    auditResult.currencyConsistent &&
    auditResult.invoiceTotalMatchesLines &&
    auditResult.uncontractedChargeTypes.length === 0;

  const evidenceChecks = [
    auditResult.agreedBuyRateUsd > 0,
    auditResult.hasSignedPod,
    !auditResult.podHasException,
    auditResult.currencyConsistent,
    auditResult.invoiceTotalMatchesLines,
    auditResult.uncontractedChargeTypes.length === 0,
  ];
  const confidence = Math.round(
    (evidenceChecks.filter(Boolean).length / evidenceChecks.length) * 100
  );

  // ---- DECIDE: Policy gate for auto-approval of AP payment ----
  const policyResult = await evaluateAutonomyPolicy(
    ctx,
    {
      actionType: "APPROVE_AP_PAYMENT",
      financialAmount: auditResult.carrierInvoicedUsd,
      currency: auditResult.currency,
      confidenceScore: confidence,
      requiredInputsPresent:
        auditResult.agreedBuyRateUsd > 0 && auditResult.hasSignedPod,
      dataFresh: true,
      reversible: false,
    },
    "Freight Audit Agent"
  );

  const autoApproved = isClean && policyResult.allowed;

  // Matching and payment approval are separate states. A clean audit may be
  // matched while still awaiting policy/human payment approval.
  const matchStatus = isClean
    ? "MATCHED"
    : auditResult.auditStatus === "VARIANCE_FLAGGED"
      ? "DISPUTED"
      : "EXCEPTION";
  await db.carrierInvoice.update({
    where: { id: carrierInvoiceId },
    data: { matchStatus },
  });

  // ---- ACT: Create AgentDecision ----
  const decision = await db.agentDecision.create({
    data: {
      accountId: ctx.accountId,
      shipmentId: auditResult.shipmentId,
      agentName: "Freight Audit Agent",
      decisionSummary:
        autoApproved
          ? `Invoice ${carrierInvoiceId} auto-approved for payment. ` +
            `${auditResult.notes} Variance: $${Math.abs(auditResult.varianceUsd).toFixed(2)}.`
          : `Invoice ${carrierInvoiceId} requires review. ` +
            `${auditResult.notes} Variance: $${Math.abs(auditResult.varianceUsd).toFixed(2)}.`,
      confidence,
      triageState: autoApproved ? "AUTO_VERIFIED" : "NEEDS_HUMAN_REVIEW",
      autoApproved,
      status: autoApproved ? "Completed" : "Review Required",
      blockedReason: autoApproved ? null : policyResult.reason,
      evidenceItems: [
        {
          field: "agreedBuyRate",
          extractedValue: `$${auditResult.agreedBuyRateUsd.toFixed(2)}`,
          sourceSpan: "ShipmentCost records",
          confidence: 95,
        },
        {
          field: "carrierInvoicedAmount",
          extractedValue: `$${auditResult.carrierInvoicedUsd.toFixed(2)}`,
          sourceSpan: `CarrierInvoice ${carrierInvoiceId}`,
          confidence: 95,
        },
        {
          field: "variance",
          extractedValue: `$${auditResult.varianceUsd.toFixed(2)} (${auditResult.variancePct.toFixed(1)}%)`,
          sourceSpan: "3-way match comparison",
          confidence: 95,
        },
        {
          field: "hasPod",
          extractedValue: String(auditResult.hasSignedPod),
          sourceSpan: "ProofOfDelivery",
          confidence: 90,
        },
        ...TmsAccountContextBuilder.summarizeForEvidence(accountMemory).map((memory) => ({
          field: "accountOperatingMemory",
          extractedValue: memory.content,
          sourceSpan: `AccountMemory ${memory.memoryId} (${memory.sourceType})`,
          confidence: Math.round(memory.confidence * 100),
        })),
      ] as any,
    },
  });

  // ---- ACT: Create dispute ExceptionItem if variance flagged ----
  if (!isClean) {
    const exceptionCode = `INVOICE_AUDIT:${carrierInvoiceId}`;
    const existingException = await db.exceptionItem.findFirst({
      where: {
        accountId: ctx.accountId,
        code: exceptionCode,
        status: { in: ["Open", "OPEN", "InProgress", "IN_PROGRESS"] },
      },
      select: { id: true },
    });
    if (!existingException) {
      await db.exceptionItem.create({
        data: {
          accountId: ctx.accountId,
          shipmentId: auditResult.shipmentId,
          type: "INVOICE_VARIANCE",
          code: exceptionCode,
          category: "BILLING",
          severity:
            Math.abs(auditResult.variancePct) > 10 ? "Critical" : "High",
          description:
            `Carrier invoice variance: invoiced $${auditResult.carrierInvoicedUsd.toFixed(2)} ` +
            `vs agreed $${auditResult.agreedBuyRateUsd.toFixed(2)}. ` +
            `Variance: $${auditResult.varianceUsd.toFixed(2)} (${auditResult.variancePct.toFixed(1)}%).`,
          requiredAction:
            "Review variance line by line. Contact carrier to dispute or approve the delta.",
          blocking: false,
          status: "Open",
          sourceAgent: "Freight Audit Agent",
        },
      });
    }
  }

  // ---- VERIFY: Emit INVOICE_AUDITED event ----
  await publishTransportationEvent(ctx, {
    entityType: "SHIPMENT",
    entityId: auditResult.shipmentId,
    shipmentId: auditResult.shipmentId,
    eventType: "INVOICE_AUDITED",
    source: "AGENT",
    payload: {
      carrierInvoiceId,
      auditStatus: auditResult.auditStatus,
      autoApproved,
      varianceUsd: auditResult.varianceUsd,
      variancePct: auditResult.variancePct,
      agentDecisionId: decision.id,
    },
  });

  await queueTmsMemoryEvent({
    kind: "INVOICE_AUDITED",
    accountId: ctx.accountId,
    carrierInvoiceId,
    decisionId: decision.id,
  }).catch((error) =>
    console.error("[TMS memory] Failed to enqueue invoice audit", error)
  );

  // ---- ACT: If auto-approved + has POD → update shipment financial lock ----
  if (autoApproved && auditResult.hasSignedPod) {
    await db.shipment.update({
      where: { id: auditResult.shipmentId },
      data: {
        // Write final actual buy cost from the verified invoice
        actualBuyCost: auditResult.carrierInvoicedUsd as any,
      },
    });

    await createAuditLog({
      accountId: ctx.accountId,
      action: "FINANCIALS_LOCKED",
      entity: "Shipment",
      entityId: auditResult.shipmentId,
      source: "AGENT",
      metadata: {
        triggeredBy: "Freight Audit Agent",
        carrierInvoiceId,
        auditStatus: auditResult.auditStatus,
        finalBuyCostUsd: auditResult.carrierInvoicedUsd,
      },
    });

    await emitTmsBillingEvent({
      accountId: ctx.accountId,
      shipmentId: auditResult.shipmentId,
      eventCode: "TMS_FREIGHT_AUDIT_APPROVED",
      idempotencyKey: `billing:tms:freight-audit:${carrierInvoiceId}`,
      sourceFunction: "runFreightAuditAgent",
      sourceAgent: "Freight Audit Agent",
      metadata: { carrierInvoiceId, auditStatus: auditResult.auditStatus, varianceUsd: auditResult.varianceUsd },
    }).catch((error) => console.error("[TMS billing] Freight-audit telemetry failed", error));
  }

  return {
    carrierInvoiceId,
    shipmentId: auditResult.shipmentId,
    auditStatus: auditResult.auditStatus,
    agentDecisionId: decision.id,
    autoApproved,
    varianceUsd: auditResult.varianceUsd,
    notes: auditResult.notes,
  };
}

/**
 * Sweeps all PENDING carrier invoices for an account.
 * Runs the Freight Audit Agent on each.
 * Designed to run on a schedule (daily) or triggered by INVOICE_RECEIVED event.
 */
export async function sweepPendingInvoices(
  ctx: AccountContext
): Promise<SweepResult> {
  // Load shipmentIds that have at least one ProofOfDelivery (audit prerequisite)
  const shipmentsWithPod = await db.proofOfDelivery
    .findMany({
      where: { accountId: ctx.accountId },
      select: { shipmentId: true },
      distinct: ["shipmentId"],
    })
    .catch(() => []);

  const shipmentIdsWithPod = shipmentsWithPod.map((p) => p.shipmentId);

  if (shipmentIdsWithPod.length === 0) {
    return { evaluated: 0, autoApproved: 0, escalated: 0, errors: 0, results: [] };
  }

  // Load all PENDING invoices for those shipments
  const pendingInvoices = await db.carrierInvoice.findMany({
    where: {
      accountId: ctx.accountId,
      matchStatus: "PENDING",
      shipmentId: { in: shipmentIdsWithPod },
    },
    select: { id: true, shipmentId: true, invoiceNumber: true },
    take: 100,
    orderBy: { createdAt: "asc" },
  });

  let autoApproved = 0;
  let escalated = 0;
  let errors = 0;
  const results: AuditAgentResult[] = [];

  for (const invoice of pendingInvoices) {
    try {
      const result = await runFreightAuditAgent(ctx, invoice.id);
      results.push(result);
      if (result.autoApproved) autoApproved++;
      else escalated++;
    } catch (err: any) {
      errors++;
      results.push({
        carrierInvoiceId: invoice.id,
        shipmentId: invoice.shipmentId,
        auditStatus: "ERROR",
        agentDecisionId: "",
        autoApproved: false,
        varianceUsd: 0,
        notes: err.message || "Audit agent error",
      });
    }
  }

  return {
    evaluated: pendingInvoices.length,
    autoApproved,
    escalated,
    errors,
    results,
  };
}

/**
 * Run freight audit for all pending invoices on a specific shipment.
 * Called after POD is ingested to immediately trigger financial close.
 */
export async function auditShipmentInvoices(
  ctx: AccountContext,
  shipmentId: string
): Promise<AuditAgentResult[]> {
  const pendingIds = await getPendingAuditsForShipment(ctx, shipmentId);
  const results: AuditAgentResult[] = [];

  for (const invoiceId of pendingIds) {
    const result = await runFreightAuditAgent(ctx, invoiceId).catch((err) => ({
      carrierInvoiceId: invoiceId,
      shipmentId,
      auditStatus: "ERROR",
      agentDecisionId: "",
      autoApproved: false,
      varianceUsd: 0,
      notes: err.message,
    }));
    results.push(result);
  }

  return results;
}
