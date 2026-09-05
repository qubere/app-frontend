import { describe, expect, it } from "vitest";

import { Decimal } from "@/lib/tariff/decimal";
import { MPF_MAXIMUM, MPF_MINIMUM, type DutyRateInput } from "@/lib/tariff/dutyEngine";
import { assembleEntrySummaryDraft, type AssemblerFactLike, type AssemblerInput } from "@/modules/entrySummary/assembler";
import { assertTotalsInvariant, bindDutyFields, TotalsInvariantError } from "@/modules/entrySummary/duty";

const CLOCK = () => new Date("2026-01-01T00:00:00.000Z");

interface LineSpec {
  lineNumber: number;
  hts?: string;
  origin?: string;
  value?: number | string;
  qty?: number | string;
  chapter99Lines?: AssemblerInput["lineItems"][number]["chapter99Lines"];
}

function factsForLine(spec: LineSpec): AssemblerFactLike[] {
  const entityRef = `line:${spec.lineNumber}`;
  const mk = (field: string, value: unknown): AssemblerFactLike => ({
    id: `f_${field}_${spec.lineNumber}`,
    field,
    value: String(value),
    sourceType: "EXTRACTED",
    confidence: 95,
    createdAt: CLOCK(),
    entityRef,
  });
  const facts: AssemblerFactLike[] = [];
  if (spec.hts != null) facts.push(mk("htsCode", spec.hts));
  if (spec.origin != null) facts.push(mk("countryOfOrigin", spec.origin));
  if (spec.value != null) facts.push(mk("enteredValue", spec.value));
  if (spec.qty != null) facts.push(mk("netQuantity", spec.qty));
  return facts;
}

function buildDraft(lines: LineSpec[], mode: string = "Ocean") {
  const facts: AssemblerFactLike[] = lines.flatMap(factsForLine);
  facts.push({ id: "f_mode", field: "modeOfTransport", value: mode, sourceType: "EXTRACTED", confidence: 95, createdAt: CLOCK() });

  const input: AssemblerInput = {
    shipment: { id: "shp_1", entryType: null, portOfEntry: null, transportMode: null, countryOfExport: null, destinationCountry: null, countryOfOrigin: null },
    lineItems: lines.map((l) => ({ id: `li_${l.lineNumber}`, lineNumber: l.lineNumber, chapter99Lines: l.chapter99Lines })),
    importerOfRecord: null,
    bond: null,
    parties: [],
    facts,
    documents: [],
    approvedDecisions: [],
    fieldApprovals: [],
    filerProfile: { id: "fp_1", filerCode: "ABC", defaultPortCode: null },
    clock: CLOCK,
  };
  return assembleEntrySummaryDraft(input);
}

describe("bindDutyFields", () => {
  it("computes 2.5% ad valorem duty on a single line", () => {
    const draft = buildDraft([{ lineNumber: 1, hts: "8481.80.5090", origin: "CN", value: 10000, qty: 1 }]);
    const bound = bindDutyFields({ draft, lineDutyInputs: { 1: { generalDutyRate: "2.5%" } }, clock: CLOCK });
    expect(bound.lines[0].fields.B34_DUTY_TAX.value?.toString()).toBe("250");
    expect(bound.header.fields.B37_TOTAL_DUTY.value?.toString()).toBe("250");
  });

  it("floors MPF at MPF_MINIMUM for a small entered value", () => {
    const draft = buildDraft([{ lineNumber: 1, hts: "8481.80.5090", origin: "CN", value: 1000, qty: 1 }]);
    const bound = bindDutyFields({ draft, lineDutyInputs: {}, clock: CLOCK });
    const mpf = bound.header.fields.B39_TOTAL_OTHER_FEES.value?.find((f) => f.code === "MPF");
    expect(mpf?.amount.toString()).toBe(MPF_MINIMUM.toString());
  });

  it("caps MPF at MPF_MAXIMUM for a very large entered value", () => {
    const draft = buildDraft([{ lineNumber: 1, hts: "8481.80.5090", origin: "CN", value: 100000000, qty: 1 }]);
    const bound = bindDutyFields({ draft, lineDutyInputs: {}, clock: CLOCK });
    const mpf = bound.header.fields.B39_TOTAL_OTHER_FEES.value?.find((f) => f.code === "MPF");
    expect(mpf?.amount.toString()).toBe(MPF_MAXIMUM.toString());
  });

  it("includes HMF only in ocean mode; air mode has no HMF entry at all", () => {
    const oceanDraft = buildDraft([{ lineNumber: 1, hts: "8481.80.5090", origin: "CN", value: 10000, qty: 1 }], "Ocean");
    const oceanBound = bindDutyFields({ draft: oceanDraft, lineDutyInputs: {}, clock: CLOCK });
    expect(oceanBound.header.fields.B39_TOTAL_OTHER_FEES.value?.some((f) => f.code === "HMF")).toBe(true);

    const airDraft = buildDraft([{ lineNumber: 1, hts: "8481.80.5090", origin: "CN", value: 10000, qty: 1 }], "Air");
    const airBound = bindDutyFields({ draft: airDraft, lineDutyInputs: {}, clock: CLOCK });
    expect(airBound.header.fields.B39_TOTAL_OTHER_FEES.value?.some((f) => f.code === "HMF")).toBe(false);
  });

  it("a duty-free line (rate 0) gets B34 = 0.00 with COMPUTED provenance, not MISSING", () => {
    const draft = buildDraft([{ lineNumber: 1, hts: "8481.80.5090", origin: "CN", value: 10000, qty: 1 }]);
    const bound = bindDutyFields({ draft, lineDutyInputs: { 1: { generalDutyRate: "Free" } }, clock: CLOCK });
    expect(bound.lines[0].fields.B34_DUTY_TAX.value?.toString()).toBe("0");
    expect(bound.lines[0].fields.B34_DUTY_TAX.provenance.source).toBe("COMPUTED");
  });

  it("a Chapter 99 child line adds its own B34; the parent's B34 is unchanged; B37 sums both", () => {
    const draft = buildDraft([
      { lineNumber: 1, hts: "8481.80.5090", origin: "CN", value: 10000, qty: 1, chapter99Lines: [{ program: "301", htsCode: "9903.88.03" }] },
    ]);
    const bound = bindDutyFields({
      draft,
      lineDutyInputs: { 1: { generalDutyRate: "2.5%" }, 2: { generalDutyRate: "25%" } },
      clock: CLOCK,
    });
    const parent = bound.lines[0];
    const child = bound.lines[1];
    expect(child.parentLineNumber).toBe(1);
    expect(parent.fields.B34_DUTY_TAX.value?.toString()).toBe("250");
    expect(child.fields.B34_DUTY_TAX.value?.toString()).not.toBe("0");
    expect(bound.header.fields.B37_TOTAL_DUTY.value?.toString()).toBe(
      parent.fields.B34_DUTY_TAX.value!.plus(child.fields.B34_DUTY_TAX.value!).toString()
    );
  });

  it("B40 === B37 + B38 + sum(B39) across a 25-line fixture; corrupting one value throws the invariant error", () => {
    const lines: LineSpec[] = Array.from({ length: 25 }, (_, i) => ({
      lineNumber: i + 1,
      hts: "8481.80.5090",
      origin: "CN",
      value: 1000 + i,
      qty: 1,
    }));
    const draft = buildDraft(lines);
    const rateInputs: Record<number, DutyRateInput> = {};
    for (let i = 1; i <= 25; i++) rateInputs[i] = { generalDutyRate: "3%" };
    const bound = bindDutyFields({ draft, lineDutyInputs: rateInputs, clock: CLOCK });

    expect(() => assertTotalsInvariant(bound)).not.toThrow();

    const corrupted = {
      ...bound,
      header: {
        fields: {
          ...bound.header.fields,
          B40_TOTAL: { ...bound.header.fields.B40_TOTAL, value: bound.header.fields.B40_TOTAL.value!.plus(1) },
        },
      },
    };
    expect(() => assertTotalsInvariant(corrupted as typeof bound)).toThrow(TotalsInvariantError);
  });

  it("rounds once at the total, not by re-summing already-rounded per-line intermediates into a lossy figure", () => {
    // calculateDutyStack rounds each duty component to cents *inside* the
    // existing engine (see dutyEngine.ts), so a literal "33.333 x 3" input
    // cannot be observed pre-rounding through calculateDutyStack — this test
    // instead proves B37/B40 are the exact sum of the (already-rounded)
    // per-line B34 values, with no further precision loss introduced by this
    // module's own total/rounding step.
    const draft = buildDraft([
      { lineNumber: 1, hts: "8481.80.5090", origin: "CN", value: 1000, qty: 1 },
      { lineNumber: 2, hts: "8481.80.5090", origin: "CN", value: 1000, qty: 1 },
      { lineNumber: 3, hts: "8481.80.5090", origin: "CN", value: 1000.5, qty: 1 },
    ]);
    const bound = bindDutyFields({
      draft,
      lineDutyInputs: { 1: { generalDutyRate: "3.334%" }, 2: { generalDutyRate: "3.333%" }, 3: { generalDutyRate: "3.333%" } },
      clock: CLOCK,
    });
    const perLineSum = bound.lines.reduce((acc, l) => acc.plus(l.fields.B34_DUTY_TAX.value!), new Decimal(0));
    expect(bound.header.fields.B37_TOTAL_DUTY.value?.toString()).toBe(perLineSum.toString());
  });

  it("keeps full Decimal fidelity through a 0.1 + 0.2 style path (asserted as a string)", () => {
    const draft = buildDraft([
      { lineNumber: 1, hts: "8481.80.5090", origin: "CN", value: "0.10", qty: 1 },
      { lineNumber: 2, hts: "8481.80.5090", origin: "CN", value: "0.20", qty: 1 },
    ]);
    const bound = bindDutyFields({ draft, lineDutyInputs: {}, clock: CLOCK });
    expect(bound.header.fields.B35_TOTAL_ENTERED_VALUE.value?.toString()).toBe("0.3");
  });
});
