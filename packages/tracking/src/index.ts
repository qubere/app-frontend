export * from "./types";
export * from "./registry";
export * from "./mapping";
export * from "./adapters/genericWebhook";

import { GenericWebhookTrackingAdapter } from "./adapters/genericWebhook";
import { TrackingProviderRegistry } from "./registry";

export function createDefaultTrackingProviderRegistry(): TrackingProviderRegistry {
  return new TrackingProviderRegistry().register(new GenericWebhookTrackingAdapter());
}
