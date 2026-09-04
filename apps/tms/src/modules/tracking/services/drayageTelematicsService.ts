export interface EldDriverTelemetry {
  driverName: string;
  driverPhone: string;
  truckNumber: string;
  chassisNumber: string;
  latitude: number;
  longitude: number;
  lastCheckCallIso: string;
  gateOutIso?: string;
  estimatedArrivalIso: string;
  speedMph: number;
  batteryStatusPct: number;
}

export interface DrayageTelematicsStatus {
  shipmentId: string;
  carrierName: string;
  telematicsProvider: string;
  driver: EldDriverTelemetry;
  status: "DISPATCHED" | "EN_ROUTE" | "GATE_OUT" | "DELIVERED";
  deliveryAppointmentIso: string;
}

export async function fetchDrayageTelematics(
  shipmentId: string,
  carrierName: string
): Promise<DrayageTelematicsStatus | null> {
  // No ELD provider client is configured in this service yet. Returning null
  // prevents synthetic driver PII, coordinates, and appointment times from
  // being presented as live carrier telemetry.
  void shipmentId;
  void carrierName;
  return null;
}
