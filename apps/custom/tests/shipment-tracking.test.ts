import { describe, expect, it } from "vitest";
import {
  buildTrackingProjection,
  customsTrackingStatus,
  type BuildTrackingProjectionInput,
  type TrackingEventRecord,
  type TrackingConnectionRecord,
} from "@/modules/tracking/shipmentTracking";

const NOW = new Date("2026-08-20T18:00:00.000Z");

function event(overrides: Partial<TrackingEventRecord> = {}): TrackingEventRecord {
  return {
    id: "evt_1",
    eventType: "VESSEL_DEPARTURE",
    classifier: "ACTUAL",
    occurredAt: new Date("2026-08-20T12:00:00.000Z"),
    receivedAt: new Date("2026-08-20T12:05:00.000Z"),
    sourceUpdatedAt: null,
    locationName: "Shanghai",
    unlocode: "CNSHA",
    timezone: "Asia/Shanghai",
    provider: "TEST_PROVIDER",
    sourceType: "CARRIER",
    confidence: 0.99,
    isInferred: false,
    isCorrection: false,
    ...overrides,
  };
}

function input(overrides: Partial<BuildTrackingProjectionInput> = {}): BuildTrackingProjectionInput {
  return {
    shipment: {
      id: "shp_1",
      shipmentNumber: "SHP-2026-000001",
      transportMode: "Ocean",
      estimatedArrival: null,
      readinessScore: 72,
    },
    identifiers: [],
    legs: [],
    events: [],
    etaObservations: [],
    subscriptions: [],
    connections: [],
    deadlines: [],
    openExceptions: [],
    latestFiling: null,
    now: NOW,
    ...overrides,
  };
}

function connection(overrides: Partial<TrackingConnectionRecord> = {}): TrackingConnectionRecord {
  return {
    id: "connection-1",
    name: "Broker carrier feed",
    provider: "TEST_PROVIDER",
    status: "ACTIVE",
    clientId: null,
    priority: 100,
    isDefault: true,
    lastSyncAt: new Date("2026-08-20T12:05:00.000Z"),
    lastEventAt: new Date("2026-08-20T12:00:00.000Z"),
    lastErrorAt: null,
    lastErrorMessage: null,
    providerDefinition: { displayName: "Test visibility", capabilities: ["PUSH_EVENTS", "ETA"] },
    ...overrides,
  };
}

describe("shipment tracking projection", () => {
  it("reports an honest not-tracked state when no source is configured", () => {
    const projection = buildTrackingProjection(input());

    expect(projection.health.status).toBe("NOT_TRACKED");
    expect(projection.health.reasonCodes).toContain("TRACKING_NOT_CONFIGURED");
    expect(projection.movement.currentLocation).toBeNull();
    expect(projection.source.state).toBe("NOT_CONFIGURED");
    expect(projection.nextAction?.type).toBe("CONFIGURE_TRACKING");
  });

  it("derives physical movement from actual events without inventing customs release", () => {
    const projection = buildTrackingProjection(
      input({
        identifiers: [{ type: "MBL", value: "MAEU123", issuer: "MAEU", isPrimary: true }],
        connections: [connection()],
        events: [event()],
        latestFiling: { id: "fil_1", filingStatus: "Preparing" },
      })
    );

    expect(projection.movement.status).toBe("IN_TRANSIT");
    expect(projection.movement.currentLocation).toBe("Shanghai");
    expect(projection.customs.status).toBe("PREPARING");
    expect(projection.customs.status).not.toBe("RELEASED");
  });

  it("retains ETA history and warns when arrival moves materially earlier", () => {
    const projection = buildTrackingProjection(
      input({
        identifiers: [{ type: "CONTAINER", value: "MSCU1234567", issuer: "MSCU", isPrimary: true }],
        connections: [connection()],
        events: [event()],
        etaObservations: [
          {
            estimatedAt: new Date("2026-08-20T12:30:00.000Z"),
            eta: new Date("2026-08-22T06:00:00.000Z"),
            previousEta: new Date("2026-08-23T00:00:00.000Z"),
            deltaMinutes: null,
            provider: "TEST_PROVIDER",
            confidence: 0.9,
            reasonCode: "SCHEDULE_UPDATE",
          },
        ],
      })
    );

    expect(projection.movement.etaDeltaMinutes).toBe(-1080);
    expect(projection.health.reasonCodes).toContain("ETA_MOVED_EARLIER");
    expect(projection.health.status).toBe("ATTENTION");
  });

  it("makes customs blockers critical even when the carrier feed is healthy", () => {
    const projection = buildTrackingProjection(
      input({
        identifiers: [{ type: "MBL", value: "MAEU123", issuer: "MAEU", isPrimary: true }],
        connections: [connection()],
        events: [event()],
        openExceptions: [{ blocking: true, severity: "Critical" }],
        deadlines: [
          {
            id: "deadline_1",
            type: "ENTRY_FILING",
            deadlineClass: "REGULATORY",
            status: "OPEN",
            dueAt: new Date("2026-08-21T18:00:00.000Z"),
            estimated: true,
          },
        ],
      })
    );

    expect(projection.health.status).toBe("CRITICAL");
    expect(projection.nextAction?.type).toBe("RESOLVE_EXCEPTION");
    expect(projection.nextAction?.dueAt?.toISOString()).toBe("2026-08-21T18:00:00.000Z");
  });

  it("prioritizes a customs blocker over missing tracking configuration", () => {
    const projection = buildTrackingProjection(
      input({ openExceptions: [{ blocking: true, severity: "Critical" }] })
    );

    expect(projection.health.status).toBe("CRITICAL");
    expect(projection.health.reasonCodes).toEqual(
      expect.arrayContaining(["TRACKING_NOT_CONFIGURED", "CUSTOMS_BLOCKER_OPEN"])
    );
    expect(projection.nextAction?.type).toBe("RESOLVE_EXCEPTION");
  });

  it("distinguishes a stale feed from a shipment that has not moved", () => {
    const projection = buildTrackingProjection(
      input({
        identifiers: [{ type: "MBL", value: "MAEU123", issuer: "MAEU", isPrimary: true }],
        connections: [
          connection({
            lastSyncAt: new Date("2026-08-15T12:05:00.000Z"),
            lastEventAt: new Date("2026-08-15T12:00:00.000Z"),
          }),
        ],
        events: [
          event({
            occurredAt: new Date("2026-08-15T12:00:00.000Z"),
            receivedAt: new Date("2026-08-15T12:05:00.000Z"),
          }),
        ],
      })
    );

    expect(projection.health.status).toBe("STALE");
    expect(projection.source.state).toBe("STALE");
    expect(projection.health.isDataStale).toBe(true);
    expect(projection.nextAction?.type).toBe("CHECK_TRACKING_SOURCE");
  });

  it("shows an active connection waiting for its first provider update without claiming the feed is stale", () => {
    const projection = buildTrackingProjection(
      input({
        identifiers: [{ type: "MBL", value: "MAEU123", issuer: "MAEU", isPrimary: true }],
        connections: [connection({ lastSyncAt: null, lastEventAt: null })],
        events: [event({ provider: "RETIRED_PROVIDER" })],
      })
    );

    expect(projection.source.state).toBe("WAITING");
    expect(projection.health.status).toBe("ON_TRACK");
    expect(projection.health.isDataStale).toBe(false);
    expect(projection.movement.status).toBe("IN_TRANSIT");
  });
});

describe("customs status normalization", () => {
  it("maps filing lifecycle states without treating acceptance as release", () => {
    expect(customsTrackingStatus("Transmitted")).toBe("FILED");
    expect(customsTrackingStatus("Accepted")).toBe("ACCEPTED");
    expect(customsTrackingStatus("CustomsHold")).toBe("HOLD");
    expect(customsTrackingStatus("Released")).toBe("RELEASED");
  });
});
