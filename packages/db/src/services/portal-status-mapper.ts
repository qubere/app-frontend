export type CustomerTransportationStatus =
  | "Preparing shipment"
  | "At origin"
  | "In transit"
  | "At destination"
  | "Available for pickup"
  | "Out for delivery"
  | "Delivered"
  | "Delayed"
  | "Cancelled"
  | "Tracking unavailable";

export type CustomerCustomsStatus =
  | "Not started"
  | "Documents needed"
  | "Broker preparing entry"
  | "Ready for broker review"
  | "Filed with customs"
  | "Customs reviewing"
  | "On hold"
  | "Released"
  | "Completed"
  | "Cancelled";

export type CustomerFreightStatus =
  | "Dispatched"
  | "In Transit"
  | "Arrived at Stop"
  | "Delivered"
  | "POD Received"
  | "On Hold";

export interface MappedPortalStatus {
  transportationStatus: CustomerTransportationStatus;
  customsStatus: CustomerCustomsStatus;
  freightStatus?: CustomerFreightStatus;
  hasCustomerActionRequired: boolean;
  actionRequiredCount: number;
}

/**
 * Maps raw internal shipment state, tracking projections, filing status, and open customer requests
 * into customer-understandable, domain-isolated transportation and customs statuses.
 * Strips internal reason codes, raw provider messages, and internal exception details.
 */
export function mapPortalShipmentStatus(params: {
  internalStatus?: string | null;
  filingStatus?: string | null;
  trackingStatus?: string | null;
  openCustomerRequestCount?: number;
}): MappedPortalStatus {
  const {
    internalStatus = "",
    filingStatus = "",
    trackingStatus = "",
    openCustomerRequestCount = 0,
  } = params;

  // 1. Determine Transportation Status
  let transportationStatus: CustomerTransportationStatus = "In transit";
  const normTracking = (trackingStatus || internalStatus || "").toUpperCase();

  if (normTracking.includes("DELIVERED") || normTracking === "COMPLETED") {
    transportationStatus = "Delivered";
  } else if (normTracking.includes("OUT_FOR_DELIVERY") || normTracking.includes("OUT FOR DELIVERY")) {
    transportationStatus = "Out for delivery";
  } else if (normTracking.includes("PICKUP") || normTracking.includes("PORT_ARRIVED")) {
    transportationStatus = "Available for pickup";
  } else if (normTracking.includes("DESTINATION") || normTracking.includes("ARRIVED")) {
    transportationStatus = "At destination";
  } else if (normTracking.includes("ORIGIN") || normTracking.includes("DEPARTED_ORIGIN")) {
    transportationStatus = "At origin";
  } else if (normTracking.includes("DELAY") || normTracking.includes("EXCEPTION")) {
    transportationStatus = "Delayed";
  } else if (normTracking.includes("CANCEL")) {
    transportationStatus = "Cancelled";
  } else if (normTracking.includes("DRAFT") || normTracking.includes("PREPARING")) {
    transportationStatus = "Preparing shipment";
  }

  // 2. Determine Customs Status
  let customsStatus: CustomerCustomsStatus = "Broker preparing entry";
  const normFiling = (filingStatus || "").toUpperCase();

  if (openCustomerRequestCount > 0) {
    customsStatus = "Documents needed";
  } else if (normFiling.includes("RELEASED") || normFiling.includes("ACCEPTED")) {
    customsStatus = "Released";
  } else if (normFiling.includes("TRANSMITTED") || normFiling.includes("SUBMITTED")) {
    customsStatus = "Filed with customs";
  } else if (normFiling.includes("CUSTOMSHOLD") || normFiling.includes("HOLD")) {
    customsStatus = "On hold";
  } else if (normFiling.includes("READYFORBROKERREVIEW") || normFiling.includes("REVIEW")) {
    customsStatus = "Ready for broker review";
  } else if (normFiling.includes("CANCEL")) {
    customsStatus = "Cancelled";
  } else if (!filingStatus || normFiling === "DRAFT") {
    customsStatus = "Not started";
  }

  return {
    transportationStatus,
    customsStatus,
    hasCustomerActionRequired: openCustomerRequestCount > 0,
    actionRequiredCount: openCustomerRequestCount,
  };
}

/**
 * Maps TMS freight order / load internal status to clean customer-facing freight status.
 */
export function mapPortalFreightStatus(internalStatus?: string | null): CustomerFreightStatus {
  const norm = (internalStatus || "").toUpperCase();
  if (norm.includes("DELIVERED") || norm.includes("POD")) return "POD Received";
  if (norm.includes("ARRIVED") || norm.includes("STOP")) return "Arrived at Stop";
  if (norm.includes("DISPATCH") || norm.includes("ASSIGNED") || norm.includes("TENDER")) return "Dispatched";
  if (norm.includes("TRANSIT") || norm.includes("EN_ROUTE")) return "In Transit";
  if (norm.includes("HOLD")) return "On Hold";
  return "In Transit";
}
