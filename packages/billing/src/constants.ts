/** Product-agnostic capability definition shared by operational modules. */
export interface BillingEventDefItem {
  eventCode: string;
  name: string;
  description: string;
  category: string;
  defaultUnit: string;
  productLine?: "CUSTOMS" | "TMS" | "WMS";
}

/** Standard Billing Event Definitions (Pure Constant) */
export const DEFAULT_BILLING_EVENT_DEFINITIONS: readonly BillingEventDefItem[] = [
  {
    eventCode: "DOCUMENT_PROCESSED",
    name: "Document Processing",
    description: "Ingestion and extraction of commercial document pages",
    category: "DOCUMENT_PROCESSING",
    defaultUnit: "page",
  },
  {
    eventCode: "HTS_CLASSIFICATION_COMPLETED",
    name: "HTS Classification Completed",
    description: "Classification of line item to 10-digit HTS code",
    category: "CLASSIFICATION",
    defaultUnit: "line",
  },
  {
    eventCode: "HTS_MANUAL_REVIEW_COMPLETED",
    name: "Human HTS Classification Review",
    description: "Manual broker review and approval of HTS classification",
    category: "HUMAN_REVIEW",
    defaultUnit: "line",
  },
  {
    eventCode: "PRODUCT_NORMALIZATION_COMPLETED",
    name: "Product Normalization",
    description: "Catalog matching and product data normalization",
    category: "PRODUCT_NORMALIZATION",
    defaultUnit: "item",
  },
  {
    eventCode: "PGA_PROCESSING_COMPLETED",
    name: "PGA Processing",
    description: "Partner Government Agency flag validation and form data prep",
    category: "PGA_PROCESSING",
    defaultUnit: "entry",
  },
  {
    eventCode: "EXCEPTION_MANUALLY_RESOLVED",
    name: "Manual Exception Resolution",
    description: "Broker intervention to resolve shipment validation exception",
    category: "EXCEPTION_RESOLUTION",
    defaultUnit: "exception",
  },
  {
    eventCode: "CUSTOMS_ENTRY_COMPLETED",
    name: "Customs Entry Processing",
    description: "Full customs entry summary processing",
    category: "CUSTOMS_ENTRY",
    defaultUnit: "entry",
  },
  {
    eventCode: "ACE_FILING_TRANSMITTED",
    name: "ACE Filing Transmission",
    description: "Transmission of CBP entry summary to ACE EDI network",
    category: "ACE_FILING",
    defaultUnit: "transmission",
  },
  {
    eventCode: "ISF_FILING_TRANSMITTED",
    name: "ISF Filing Transmission",
    description: "Importer Security Filing transmission",
    category: "ISF_FILING",
    defaultUnit: "filing",
  },
  {
    eventCode: "RECONCILIATION_COMPLETED",
    name: "Shipment Reconciliation Completed",
    description: "Cross-document shipment reconciliation completed and exceptions refreshed",
    category: "RECONCILIATION",
    defaultUnit: "shipment",
  },
  {
    eventCode: "RECONCILIATION_ENTRY_PREPARED",
    name: "Reconciliation Entry Preparation",
    description: "Reconciliation entry flag assembly and filing prep",
    category: "RECONCILIATION",
    defaultUnit: "entry",
  },
  {
    eventCode: "ORIGIN_DETERMINATION_COMPLETED",
    name: "Origin Rules Determination",
    description: "FTA qualification analysis and country-of-origin rule evaluation per shipment",
    category: "ORIGIN_DETERMINATION",
    defaultUnit: "shipment",
  },
  {
    eventCode: "VALUATION_COMPLETED",
    name: "Valuation & Assists Analysis",
    description: "Entered customs value computation and assists/additions/deductions analysis",
    category: "VALUATION",
    defaultUnit: "shipment",
  },
  {
    eventCode: "COMPLIANCE_REVIEW_COMPLETED",
    name: "Compliance Audit Review",
    description: "Automated compliance screening for sanctions, licensing, and regulatory requirements",
    category: "COMPLIANCE_REVIEW",
    defaultUnit: "shipment",
  },
  {
    eventCode: "FILING_READINESS_COMPLETED",
    name: "Filing Readiness Assessment",
    description: "Entry readiness scoring and completeness check prior to ACE transmission",
    category: "FILING_READINESS",
    defaultUnit: "shipment",
  },
  {
    eventCode: "RPS_SCREENING_COMPLETED",
    name: "Restricted Party Screening",
    description: "Denied/restricted-party name and contact screening for a shipment or Party Master record",
    category: "RESTRICTED_PARTY_SCREENING",
    defaultUnit: "party",
  },
  {
    eventCode: "EMBARGO_SCREENING_COMPLETED",
    name: "Country Embargo Screening",
    description: "Transaction/party/line-level embargoed-destination and origin screening",
    category: "EMBARGO_SCREENING",
    defaultUnit: "shipment",
  },
  {
    eventCode: "COMMUNITY_SCREENING_COMPLETED",
    name: "Community Screening",
    description: "Bulk/manual party-list restricted-party and embargo screening outside the shipment pipeline",
    category: "COMMUNITY_SCREENING",
    defaultUnit: "party",
  },
  {
    eventCode: "RDPS_RESCREEN_COMPLETED",
    name: "Continuous Party Monitoring Re-screen",
    description: "Automated periodic re-screening of a Party Master record triggered by reference-data delta",
    category: "RDPS_RESCREEN",
    defaultUnit: "party",
  },
  {
    eventCode: "TMS_TENDER_DISPATCHED",
    name: "Carrier Tender Dispatched",
    description: "A transportation load tender was dispatched to a carrier",
    category: "CUSTOM",
    defaultUnit: "tender",
    productLine: "TMS",
  },
  {
    eventCode: "TMS_POD_CONFIRMED",
    name: "Proof of Delivery Confirmed",
    description: "Proof of delivery was validated for a transportation shipment",
    category: "CUSTOM",
    defaultUnit: "shipment",
    productLine: "TMS",
  },
  {
    eventCode: "TMS_LOAD_DELIVERED",
    name: "Load Delivered",
    description: "A managed transportation load reached delivered status",
    category: "CUSTOM",
    defaultUnit: "shipment",
    productLine: "TMS",
  },
  {
    eventCode: "TMS_FREIGHT_AUDIT_APPROVED",
    name: "Freight Audit Approved",
    description: "A carrier invoice completed freight-audit approval",
    category: "CUSTOM",
    defaultUnit: "invoice",
    productLine: "TMS",
  },
] as const;
