import {
  ingestTrackingWebhook as ingestPlatformTrackingWebhook,
  recordTrackingWebhookFailure,
  TrackingWebhookError,
  type TrackingWebhookIngestionDependencies,
  type TrackingWebhookIngestionInput,
} from "@qubere/tracking-platform";
import { recomputeShipmentDeadlines } from "../deadlines/deadline.service";

export * from "@qubere/tracking-platform";

/**
 * Customs consumes the platform feed first. ETA and arrival changes are handed
 * to the existing deadline engine; customs release/hold state is never inferred
 * from a carrier event and remains owned by ABI/ACE response processing.
 */
export function ingestTrackingWebhook(
  input: TrackingWebhookIngestionInput,
  dependencies: TrackingWebhookIngestionDependencies = {}
) {
  return ingestPlatformTrackingWebhook(input, {
    ...dependencies,
    onSignalPersisted:
      dependencies.onSignalPersisted ??
      (async ({ accountId, shipmentId, canonicalEventType, etaDeltaMinutes }) => {
        const changedArrivalAnchor = ["PORT_ARRIVED", "CONTAINER_DISCHARGED"].includes(canonicalEventType);
        if (etaDeltaMinutes === null && !changedArrivalAnchor) return null;
        return recomputeShipmentDeadlines(shipmentId, accountId);
      }),
  });
}

export { recordTrackingWebhookFailure, TrackingWebhookError };
