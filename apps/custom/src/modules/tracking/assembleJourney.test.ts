import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { assembleJourney } from "./shipmentTracking";

function leg(over: Record<string, unknown> = {}) {
  return {
    id: "leg",
    sequence: 1,
    legType: "MAIN_CARRIAGE",
    mode: "OCEAN",
    status: "PLANNED",
    statusReason: null,
    source: "MANUAL",
    confidence: null,
    confirmedAt: new Date(),
    carrierName: "COSCO",
    carrierScac: "COSU",
    vesselName: null,
    voyageNumber: null,
    flightNumber: null,
    imoNumber: null,
    billOfLadingNumber: null,
    billOfLadingType: null,
    bookingNumber: null,
    originStopId: "s_a",
    destinationStopId: "s_b",
    originStop: { id: "s_a", sequence: 1, role: "PORT_OF_LADING", name: "Yantian", unlocode: "CNYTN", timezone: "Asia/Shanghai" },
    destinationStop: { id: "s_b", sequence: 2, role: "PORT_OF_DISCHARGE", name: "Long Beach", unlocode: "USLAX", timezone: "America/Los_Angeles" },
    plannedDeparture: null,
    estimatedDeparture: null,
    actualDeparture: null,
    plannedArrival: null,
    estimatedArrival: null,
    actualArrival: null,
    legDocuments: [],
    events: [],
    etaObservations: [],
    ...over,
  };
}

const shipment = (over: Record<string, unknown> = {}) => ({
  id: "shp_1",
  shipmentNumber: "SHP-1",
  legs: [],
  legInferenceRuns: [],
  exceptionItems: [],
  ...over,
});

describe("assembleJourney", () => {
  it("orders stops along the journey: first leg's origin, then each leg's destination", () => {
    const l1 = leg({ id: "l1", sequence: 1, status: "COMPLETED",
      originStop: { id: "s1", sequence: 1, role: "ORIGIN", name: "Factory", unlocode: null, timezone: null },
      destinationStop: { id: "s2", sequence: 2, role: "PORT_OF_LADING", name: "Yantian", unlocode: "CNYTN", timezone: null } });
    const l2 = leg({ id: "l2", sequence: 2, originStopId: "s2", destinationStopId: "s3",
      originStop: { id: "s2", sequence: 2, role: "PORT_OF_LADING", name: "Yantian", unlocode: "CNYTN", timezone: null },
      destinationStop: { id: "s3", sequence: 3, role: "PORT_OF_DISCHARGE", name: "Long Beach", unlocode: "USLAX", timezone: null } });
    const j = assembleJourney(shipment({ legs: [l1, l2] }), "NOT_STARTED");
    expect(j.stops.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
  });

  it("counts REQUIRED and CONDITIONAL gaps as missing, ignores OPTIONAL / INFO_ONLY / filled", () => {
    const l = leg({
      legDocuments: [
        { id: "d1", slotKey: "MBL", slotLabel: "MBL", expectedDocType: "BILL_OF_LADING", requirement: "REQUIRED", requirementReason: null, documentId: "doc1", document: { id: "doc1", fileName: "mbl.pdf", fileUrl: "/mbl", confidence: 90, status: "Processed" } },
        { id: "d2", slotKey: "ARRIVAL_NOTICE", slotLabel: "Arrival Notice", expectedDocType: "OTHER", requirement: "REQUIRED", requirementReason: null, documentId: null, document: null },
        { id: "d3", slotKey: "COO", slotLabel: "Cert of Origin", expectedDocType: "CERTIFICATE_OF_ORIGIN", requirement: "CONDITIONAL", requirementReason: null, documentId: null, document: null },
        { id: "d4", slotKey: "POD", slotLabel: "POD", expectedDocType: "PROOF_OF_DELIVERY", requirement: "OPTIONAL", requirementReason: null, documentId: null, document: null },
        { id: "d5", slotKey: "SHARED_MBL", slotLabel: "MBL (shared)", expectedDocType: "BILL_OF_LADING", requirement: "INFO_ONLY", requirementReason: null, documentId: null, document: null },
      ],
    });
    const j = assembleJourney(shipment({ legs: [l] }), "NOT_STARTED");
    const d = j.legs[0].documents;
    expect(d.total).toBe(5);
    expect(d.onFile).toBe(1);
    expect(d.missingRequired).toBe(2); // ARRIVAL_NOTICE + COO
    expect(d.rows.find((r) => r.slotKey === "MBL")!.status).toBe("PROCESSED");
  });

  it("surfaces per-leg ETA drift from the latest EtaObservation", () => {
    const l = leg({
      status: "IN_TRANSIT",
      estimatedArrival: new Date("2026-08-30T00:00:00Z"),
      etaObservations: [
        { eta: new Date("2026-08-31T00:00:00Z"), deltaMinutes: 1440, provider: "Qubere ETA model", estimatedAt: new Date() },
      ],
    });
    const j = assembleJourney(shipment({ legs: [l] }), "FILED");
    expect(j.legs[0].eta.current).toEqual(new Date("2026-08-31T00:00:00Z"));
    expect(j.legs[0].eta.deltaMinutes).toBe(1440);
    expect(j.legs[0].eta.provider).toBe("Qubere ETA model");
  });

  it("marks the journey blocked when a blocking exception exists, and keeps customs independent", () => {
    const j = assembleJourney(
      shipment({
        legs: [leg({ status: "IN_TRANSIT" })],
        exceptionItems: [{ blocking: true, severity: "High" }],
      }),
      "FILED"
    );
    expect(j.journeyStatus.blocked).toBe(true);
    expect(j.journeyStatus.blockingReasons.length).toBeGreaterThan(0);
    expect(j.customs.status).toBe("FILED"); // arrival/transit never implies release
  });

  it("flags a leg as needing confirmation only when inferred and unconfirmed", () => {
    const inferred = leg({ source: "INFERRED", confirmedAt: null });
    const confirmed = leg({ id: "c", sequence: 2, source: "INFERRED", confirmedAt: new Date(), originStopId: "s_b", destinationStopId: "s_c",
      originStop: { id: "s_b", sequence: 2, role: null, name: "Long Beach", unlocode: "USLAX", timezone: null },
      destinationStop: { id: "s_c", sequence: 3, role: "DESTINATION", name: "DC", unlocode: null, timezone: null } });
    const j = assembleJourney(shipment({ legs: [inferred, confirmed] }), "NOT_STARTED");
    expect(j.legs[0].inference!.needsConfirmation).toBe(true);
    expect(j.legs[1].inference!.needsConfirmation).toBe(false);
  });

  it("maps a pending LegInferenceRun into inferenceProposal", () => {
    const j = assembleJourney(
      shipment({
        legs: [leg()],
        legInferenceRuns: [
          {
            inputsHash: "abc123def456",
            overallConfidence: 0.82,
            createdAt: new Date("2026-08-29T12:00:00Z"),
            proposal: { changes: [{ type: "ADD", description: "Add leg 4: import haulage", legSequence: 4 }] },
          },
        ],
      }),
      "NOT_STARTED"
    );
    expect(j.inferenceProposal).not.toBeNull();
    expect(j.inferenceProposal!.inputsHash).toBe("abc123def456");
    expect(j.inferenceProposal!.changes).toHaveLength(1);
  });

  it("returns an empty journey (headline 'No journey scheduled') when there are no legs", () => {
    const j = assembleJourney(shipment(), "NOT_STARTED");
    expect(j.legs).toHaveLength(0);
    expect(j.journeyStatus.headline).toBe("No journey scheduled");
    expect(j.journeyStatus.percentComplete).toBe(0);
  });
});
