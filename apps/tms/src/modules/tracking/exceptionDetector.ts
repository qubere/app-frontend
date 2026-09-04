import { db } from "@qubere/db";
import { createAuditLog } from "@qubere/decisions";

export interface EvaluateExceptionInput {
  accountId: string;
  shipmentId: string;
  etaDeltaMinutes: number;
  missedPickupWindow?: boolean;
}

export async function evaluateTrackingExceptions(input: EvaluateExceptionInput) {
  const ETA_DELAY_THRESHOLD_MINUTES = 120; // 2 hours

  if (Math.abs(input.etaDeltaMinutes) > ETA_DELAY_THRESHOLD_MINUTES || input.missedPickupWindow) {
    const severity = Math.abs(input.etaDeltaMinutes) > 360 ? "High" : "Medium";
    const description = input.missedPickupWindow
      ? "Missed Pickup Window Exception"
      : `Significant ETA Delay Detected (${input.etaDeltaMinutes} min)`;

    const exception = await db.exceptionItem.create({
      data: {
        accountId: input.accountId,
        shipmentId: input.shipmentId,
        category: "LOGISTICS",
        type: input.missedPickupWindow ? "MISSED_PICKUP" : "ETA_DELAY",
        severity,
        description,
        status: "Open",
      },
    });

    await createAuditLog({
      accountId: input.accountId,
      action: "LOGISTICS_EXCEPTION_DETECTED",
      entity: "ExceptionItem",
      entityId: exception.id,
      source: "SYSTEM",
      metadata: {
        shipmentId: input.shipmentId,
        severity,
        etaDeltaMinutes: input.etaDeltaMinutes,
      },
    });

    return exception;
  }

  return null;
}
