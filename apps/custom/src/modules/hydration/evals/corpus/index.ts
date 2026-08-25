/**
 * Tenant-Sanitized Golden Evaluation Corpus — Phase 0 Benchmark Fixtures
 *
 * Provides production-shaped, tenant-sanitized document extractions and ground-truth
 * semantic benchmark facts for CI evaluation of extraction recall, mapping coverage,
 * precision, and fill rate.
 */

import type { GroundedEvidenceReference } from "../../types/canonicalRegistry";

export interface BenchmarkFact {
  canonicalKey: string;
  targetEntityRef?: string;
  groundTruthValue: unknown;
  evidence: GroundedEvidenceReference;
  isConsequential: boolean;
}

export interface GoldenFixture {
  id: string;
  documentType: string;
  title: string;
  extractedFields: Record<string, string>;
  tradeMetadata: Record<string, string>;
  lineItems: Array<Record<string, unknown>>;
  benchmarkFacts: BenchmarkFact[];
}

export interface GoldenPacketFixture {
  id: string;
  title: string;
  documents: GoldenFixture[];
  shipmentBenchmarkFacts: BenchmarkFact[];
}

// ---------------------------------------------------------------------------
// INDIVIDUAL DOCUMENT FIXTURES
// ---------------------------------------------------------------------------

export const COMMERCIAL_INVOICE_FIXTURE: GoldenFixture = {
  id: "doc_ci_1001",
  documentType: "COMMERCIAL_INVOICE",
  title: "Commercial Invoice — Apex Electronics Ltd",
  extractedFields: {
    invoiceNumber: "INV-2026-8841",
    invoiceDate: "2026-08-10",
    exporterName: "Apex Electronics Ltd",
    importerName: "Global Trade Logistics Inc",
    originCountry: "MX",
    destinationCountry: "US",
    carrier: "HAPAG LLOYD MEXICO SA DE CV",
    incoterm: "FOB",
    currency: "USD",
    invoiceSubtotal: "145000.00",
    totalWeight: "2450.50",
  },
  tradeMetadata: {
    invoiceNumber: "INV-2026-8841",
    invoiceDate: "2026-08-10",
    exporterName: "Apex Electronics Ltd",
    importerName: "Global Trade Logistics Inc",
    originCountry: "MX",
    destinationCountry: "US",
    carrier: "HAPAG LLOYD MEXICO SA DE CV",
    incoterm: "FOB",
    currency: "USD",
    invoiceSubtotal: "145000.00",
    totalWeight: "2450.50",
  },
  lineItems: [
    {
      lineNumber: 1,
      description: "Automotive Sensor Assembly Module Type-A",
      quantity: "5000",
      unitPrice: "18.50",
      htsCode: "8542.31.0000",
    },
    {
      lineNumber: 2,
      description: "Microcontroller Sub-Assembly Unit B",
      quantity: "2500",
      unitPrice: "21.00",
      htsCode: "8542.39.0000",
    },
  ],
  benchmarkFacts: [
    {
      canonicalKey: "shipment.invoiceNumber",
      groundTruthValue: "INV-2026-8841",
      isConsequential: false,
      evidence: {
        documentId: "doc_ci_1001",
        parseVersionId: "pv_1",
        pageNumber: 1,
        rawLabel: "Invoice No:",
        rawValue: "INV-2026-8841",
      },
    },
    {
      canonicalKey: "shipment.invoiceDate",
      groundTruthValue: "2026-08-10",
      isConsequential: false,
      evidence: {
        documentId: "doc_ci_1001",
        parseVersionId: "pv_1",
        pageNumber: 1,
        rawLabel: "Date:",
        rawValue: "2026-08-10",
      },
    },
    {
      canonicalKey: "party.exporter.name",
      groundTruthValue: "Apex Electronics Ltd",
      isConsequential: true,
      evidence: {
        documentId: "doc_ci_1001",
        parseVersionId: "pv_1",
        pageNumber: 1,
        rawLabel: "Shipper / Exporter:",
        rawValue: "Apex Electronics Ltd",
      },
    },
    {
      canonicalKey: "party.importer.name",
      groundTruthValue: "Global Trade Logistics Inc",
      isConsequential: true,
      evidence: {
        documentId: "doc_ci_1001",
        parseVersionId: "pv_1",
        pageNumber: 1,
        rawLabel: "Consignee / Importer:",
        rawValue: "Global Trade Logistics Inc",
      },
    },
    {
      canonicalKey: "shipment.originCountry",
      groundTruthValue: "MX",
      isConsequential: true,
      evidence: {
        documentId: "doc_ci_1001",
        parseVersionId: "pv_1",
        pageNumber: 1,
        rawLabel: "Country of Origin:",
        rawValue: "Mexico",
      },
    },
    {
      canonicalKey: "shipment.carrier.name",
      groundTruthValue: "HAPAG LLOYD MEXICO SA DE CV",
      isConsequential: false,
      evidence: {
        documentId: "doc_ci_1001",
        parseVersionId: "pv_1",
        pageNumber: 1,
        rawLabel: "Carrier:",
        rawValue: "HAPAG LLOYD MEXICO SA DE CV",
      },
    },
    {
      canonicalKey: "shipment.incoterm",
      groundTruthValue: "FOB",
      isConsequential: false,
      evidence: {
        documentId: "doc_ci_1001",
        parseVersionId: "pv_1",
        pageNumber: 1,
        rawLabel: "Incoterm:",
        rawValue: "FOB",
      },
    },
    {
      canonicalKey: "shipment.financial.invoiceCurrency",
      groundTruthValue: "USD",
      isConsequential: false,
      evidence: {
        documentId: "doc_ci_1001",
        parseVersionId: "pv_1",
        pageNumber: 1,
        rawLabel: "Currency:",
        rawValue: "USD",
      },
    },
    {
      canonicalKey: "shipment.financial.invoiceSubtotal",
      groundTruthValue: 145000.0,
      isConsequential: false,
      evidence: {
        documentId: "doc_ci_1001",
        parseVersionId: "pv_1",
        pageNumber: 1,
        rawLabel: "Invoice Subtotal:",
        rawValue: "145000.00",
      },
    },
    {
      canonicalKey: "lineItem[].description",
      targetEntityRef: "line:1",
      groundTruthValue: "Automotive Sensor Assembly Module Type-A",
      isConsequential: false,
      evidence: {
        documentId: "doc_ci_1001",
        parseVersionId: "pv_1",
        pageNumber: 1,
        rawLabel: "Description",
        rawValue: "Automotive Sensor Assembly Module Type-A",
      },
    },
    {
      canonicalKey: "lineItem[].htsCode",
      targetEntityRef: "line:1",
      groundTruthValue: "8542310000",
      isConsequential: true,
      evidence: {
        documentId: "doc_ci_1001",
        parseVersionId: "pv_1",
        pageNumber: 1,
        rawLabel: "HTS",
        rawValue: "8542.31.0000",
      },
    },
  ],
};

export const PACKING_LIST_FIXTURE: GoldenFixture = {
  id: "doc_pl_1002",
  documentType: "PACKING_LIST",
  title: "Packing List — Apex Electronics Ltd",
  extractedFields: {
    invoiceNumber: "INV-2026-8841",
    totalWeight: "2450.50",
    exporterName: "Apex Electronics Ltd",
    importerName: "Global Trade Logistics Inc",
  },
  tradeMetadata: {
    invoiceNumber: "INV-2026-8841",
    totalWeight: "2450.50",
    exporterName: "Apex Electronics Ltd",
    importerName: "Global Trade Logistics Inc",
  },
  lineItems: [
    {
      lineNumber: 1,
      description: "Automotive Sensor Assembly Module Type-A",
      quantity: "5000",
    },
    {
      lineNumber: 2,
      description: "Microcontroller Sub-Assembly Unit B",
      quantity: "2500",
    },
  ],
  benchmarkFacts: [
    {
      canonicalKey: "shipment.cargo.grossWeight",
      groundTruthValue: 2450.5,
      isConsequential: false,
      evidence: {
        documentId: "doc_pl_1002",
        parseVersionId: "pv_1",
        pageNumber: 1,
        rawLabel: "Gross Weight (kg):",
        rawValue: "2450.50",
      },
    },
  ],
};

export const BILL_OF_LADING_FIXTURE: GoldenFixture = {
  id: "doc_bol_1003",
  documentType: "BILL_OF_LADING",
  title: "Ocean Bill of Lading — Hapag Lloyd",
  extractedFields: {
    transportDocumentNumber: "HLCUMX12609081",
    carrier: "HAPAG LLOYD MEXICO SA DE CV",
    originCountry: "MX",
    destinationCountry: "US",
    portOfEntry: "2704",
  },
  tradeMetadata: {
    transportDocumentNumber: "HLCUMX12609081",
    carrier: "HAPAG LLOYD MEXICO SA DE CV",
    originCountry: "MX",
    destinationCountry: "US",
    portOfEntry: "2704",
  },
  lineItems: [],
  benchmarkFacts: [
    {
      canonicalKey: "tracking.billOfLading",
      groundTruthValue: "HLCUMX12609081",
      isConsequential: true,
      evidence: {
        documentId: "doc_bol_1003",
        parseVersionId: "pv_1",
        pageNumber: 1,
        rawLabel: "B/L Number:",
        rawValue: "HLCUMX12609081",
      },
    },
    {
      canonicalKey: "shipment.carrier.name",
      groundTruthValue: "HAPAG LLOYD MEXICO SA DE CV",
      isConsequential: false,
      evidence: {
        documentId: "doc_bol_1003",
        parseVersionId: "pv_1",
        pageNumber: 1,
        rawLabel: "Ocean Carrier:",
        rawValue: "HAPAG LLOYD MEXICO SA DE CV",
      },
    },
    {
      canonicalKey: "filing.portOfEntry",
      groundTruthValue: "2704",
      isConsequential: false,
      evidence: {
        documentId: "doc_bol_1003",
        parseVersionId: "pv_1",
        pageNumber: 1,
        rawLabel: "Port of Discharge:",
        rawValue: "2704 - Los Angeles, CA",
      },
    },
  ],
};

export const AIR_WAYBILL_FIXTURE: GoldenFixture = {
  id: "doc_awb_1004",
  documentType: "AIR_WAYBILL",
  title: "Air Waybill — Lufthansa Cargo",
  extractedFields: {
    airWaybill: "020-99481023",
    carrier: "LUFTHANSA CARGO AG",
    originCountry: "DE",
    destinationCountry: "US",
  },
  tradeMetadata: {
    airWaybill: "020-99481023",
    carrier: "LUFTHANSA CARGO AG",
    originCountry: "DE",
    destinationCountry: "US",
  },
  lineItems: [],
  benchmarkFacts: [
    {
      canonicalKey: "tracking.airWaybill",
      groundTruthValue: "020-99481023",
      isConsequential: true,
      evidence: {
        documentId: "doc_awb_1004",
        parseVersionId: "pv_1",
        pageNumber: 1,
        rawLabel: "MAWB Number:",
        rawValue: "020-99481023",
      },
    },
  ],
};

export const CERTIFICATE_OF_ORIGIN_FIXTURE: GoldenFixture = {
  id: "doc_coo_1005",
  documentType: "CERTIFICATE_OF_ORIGIN",
  title: "USMCA Certificate of Origin",
  extractedFields: {
    originCountry: "MX",
    exporterName: "Apex Electronics Ltd",
    importerName: "Global Trade Logistics Inc",
  },
  tradeMetadata: {
    originCountry: "MX",
    exporterName: "Apex Electronics Ltd",
    importerName: "Global Trade Logistics Inc",
  },
  lineItems: [],
  benchmarkFacts: [
    {
      canonicalKey: "shipment.originCountry",
      groundTruthValue: "MX",
      isConsequential: true,
      evidence: {
        documentId: "doc_coo_1005",
        parseVersionId: "pv_1",
        pageNumber: 1,
        rawLabel: "Country of Origin:",
        rawValue: "Mexico",
      },
    },
  ],
};

export const ENTRY_SUMMARY_FIXTURE: GoldenFixture = {
  id: "doc_7501_1006",
  documentType: "ENTRY_SUMMARY",
  title: "CBP Form 7501 Entry Summary",
  extractedFields: {
    entryNumber: "991-0498172-3",
    entryType: "01",
    importerName: "Global Trade Logistics Inc",
    portOfEntry: "2704",
    transportDocumentNumber: "HLCUMX12609081",
  },
  tradeMetadata: {
    entryNumber: "991-0498172-3",
    entryType: "01",
    importerName: "Global Trade Logistics Inc",
    portOfEntry: "2704",
    transportDocumentNumber: "HLCUMX12609081",
  },
  lineItems: [],
  benchmarkFacts: [
    {
      canonicalKey: "filing.entryNumber",
      groundTruthValue: "99104981723",
      isConsequential: true,
      evidence: {
        documentId: "doc_7501_1006",
        parseVersionId: "pv_1",
        pageNumber: 1,
        rawLabel: "Entry No:",
        rawValue: "991-0498172-3",
      },
    },
  ],
};

export const ISF_FIXTURE: GoldenFixture = {
  id: "doc_isf_1007",
  documentType: "ISF",
  title: "Importer Security Filing (10+2)",
  extractedFields: {
    transportDocumentNumber: "HLCUMX12609081",
    importerName: "Global Trade Logistics Inc",
    exporterName: "Apex Electronics Ltd",
    portOfEntry: "2704",
  },
  tradeMetadata: {
    transportDocumentNumber: "HLCUMX12609081",
    importerName: "Global Trade Logistics Inc",
    exporterName: "Apex Electronics Ltd",
    portOfEntry: "2704",
  },
  lineItems: [],
  benchmarkFacts: [
    {
      canonicalKey: "tracking.billOfLading",
      groundTruthValue: "HLCUMX12609081",
      isConsequential: true,
      evidence: {
        documentId: "doc_isf_1007",
        parseVersionId: "pv_1",
        pageNumber: 1,
        rawLabel: "B/L Number:",
        rawValue: "HLCUMX12609081",
      },
    },
    {
      canonicalKey: "party.importer.name",
      groundTruthValue: "Global Trade Logistics Inc",
      isConsequential: true,
      evidence: {
        documentId: "doc_isf_1007",
        parseVersionId: "pv_1",
        pageNumber: 1,
        rawLabel: "ISF Importer:",
        rawValue: "Global Trade Logistics Inc",
      },
    },
    {
      canonicalKey: "party.exporter.name",
      groundTruthValue: "Apex Electronics Ltd",
      isConsequential: true,
      evidence: {
        documentId: "doc_isf_1007",
        parseVersionId: "pv_1",
        pageNumber: 1,
        rawLabel: "Seller / Supplier:",
        rawValue: "Apex Electronics Ltd",
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// MULTI-DOCUMENT SHIPMENT PACKET FIXTURES
// ---------------------------------------------------------------------------

export const OCEAN_IMPORT_PACKET: GoldenPacketFixture = {
  id: "packet_ocean_01",
  title: "Ocean Import Packet (CI + PL + BOL + COO)",
  documents: [
    COMMERCIAL_INVOICE_FIXTURE,
    PACKING_LIST_FIXTURE,
    BILL_OF_LADING_FIXTURE,
    CERTIFICATE_OF_ORIGIN_FIXTURE,
  ],
  shipmentBenchmarkFacts: [
    ...COMMERCIAL_INVOICE_FIXTURE.benchmarkFacts,
    ...BILL_OF_LADING_FIXTURE.benchmarkFacts,
  ],
};

export const AIR_IMPORT_PACKET: GoldenPacketFixture = {
  id: "packet_air_01",
  title: "Air Import Packet (CI + PL + AWB)",
  documents: [
    COMMERCIAL_INVOICE_FIXTURE,
    PACKING_LIST_FIXTURE,
    AIR_WAYBILL_FIXTURE,
  ],
  shipmentBenchmarkFacts: [
    ...COMMERCIAL_INVOICE_FIXTURE.benchmarkFacts,
    ...AIR_WAYBILL_FIXTURE.benchmarkFacts,
  ],
};

export const GOLDEN_CORPUS_FIXTURES: GoldenFixture[] = [
  COMMERCIAL_INVOICE_FIXTURE,
  PACKING_LIST_FIXTURE,
  BILL_OF_LADING_FIXTURE,
  AIR_WAYBILL_FIXTURE,
  CERTIFICATE_OF_ORIGIN_FIXTURE,
  ENTRY_SUMMARY_FIXTURE,
  ISF_FIXTURE,
];

export const GOLDEN_CORPUS_PACKETS: GoldenPacketFixture[] = [
  OCEAN_IMPORT_PACKET,
  AIR_IMPORT_PACKET,
];
