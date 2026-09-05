/**
 * Duty and fee computation binding (U4).
 *
 * Populates B33/B34 (per line) and B35/B37/B38/B39/B40 (header totals) on an
 * already-assembled EntrySummaryDraft, using the EXISTING duty engine at
 * `@/lib/tariff/dutyEngine` — no rate math is reimplemented here.
 *
 * Pure like the assembler: no DB access, no `new Date()`/`Math.random()`
 * (the caller injects `clock`), and the per-line HTS rate metadata
 * (DutyRateInput) is supplied by the caller rather than looked up here, so
 * this module stays a pure function of its inputs.
 */

import { Decimal, roundToCents } from "@/lib/tariff/decimal";
import { calculateDutyStack, calculateHMFDecimal, calculateMPFDecimal, type DutyRateInput, type TariffLineInput } from "@/lib/tariff/dutyEngine";
import type { Block, EntrySummaryDraft, EntrySummaryLine, LineFields, OtherFeeEntry } from "./model";
import type { EntrySummaryField, FieldProvenance } from "./provenance";

export class TotalsInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TotalsInvariantError";
  }
}

/** A small, documented minimal set — not the full CBP mode-of-transport code table (see U6). */
const OCEAN_MODE_VALUES = new Set(["ocean", "vessel", "sea"]);

export function isOceanMode(mode: string | null | undefined): boolean {
  if (!mode) return false;
  return OCEAN_MODE_VALUES.has(mode.trim().toLowerCase());
}

export interface DutyBindingInput {
  draft: EntrySummaryDraft;
  /** Per-draft-line-number rate metadata, from the real HTS/AD-CVD/301/232 tables. Caller-supplied so this stays pure. */
  lineDutyInputs: Record<number, DutyRateInput | undefined>;
  clock: () => Date;
}

function computedProvenance(computedFrom: string[], clock: () => Date): FieldProvenance {
  return { source: "COMPUTED", computedFrom, asOf: clock().toISOString() };
}

function computedField<T>(blockId: Block, value: T, computedFrom: string[], clock: () => Date): EntrySummaryField<T> {
  return { blockId, value, provenance: computedProvenance(computedFrom, clock) };
}

/** Verifies B40 === B37 + B38 + sum(B39 fees). Throws TotalsInvariantError on any mismatch or missing input. */
export function assertTotalsInvariant(draft: EntrySummaryDraft): void {
  const duty = draft.header.fields.B37_TOTAL_DUTY.value;
  const tax = draft.header.fields.B38_TOTAL_TAX.value;
  const otherFees = draft.header.fields.B39_TOTAL_OTHER_FEES.value;
  const total = draft.header.fields.B40_TOTAL.value;

  if (duty == null || tax == null || otherFees == null || total == null) {
    throw new TotalsInvariantError("Cannot verify the B40 total: B37, B38, B39 or B40 is not populated.");
  }

  const feeSum = otherFees.reduce((acc, fee) => acc.plus(fee.amount), new Decimal(0));
  const expected = roundToCents(duty.plus(tax).plus(feeSum));
  if (!expected.equals(total)) {
    throw new TotalsInvariantError(
      `B40 total (${total.toString()}) does not equal B37 + B38 + sum(B39) (${expected.toString()}).`
    );
  }
}

function lineToTariffInput(line: EntrySummaryLine): TariffLineInput {
  const hts = line.fields.B29A_HTSUS_NUMBER.value;
  const origin = line.fields.B10_COUNTRY_OF_ORIGIN.value;
  const enteredValue = line.fields.B32A_ENTERED_VALUE.value;
  const netQty = line.fields.B31_NET_QUANTITY.value;

  return {
    htsCode: hts ?? undefined,
    totalValue: enteredValue ? enteredValue.toNumber() : null,
    quantity: netQty ? netQty.toNumber() : 1,
    unitPrice: 0,
    countryOfOrigin: origin ?? undefined,
  };
}

/**
 * Fills B33/B34 per line and B35/B37/B38/B39/B40 on the header. Returns a new
 * draft (does not mutate the input) with the totals invariant already
 * verified — bindDutyFields never returns an inconsistent B40.
 */
export function bindDutyFields(input: DutyBindingInput): EntrySummaryDraft {
  const { draft, lineDutyInputs, clock } = input;
  const oceanMode = isOceanMode(draft.header.fields.B09_MODE_OF_TRANSPORT.value);

  let totalEnteredValue = new Decimal(0);
  let totalDuty = new Decimal(0);

  const newLines: EntrySummaryLine[] = draft.lines.map((line) => {
    const enteredValue = line.fields.B32A_ENTERED_VALUE.value ?? new Decimal(0);
    totalEnteredValue = totalEnteredValue.plus(enteredValue);

    const rateInput: DutyRateInput | undefined = lineDutyInputs[line.lineNumber];
    const stack = calculateDutyStack(lineToTariffInput(line), rateInput ?? null);
    const lineDuty = roundToCents(stack.total);
    totalDuty = totalDuty.plus(lineDuty);

    const computedFrom = ["B29A_HTSUS_NUMBER", "B10_COUNTRY_OF_ORIGIN", "B32A_ENTERED_VALUE"];

    const fields: LineFields = {
      ...line.fields,
      B33A_HTSUS_RATE: rateInput?.generalDutyRate != null
        ? computedField("B33A_HTSUS_RATE", rateInput.generalDutyRate, computedFrom, clock)
        : { blockId: "B33A_HTSUS_RATE", value: null, provenance: { source: "MISSING", asOf: clock().toISOString() } },
      B33B_ADCVD_RATE:
        rateInput?.antidumpingRate != null || rateInput?.countervailingRate != null
          ? computedField(
              "B33B_ADCVD_RATE",
              [rateInput?.antidumpingRate, rateInput?.countervailingRate].filter((v) => v != null).join("/"),
              computedFrom,
              clock
            )
          : { blockId: "B33B_ADCVD_RATE", value: null, provenance: { source: "MISSING", asOf: clock().toISOString() } },
      B33C_IRC_RATE: { blockId: "B33C_IRC_RATE", value: null, provenance: { source: "MISSING", asOf: clock().toISOString() } },
      B33D_VISA_NO: { blockId: "B33D_VISA_NO", value: null, provenance: { source: "MISSING", asOf: clock().toISOString() } },
      B34_DUTY_TAX: computedField("B34_DUTY_TAX", lineDuty, computedFrom, clock),
    };

    return { ...line, fields };
  });

  const roundedEnteredValue = roundToCents(totalEnteredValue);
  const roundedDuty = roundToCents(totalDuty);
  const tax = new Decimal(0); // no IRS excise-tax engine in scope for Phase A — an explicit computed zero, not MISSING.

  const mpf = calculateMPFDecimal(roundedEnteredValue);
  const otherFees: OtherFeeEntry[] = [{ code: "MPF", label: "Merchandise Processing Fee", amount: mpf }];
  if (oceanMode) {
    const hmf = calculateHMFDecimal(roundedEnteredValue, true);
    otherFees.push({ code: "HMF", label: "Harbor Maintenance Fee", amount: hmf });
  }
  const feeSum = otherFees.reduce((acc, fee) => acc.plus(fee.amount), new Decimal(0));
  const total = roundToCents(roundedDuty.plus(tax).plus(feeSum));

  const computedFrom = ["B32A_ENTERED_VALUE"];
  const header = {
    fields: {
      ...draft.header.fields,
      B35_TOTAL_ENTERED_VALUE: computedField("B35_TOTAL_ENTERED_VALUE", roundedEnteredValue, computedFrom, clock),
      B37_TOTAL_DUTY: computedField("B37_TOTAL_DUTY", roundedDuty, ["B34_DUTY_TAX"], clock),
      B38_TOTAL_TAX: computedField("B38_TOTAL_TAX", tax, [], clock),
      B39_TOTAL_OTHER_FEES: computedField("B39_TOTAL_OTHER_FEES", otherFees, ["B35_TOTAL_ENTERED_VALUE", "B09_MODE_OF_TRANSPORT"], clock),
      B40_TOTAL: computedField("B40_TOTAL", total, ["B37_TOTAL_DUTY", "B38_TOTAL_TAX", "B39_TOTAL_OTHER_FEES"], clock),
    },
  };

  const result: EntrySummaryDraft = { ...draft, header, lines: newLines };
  assertTotalsInvariant(result);
  return result;
}
