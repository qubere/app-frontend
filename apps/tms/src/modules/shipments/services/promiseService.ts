import { db } from "@qubere/db";
import type { AccountContext } from "@qubere/auth";

export type PromiseState = "ON_PROMISE" | "AT_RISK" | "MISSED";

export interface PromiseEvaluation {
  promiseState: PromiseState;
  customerPromiseDate: Date | null;
  currentEta: Date | null;
  bufferHours: number | null;
  /** Human-readable explanation for the Operations queue */
  explanation: string;
}

/**
 * Default buffer thresholds. These can be overridden by account-level config
 * in the future. AT_RISK when buffer < 4h, MISSED when ETA > promise.
 */
const AT_RISK_BUFFER_HOURS = 4;

/**
 * Evaluates whether the shipment is on, at risk of, or has missed its customer
 * promise date based on the latest ETA observation.
 *
 * Does NOT write to DB — call `persistPromiseState()` to flush the result.
 */
export async function evaluatePromiseState(
  ctx: AccountContext,
  shipmentId: string
): Promise<PromiseEvaluation> {
  const [shipment, latestEta] = await Promise.all([
    db.shipment.findFirst({
      where: { id: shipmentId, accountId: ctx.accountId },
      select: {
        customerPromiseDate: true,
        estimatedArrival: true,
      },
    }),
    db.etaObservation.findFirst({
      where: { shipmentId },
      orderBy: { estimatedAt: "desc" },
      select: { eta: true, confidence: true },
    }),
  ]);

  if (!shipment) {
    return {
      promiseState: "ON_PROMISE",
      customerPromiseDate: null,
      currentEta: null,
      bufferHours: null,
      explanation: "Shipment not found.",
    };
  }

  const promiseDate = shipment.customerPromiseDate;
  // Use the most recent EtaObservation, fall back to shipment.estimatedArrival
  const currentEta = latestEta?.eta ?? shipment.estimatedArrival ?? null;

  if (!promiseDate) {
    return {
      promiseState: "ON_PROMISE",
      customerPromiseDate: null,
      currentEta,
      bufferHours: null,
      explanation: "No customer promise date set — state cannot be evaluated.",
    };
  }

  if (!currentEta) {
    return {
      promiseState: "ON_PROMISE",
      customerPromiseDate: promiseDate,
      currentEta: null,
      bufferHours: null,
      explanation: "No ETA available yet — promise state will be evaluated once tracking begins.",
    };
  }

  const bufferMs = promiseDate.getTime() - currentEta.getTime();
  const bufferHours = bufferMs / (1000 * 60 * 60);

  let promiseState: PromiseState;
  let explanation: string;

  if (bufferHours < 0) {
    promiseState = "MISSED";
    const overBy = Math.abs(bufferHours).toFixed(1);
    explanation = `Current ETA is ${overBy}h past customer promise date (${promiseDate.toLocaleDateString()}).`;
  } else if (bufferHours < AT_RISK_BUFFER_HOURS) {
    promiseState = "AT_RISK";
    explanation = `Only ${bufferHours.toFixed(1)}h buffer remaining before customer promise date — below ${AT_RISK_BUFFER_HOURS}h threshold.`;
  } else {
    promiseState = "ON_PROMISE";
    explanation = `${bufferHours.toFixed(1)}h ahead of customer promise date.`;
  }

  return {
    promiseState,
    customerPromiseDate: promiseDate,
    currentEta,
    bufferHours,
    explanation,
  };
}

/**
 * Evaluates and writes the promise state back to Shipment.promiseState.
 * Call this after any ETA change.
 */
export async function persistPromiseState(
  ctx: AccountContext,
  shipmentId: string
): Promise<PromiseEvaluation> {
  const evaluation = await evaluatePromiseState(ctx, shipmentId);

  await db.shipment.update({
    where: { id: shipmentId },
    data: { promiseState: evaluation.promiseState },
  });

  return evaluation;
}

/**
 * Batch-evaluates all active shipments that have a customerPromiseDate set.
 * Used by the Risk Agent sweep to find AT_RISK or MISSED shipments.
 */
export async function getShipmentsAtPromiseRisk(
  ctx: AccountContext
): Promise<
  Array<{
    shipmentId: string;
    shipmentNumber: string;
    promiseState: PromiseState;
    bufferHours: number | null;
    customerPromiseDate: Date;
    currentEta: Date | null;
  }>
> {
  const shipments = await db.shipment.findMany({
    where: {
      accountId: ctx.accountId,
      customerPromiseDate: { not: null },
      status: { notIn: ["Completed", "Cancelled", "DELIVERED"] },
      deletedAt: null,
    },
    select: {
      id: true,
      shipmentNumber: true,
      customerPromiseDate: true,
      estimatedArrival: true,
      etaObservations: {
        orderBy: { estimatedAt: "desc" },
        take: 1,
        select: { eta: true },
      },
    },
    take: 500,
  });

  const results = [];

  for (const shipment of shipments) {
    const promiseDate = shipment.customerPromiseDate!;
    const currentEta =
      shipment.etaObservations[0]?.eta ?? shipment.estimatedArrival ?? null;

    if (!currentEta) {
      continue;
    }

    const bufferHours =
      (promiseDate.getTime() - currentEta.getTime()) / (1000 * 60 * 60);

    let promiseState: PromiseState;
    if (bufferHours < 0) promiseState = "MISSED";
    else if (bufferHours < AT_RISK_BUFFER_HOURS) promiseState = "AT_RISK";
    else promiseState = "ON_PROMISE";

    if (promiseState !== "ON_PROMISE") {
      results.push({
        shipmentId: shipment.id,
        shipmentNumber: shipment.shipmentNumber,
        promiseState,
        bufferHours,
        customerPromiseDate: promiseDate,
        currentEta,
      });
    }
  }

  return results;
}
