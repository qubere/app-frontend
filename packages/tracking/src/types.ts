export type TrackingCapability =
  | "PUSH_EVENTS"
  | "POLLING"
  | "SUBSCRIPTIONS"
  | "ETA"
  | "POSITION"
  | "TERMINAL_AVAILABILITY"
  | "HOLDS"
  | "LAST_FREE_DAY"
  | "RAIL"
  | "POD";

export type TrackingClassifier = "PLANNED" | "ESTIMATED" | "ACTUAL";

export type TrackingSource =
  | "PROVIDER"
  | "CARRIER"
  | "TERMINAL"
  | "PORT"
  | "AIS"
  | "USER"
  | "SYSTEM"
  | "CBP"
  | "DOCUMENT";

export type TrackingMatchType = "EXACT" | "PREFIX" | "CONTAINS" | "FALLBACK";

export interface ProviderRuntimeConfig {
  providerKey: string;
  connectionId: string;
  connectionKey: string;
  environment: string;
  baseUrl?: string | null;
  config: Record<string, unknown>;
}

export interface ProviderWebhookRequest {
  rawBody: string;
  headers: Readonly<Record<string, string | null | undefined>>;
}

export interface ProviderSignal {
  providerEventId: string;
  idempotencyKey: string;
  shipmentId?: string;
  movementId?: string;
  legId?: string;
  equipmentId?: string;
  rawEventCode: string;
  eventDescription?: string;
  occurredAt: Date;
  sourceUpdatedAt?: Date;
  estimatedArrival?: Date;
  carrierReference?: string;
  location?: {
    name?: string;
    city?: string;
    country?: string;
    unlocode?: string;
    timezone?: string;
    coordinates?: [number, number];
  };
  raw: Record<string, unknown>;
}

export interface ProviderSubscriptionRequest {
  shipmentId: string;
  references: Array<{ type: string; value: string; issuer?: string }>;
  mode?: string | null;
}

export interface ProviderSubscriptionResult {
  providerTrackingId: string;
  status: "PENDING" | "ACTIVE";
}

export interface ProviderHealthResult {
  ok: boolean;
  code: string;
  detail?: string;
}

export interface TrackingProviderAdapter {
  readonly adapterKey: string;
  readonly capabilities: readonly TrackingCapability[];

  validateConfig(config: ProviderRuntimeConfig): string[];
  verifyWebhook(
    request: ProviderWebhookRequest,
    config: ProviderRuntimeConfig,
    secret: string
  ): Promise<boolean> | boolean;
  parseWebhook(
    request: ProviderWebhookRequest,
    config: ProviderRuntimeConfig
  ): Promise<ProviderSignal[]> | ProviderSignal[];
  healthCheck?(
    config: ProviderRuntimeConfig,
    credential: string
  ): Promise<ProviderHealthResult>;
  subscribe?(
    request: ProviderSubscriptionRequest,
    config: ProviderRuntimeConfig,
    credential: string
  ): Promise<ProviderSubscriptionResult>;
  unsubscribe?(
    providerTrackingId: string,
    config: ProviderRuntimeConfig,
    credential: string
  ): Promise<void>;
  poll?(
    request: ProviderSubscriptionRequest,
    config: ProviderRuntimeConfig,
    credential: string
  ): Promise<ProviderSignal[]>;
}

export interface TrackingEventMappingRule {
  id: string;
  integrationConfigId?: string | null;
  matchType: TrackingMatchType;
  rawEventPattern: string;
  canonicalEventType: string;
  classifier: TrackingClassifier;
  sourceType: TrackingSource;
  priority: number;
  active: boolean;
}

export interface MappedTrackingEvent {
  mappingId: string;
  canonicalEventType: string;
  classifier: TrackingClassifier;
  sourceType: TrackingSource;
}
