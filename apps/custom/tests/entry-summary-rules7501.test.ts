import { describe, expect, it } from "vitest";

import { assembleEntrySummaryDraft, type AssemblerFactLike, type AssemblerInput, type FieldApprovalLike } from "@/modules/entrySummary/assembler";
import { bindDutyFields } from "@/modules/entrySummary/duty";
import type { EntrySummaryDraft } from "@/modules/entrySummary/model";
import { validateDraft } from "@/modules/entrySummary/validation/engine";
import {
  FILING_BLOCKER_TO_7501_RULES,
  RULE_7501_CODES,
  RULES_7501,
  type Rules7501Context,
} from "@/modules/entrySummary/validation/rules7501";

const CLOCK = () => new Date("2026-01-01T00:00:00.000Z");

const HEADER_APPROVALS: FieldApprovalLike[] = [
  { id: "fa_entryType", blockId: "B02_ENTRY_TYPE", value: "01" },
  { id: "fa_port", blockId: "B06_PORT_CODE", value: "2704" },
  { id: "fa_mode", blockId: "B09_MODE_OF_TRANSPORT", value: "Ocean" },
  { id: "fa_importerNumber", blockId: "B23_IMPORTER_NUMBER", value: "12-3456789" },
  { id: "fa_exportCountry", blockId: "B14_EXPORTING_COUNTRY", value: "CN" },
  { id: "fa_summaryDate", blockId: "B03_SUMMARY_DATE", value: "2026-01-20" },
  { id: "fa_importDate", blockId: "B11_IMPORT_DATE", value: "2026-01-15" },
  { id: "fa_mid", blockId: "B13_MANUFACTURER_ID", value: "MIDUS1234567890" },
];

const LINE_APPROVALS: FieldApprovalLike[] = [
  { id: "fa_l1_origin", blockId: "B10_COUNTRY_OF_ORIGIN", lineNumber: 1, value: "CN" },
  { id: "fa_l1_hts", blockId: "B29A_HTSUS_NUMBER", lineNumber: 1, value: "8481.80.5090" },
  { id: "fa_l1_value", blockId: "B32A_ENTERED_VALUE", lineNumber: 1, value: "10000" },
  { id: "fa_l1_qty", blockId: "B31_NET_QUANTITY", lineNumber: 1, value: "100" },
];

/**
 * Merges override approvals onto the golden defaults, keyed by (blockId,
 * lineNumber). An override whose value is "" removes the default entirely
 * (simulating the block being genuinely missing) rather than resolving to an
 * empty-string USER-sourced value.
 */
function mergeApprovals(overrides: FieldApprovalLike[]): FieldApprovalLike[] {
  const key = (a: Pick<FieldApprovalLike, "blockId" | "lineNumber">) => `${a.blockId}:${a.lineNumber ?? ""}`;
  const merged = new Map<string, FieldApprovalLike>();
  for (const a of [...HEADER_APPROVALS, ...LINE_APPROVALS]) merged.set(key(a), a);
  for (const o of overrides) {
    if (o.value === "") merged.delete(key(o));
    else merged.set(key(o), o);
  }
  return [...merged.values()];
}

function buildGoldenDraft(
  overrideApprovals: FieldApprovalLike[] = [],
  importerOverride: AssemblerInput["importerOfRecord"] | undefined = undefined
): EntrySummaryDraft {
  const input: AssemblerInput = {
    shipment: { id: "shp_1", entryType: null, portOfEntry: null, transportMode: null, countryOfExport: null, destinationCountry: null, countryOfOrigin: null },
    lineItems: [{ id: "li_1", lineNumber: 1 }],
    importerOfRecord:
      importerOverride !== undefined
        ? importerOverride
        : { id: "ior_1", name: "Acme Importer LLC", irsEin: "12-3456789", cbpImporterNumber: null, address: "1 Main St, Springfield" },
    bond: { id: "bond_1", bondNumber: "BND-1", bondType: "continuous", suretyCode: "SUR1", status: "verified", expirationDate: new Date("2027-01-01") },
    parties: [{ id: "party_1", role: "ULTIMATE_CONSIGNEE", name: "Acme Importer LLC", address: "1 Main St, Springfield" }],
    facts: [],
    documents: [{ id: "doc_1", docType: "Commercial Invoice", status: "received" }],
    approvedDecisions: [],
    fieldApprovals: mergeApprovals(overrideApprovals),
    filerProfile: { id: "fp_1", filerCode: "ABC", defaultPortCode: null },
    clock: CLOCK,
  };
  const assembled = assembleEntrySummaryDraft(input);
  return bindDutyFields({ draft: assembled, lineDutyInputs: { 1: { generalDutyRate: "2.5%" } }, clock: CLOCK });
}

function goldenCtx(overrides: Partial<Rules7501Context> = {}): Rules7501Context {
  return {
    entryDate: new Date("2026-02-01"),
    bond: { status: "verified", expirationDate: new Date("2027-01-01") },
    bondRequired: true,
    powerOfAttorney: { status: "executed", expirationDate: null, revokedAt: null },
    pgaRequirements: [],
    openBlockingExceptionsCount: 0,
    hasCommercialInvoice: true,
    importerOnboardingStatus: "active",
    criticalReconciliationOpen: false,
    ...overrides,
  };
}

describe("golden draft", () => {
  it("produces zero BLOCKING findings", () => {
    const draft = buildGoldenDraft();
    const result = validateDraft(draft, RULES_7501, goldenCtx());
    const blocking = result.findings.filter((f) => f.severity === "BLOCKING");
    expect(blocking).toEqual([]);
    expect(result.isExportable).toBe(true);
  });
});

describe("rule codes are frozen", () => {
  it("matches the checked-in snapshot list", () => {
    expect(RULE_7501_CODES).toEqual([
      "E7501.B01.FILER_CODE_MISSING",
      "E7501.B02.ENTRY_TYPE_INVALID",
      "E7501.B06.PORT_MISSING",
      "E7501.B06.PORT_FORMAT",
      "E7501.B23.IMPORTER_NUMBER_MISSING",
      "E7501.B23.IMPORTER_NUMBER_FORMAT",
      "E7501.B04.BOND_MISSING",
      "E7501.BOND.EXPIRED",
      "E7501.POA.NOT_ACTIVE",
      "E7501.B27.NO_LINES",
      "E7501.B29.HTS_MISSING",
      "E7501.B29.HTS_FORMAT",
      "E7501.B10.ORIGIN_MISSING",
      "E7501.B10.ORIGIN_NOT_ISO",
      "E7501.B32.VALUE_NONPOSITIVE",
      "E7501.B31.QTY_MISSING",
      "E7501.TOTALS.LINE_SUM_MISMATCH",
      "E7501.TOTALS.GRAND_TOTAL_MISMATCH",
      "E7501.B09.MODE_TRANSPORT_INVALID",
      "E7501.HMF.MODE_MISMATCH",
      "E7501.B14.EXPORT_COUNTRY_MISSING",
      "E7501.B11.IMPORT_DATE_AFTER_SUMMARY_DATE",
      "E7501.B18.MISSING_DOCS",
      "E7501.B26.IMPORTER_OF_RECORD_MISSING",
      "E7501.EXCEPTIONS.OPEN_BLOCKING",
      "E7501.RECONCILIATION.CRITICAL_OPEN",
      "E7501.IMPORTER.NOT_ONBOARDED",
      "W7501.B29.LOW_CONFIDENCE",
      "W7501.PROVENANCE.UNVERIFIED",
      "W7501.B13.MID_MISSING",
      "W7501.PGA.FLAG_UNRESOLVED",
      "W7501.EXCEPTIONS.OPEN_BLOCKING",
    ]);
  });
});

describe("FilingBlockerCode coverage", () => {
  const ALL_FILING_BLOCKER_CODES = [
    "NO_LINE_ITEMS",
    "MISSING_HTS_CLASSIFICATION",
    "MISSING_COUNTRY_OF_ORIGIN",
    "MISSING_COMMERCIAL_INVOICE",
    "MISSING_IMPORTER_OF_RECORD",
    "MISSING_ENTRY_TYPE",
    "BLOCKING_EXCEPTIONS",
    "CRITICAL_RECONCILIATION",
    "IMPORTER_NOT_ONBOARDED",
  ] as const;

  it("every FilingBlockerCode maps to at least one E7501.* rule code", () => {
    for (const code of ALL_FILING_BLOCKER_CODES) {
      const mapped = FILING_BLOCKER_TO_7501_RULES[code];
      expect(mapped).toBeDefined();
      expect(mapped.length).toBeGreaterThan(0);
      for (const ruleCode of mapped) {
        expect(ruleCode.startsWith("E7501.")).toBe(true);
        expect(RULE_7501_CODES).toContain(ruleCode);
      }
    }
    expect(Object.keys(FILING_BLOCKER_TO_7501_RULES).sort()).toEqual([...ALL_FILING_BLOCKER_CODES].sort());
  });
});

describe("per-rule firing", () => {
  const cases: Array<{ code: string; build: () => { draft: EntrySummaryDraft; ctx: Rules7501Context } }> = [
    { code: "E7501.B02.ENTRY_TYPE_INVALID", build: () => ({ draft: buildGoldenDraft([{ id: "x", blockId: "B02_ENTRY_TYPE", value: "99" }]), ctx: goldenCtx() }) },
    { code: "E7501.B06.PORT_FORMAT", build: () => ({ draft: buildGoldenDraft([{ id: "x", blockId: "B06_PORT_CODE", value: "27" }]), ctx: goldenCtx() }) },
    { code: "E7501.B23.IMPORTER_NUMBER_FORMAT", build: () => ({ draft: buildGoldenDraft([{ id: "x", blockId: "B23_IMPORTER_NUMBER", value: "not-a-number" }]), ctx: goldenCtx() }) },
    { code: "E7501.B04.BOND_MISSING", build: () => ({ draft: buildGoldenDraft(), ctx: goldenCtx({ bond: null }) }) },
    { code: "E7501.BOND.EXPIRED", build: () => ({ draft: buildGoldenDraft(), ctx: goldenCtx({ bond: { status: "verified", expirationDate: new Date("2026-01-15") } }) }) },
    { code: "E7501.POA.NOT_ACTIVE", build: () => ({ draft: buildGoldenDraft(), ctx: goldenCtx({ powerOfAttorney: null }) }) },
    { code: "E7501.B29.HTS_MISSING", build: () => ({ draft: buildGoldenDraft([{ id: "x", blockId: "B29A_HTSUS_NUMBER", lineNumber: 1, value: "" }]), ctx: goldenCtx() }) },
    { code: "E7501.B10.ORIGIN_MISSING", build: () => ({ draft: buildGoldenDraft([{ id: "x", blockId: "B10_COUNTRY_OF_ORIGIN", lineNumber: 1, value: "" }]), ctx: goldenCtx() }) },
    { code: "E7501.B10.ORIGIN_NOT_ISO", build: () => ({ draft: buildGoldenDraft([{ id: "x", blockId: "B10_COUNTRY_OF_ORIGIN", lineNumber: 1, value: "ZZ" }]), ctx: goldenCtx() }) },
    { code: "E7501.B32.VALUE_NONPOSITIVE", build: () => ({ draft: buildGoldenDraft([{ id: "x", blockId: "B32A_ENTERED_VALUE", lineNumber: 1, value: "0" }]), ctx: goldenCtx() }) },
    { code: "E7501.B31.QTY_MISSING", build: () => ({ draft: buildGoldenDraft([{ id: "x", blockId: "B31_NET_QUANTITY", lineNumber: 1, value: "0" }]), ctx: goldenCtx() }) },
    { code: "E7501.B09.MODE_TRANSPORT_INVALID", build: () => ({ draft: buildGoldenDraft([{ id: "x", blockId: "B09_MODE_OF_TRANSPORT", value: "Spaceship" }]), ctx: goldenCtx() }) },
    { code: "E7501.B14.EXPORT_COUNTRY_MISSING", build: () => ({ draft: buildGoldenDraft([{ id: "x", blockId: "B14_EXPORTING_COUNTRY", value: "" }]), ctx: goldenCtx() }) },
    { code: "E7501.B18.MISSING_DOCS", build: () => ({ draft: buildGoldenDraft(), ctx: goldenCtx({ hasCommercialInvoice: false }) }) },
    { code: "E7501.EXCEPTIONS.OPEN_BLOCKING", build: () => ({ draft: buildGoldenDraft(), ctx: goldenCtx({ openBlockingExceptionsCount: 2 }) }) },
    { code: "E7501.RECONCILIATION.CRITICAL_OPEN", build: () => ({ draft: buildGoldenDraft(), ctx: goldenCtx({ criticalReconciliationOpen: true }) }) },
    { code: "E7501.IMPORTER.NOT_ONBOARDED", build: () => ({ draft: buildGoldenDraft(), ctx: goldenCtx({ importerOnboardingStatus: "pending" }) }) },
    { code: "W7501.B13.MID_MISSING", build: () => ({ draft: buildGoldenDraft([{ id: "x", blockId: "B13_MANUFACTURER_ID", value: "" }]), ctx: goldenCtx() }) },
    { code: "W7501.PGA.FLAG_UNRESOLVED", build: () => ({ draft: buildGoldenDraft(), ctx: goldenCtx({ pgaRequirements: [{ lineNumber: 1, resolved: false }] }) }) },
    { code: "W7501.EXCEPTIONS.OPEN_BLOCKING", build: () => ({ draft: buildGoldenDraft(), ctx: goldenCtx({ openBlockingExceptionsCount: 1 }) }) },
    { code: "E7501.B23.IMPORTER_NUMBER_MISSING", build: () => ({ draft: buildGoldenDraft([{ id: "x", blockId: "B23_IMPORTER_NUMBER", value: "" }], null), ctx: goldenCtx() }) },
    {
      code: "E7501.B27.NO_LINES",
      build: () => {
        const input: AssemblerInput = {
          shipment: { id: "shp_1", entryType: null, portOfEntry: null, transportMode: null, countryOfExport: null, destinationCountry: null, countryOfOrigin: null },
          lineItems: [],
          importerOfRecord: { id: "ior_1", name: "Acme Importer LLC", irsEin: "12-3456789", cbpImporterNumber: null, address: "1 Main St" },
          bond: null,
          parties: [],
          facts: [],
          documents: [],
          approvedDecisions: [],
          fieldApprovals: mergeApprovals([]),
          filerProfile: { id: "fp_1", filerCode: "ABC", defaultPortCode: null },
          clock: CLOCK,
        };
        const assembled = assembleEntrySummaryDraft(input);
        return { draft: bindDutyFields({ draft: assembled, lineDutyInputs: {}, clock: CLOCK }), ctx: goldenCtx() };
      },
    },
    {
      code: "E7501.TOTALS.LINE_SUM_MISMATCH",
      build: () => {
        const draft = buildGoldenDraft();
        const corrupted: EntrySummaryDraft = {
          ...draft,
          header: { fields: { ...draft.header.fields, B35_TOTAL_ENTERED_VALUE: { ...draft.header.fields.B35_TOTAL_ENTERED_VALUE, value: draft.header.fields.B35_TOTAL_ENTERED_VALUE.value!.plus(1) } } },
        };
        return { draft: corrupted, ctx: goldenCtx() };
      },
    },
    {
      code: "E7501.TOTALS.GRAND_TOTAL_MISMATCH",
      build: () => {
        const draft = buildGoldenDraft();
        const corrupted: EntrySummaryDraft = {
          ...draft,
          header: { fields: { ...draft.header.fields, B40_TOTAL: { ...draft.header.fields.B40_TOTAL, value: draft.header.fields.B40_TOTAL.value!.plus(1) } } },
        };
        return { draft: corrupted, ctx: goldenCtx() };
      },
    },
  ];

  for (const { code, build } of cases) {
    it(`${code} fires on its trigger fixture and is absent from the golden draft`, () => {
      const { draft, ctx } = build();
      const result = validateDraft(draft, RULES_7501, ctx);
      expect(result.findings.map((f) => f.code)).toContain(code);

      const golden = validateDraft(buildGoldenDraft(), RULES_7501, goldenCtx());
      expect(golden.findings.map((f) => f.code)).not.toContain(code);

      // Message states an observed value/count, never a bare adjective.
      const finding = result.findings.find((f) => f.code === code)!;
      expect(finding.message.length).toBeGreaterThan(0);
    });
  }
});

describe("HTS format", () => {
  const table: Array<[string, boolean]> = [
    ["8481.80.5090", true],
    ["8481.80.50", false],
    ["84818050900", false],
    ["8481-80-5090", false],
    ["", false],
  ];

  for (const [value, shouldPass] of table) {
    it(`"${value}" ${shouldPass ? "passes" : "fails"} the HTS format check`, () => {
      const draft = buildGoldenDraft([{ id: "x", blockId: "B29A_HTSUS_NUMBER", lineNumber: 1, value }]);
      const result = validateDraft(draft, RULES_7501, goldenCtx());
      const codes = result.findings.map((f) => f.code);
      if (shouldPass) {
        expect(codes).not.toContain("E7501.B29.HTS_FORMAT");
        expect(codes).not.toContain("E7501.B29.HTS_MISSING");
      } else if (value === "") {
        expect(codes).toContain("E7501.B29.HTS_MISSING");
      } else {
        expect(codes).toContain("E7501.B29.HTS_FORMAT");
      }
    });
  }

  it("each failing case produces a distinct message", () => {
    const messages = new Set<string>();
    for (const [value] of table.filter(([, pass]) => !pass)) {
      const draft = buildGoldenDraft([{ id: "x", blockId: "B29A_HTSUS_NUMBER", lineNumber: 1, value }]);
      const result = validateDraft(draft, RULES_7501, goldenCtx());
      const relevant = result.findings.find((f) => f.code === "E7501.B29.HTS_FORMAT" || f.code === "E7501.B29.HTS_MISSING");
      messages.add(relevant!.message);
    }
    expect(messages.size).toBe(table.filter(([, pass]) => !pass).length);
  });
});

describe("bond expiry boundary", () => {
  it("passes when the bond expires the day after the entry date", () => {
    const result = validateDraft(buildGoldenDraft(), RULES_7501, goldenCtx({ bond: { status: "verified", expirationDate: new Date("2026-02-02") } }));
    expect(result.findings.map((f) => f.code)).not.toContain("E7501.BOND.EXPIRED");
  });

  it("fires when the bond expires the day before the entry date", () => {
    const result = validateDraft(buildGoldenDraft(), RULES_7501, goldenCtx({ bond: { status: "verified", expirationDate: new Date("2026-01-31") } }));
    expect(result.findings.map((f) => f.code)).toContain("E7501.BOND.EXPIRED");
  });
});

describe("W7501.B29.LOW_CONFIDENCE exemption", () => {
  it("does not fire when a low-confidence HTS has a FieldApproval", () => {
    // The golden draft's HTS is already FieldApproval-sourced (source USER), so
    // it can never be "low confidence" (that check only applies to DOCUMENT/AGENT
    // sourced fields). This directly demonstrates the exemption.
    const draft = buildGoldenDraft();
    expect(draft.lines[0].fields.B29A_HTSUS_NUMBER.provenance.source).toBe("USER");
    const result = validateDraft(draft, RULES_7501, goldenCtx());
    expect(result.findings.map((f) => f.code)).not.toContain("W7501.B29.LOW_CONFIDENCE");
  });

  it("fires for a DOCUMENT-sourced HTS with confidence below 85", () => {
    const input: AssemblerInput = {
      shipment: { id: "shp_1", entryType: null, portOfEntry: null, transportMode: null, countryOfExport: null, destinationCountry: null, countryOfOrigin: null },
      lineItems: [{ id: "li_1", lineNumber: 1 }],
      importerOfRecord: { id: "ior_1", name: "Acme Importer LLC", irsEin: "12-3456789", cbpImporterNumber: null, address: "1 Main St" },
      bond: null,
      parties: [],
      facts: [
        { id: "f_hts", field: "htsCode", value: "8481.80.5090", sourceType: "EXTRACTED", confidence: 60, createdAt: CLOCK(), entityRef: "line:1" } as AssemblerFactLike,
      ],
      documents: [],
      approvedDecisions: [],
      fieldApprovals: [],
      filerProfile: { id: "fp_1", filerCode: "ABC", defaultPortCode: null },
      clock: CLOCK,
    };
    const draft = assembleEntrySummaryDraft(input);
    const result = validateDraft(draft, RULES_7501, goldenCtx());
    expect(result.findings.map((f) => f.code)).toContain("W7501.B29.LOW_CONFIDENCE");
  });
});
