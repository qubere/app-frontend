import type { ComplianceNotificationType } from "@prisma/client";

export const NOTIFICATION_TYPE_LABELS: Record<ComplianceNotificationType, string> = {
  ASSIST_AMORTIZATION_ALERT: "Assist Nearing Full Amortization",
  RPS_HIT: "Restricted Party Match",
  RPS_REVIEW_REQUIRED: "Restricted Party Review Required",
  PAL_RESCREEN_HIT: "Pre-Approved Party Re-Screen Exception",
  PARTY_RESCREEN_HIT: "Party Master Re-Screen Exception",
  LICENSE_ALERT: "License Management Alert",
  LICENSE_DETERMINATION_REVIEW_REQUIRED: "License Determination Review Required",
};
