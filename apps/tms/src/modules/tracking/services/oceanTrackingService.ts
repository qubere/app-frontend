export interface AisVesselPosition {
  vesselName: string;
  mmsi: string;
  imoNumber: string;
  latitude: number;
  longitude: number;
  headingDegrees: number;
  speedKnots: number;
  lastReportedIso: string;
  destinationPortCode: string;
  destinationPortName: string;
  etaIso: string;
  confidenceScore: number;
}

export interface OceanTrackingStatus {
  shipmentId: string;
  vesselName: string;
  voyageNumber: string;
  currentPosition: AisVesselPosition;
  currentMilestone: string;
  nextPortOfDischarge: string;
  plannedEtaIso: string;
  recalculatedEtaIso: string;
  scheduleDelayHours: number;
  sourceProvider: string;
}

export async function fetchLiveOceanTracking(
  shipmentId: string,
  vesselName: string,
  voyageNumber: string
): Promise<OceanTrackingStatus | null> {
  // No AIS provider client is configured in this service yet. Returning null
  // prevents demo coordinates and ETA values from entering operational state.
  void shipmentId;
  void vesselName;
  void voyageNumber;
  return null;
}
