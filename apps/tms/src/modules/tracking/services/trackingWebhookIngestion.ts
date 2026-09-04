import {
  ingestTrackingWebhook as ingestPlatformTrackingWebhook,
  recordTrackingWebhookFailure,
  TrackingWebhookError,
  type TrackingWebhookIngestionDependencies,
  type TrackingWebhookIngestionInput,
} from "@qubere/tracking-platform";
import { evaluateTrackingExceptions } from "../exceptionDetector";

export * from "@qubere/tracking-platform";

/**
 * TMS is a thin consumer of the platform runtime. Its logistics exception
 * policy is deliberately injected so the shared layer remains product-neutral.
 */
export function ingestTrackingWebhook(
  input: TrackingWebhookIngestionInput,
  dependencies: TrackingWebhookIngestionDependencies = {}
) {
  return ingestPlatformTrackingWebhook(input, {
    ...dependencies,
    onSignalPersisted:
      dependencies.onSignalPersisted ??
      (async ({ accountId, shipmentId, etaDeltaMinutes }) => {
        if (typeof etaDeltaMinutes !== "number" || etaDeltaMinutes === 0) return null;
        return evaluateTrackingExceptions({ accountId, shipmentId, etaDeltaMinutes });
      }),
  });
}

export { recordTrackingWebhookFailure, TrackingWebhookError };
