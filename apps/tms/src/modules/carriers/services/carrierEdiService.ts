export interface LoadTender204Request {
  shipmentId: string;
  carrierScac: string;
  carrierName: string;
  agreedRateUsd: number;
  pickupLocation: string;
  deliveryLocation: string;
  pickupWindowStartIso: string;
}

export interface SpotRateBenchmark {
  laneKey: string;
  origin: string;
  destination: string;
  equipmentType: string;
  averageRateUsd: number;
  lowRateUsd: number;
  highRateUsd: number;
  marketRateConfidence: number;
}

export async function sendEdi204LoadTender(req: LoadTender204Request) {
  return {
    success: false,
    tenderId: null,
    shipmentId: req.shipmentId,
    carrierScac: req.carrierScac,
    ediStandard: "X12 EDI 204 (Load Tender)",
    status: "NOT_CONFIGURED",
    message: "No EDI provider is configured; the load tender was not sent.",
  };
}

export async function fetchSpotRateBenchmark(
  origin: string,
  destination: string,
  equipmentType: string
): Promise<SpotRateBenchmark | null> {
  // A benchmark must come from a configured market-data provider. Returning
  // null is safer than presenting demo lane/rate values as live evidence.
  void origin;
  void destination;
  void equipmentType;
  return null;
}
