/**
 * CATAIR Statement Processing (Daily & Periodic Monthly Statements) Scope Note & Record Specification Tests
 * Source Documents:
 *   1. docs/plans/catair-source-docs/05-daily-statement.pdf (Pub # 0875-0419, April 23, 2025 - Revision 15)
 *   2. docs/plans/catair-source-docs/05b-periodic-monthly-statement.pdf (Pub # 0875-0419, March 6, 2019 / 2020 - Revision 7)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STATEMENT PROCESSING CATAIR CHAPTER SCOPE NOTE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Scope Overview & Architectural Pattern:
 * Following the "mandatory backbone first, defer conditional detail" pattern, this chapter scopes in
 * the complete set of 10 output record types across both Daily Statement (Application Identifier: PF)
 * and Periodic Monthly Statement (Application Identifier: MS) flows.
 *
 * NOTE ON INTERNAL FILLER GAPS vs TRAILING FILLERS:
 * Unlike simple flat structures, real CATAIR records contain specific internal filler gaps (1-11 chars wide)
 * interspersed between field pairs (e.g. 2S fillers after Filer Code & Entry Number for future expansion,
 * 11S filler in Q2, 4S filler in Q2). The position math below explicitly details both internal filler gaps
 * and trailing fillers:
 *
 * Scoped IN (Mandatory Backbone & Primary Details):
 *   1. Q1 - Statement Detail Line 1 (Output, Mandatory):
 *      - Daily Statement: Entry Summary Detail
 *        [Pos 1-80: 2(Q1) + 4(port) + 3(filer) + 2(filler) + 8(entry#) + 2(filler) + 12(importer#) + 6(date) + 11(duty) + 11(tax) + 1(defTax) + 9(ref#) + 1(consInd) + 2(branch) + 3(filler) + 2(entryType) + 1(filler) = 80]
 *      - Periodic Monthly Statement: Periodic Daily Statements Listed on PMS
 *        [Pos 1-80: 2(Q1) + 10(pds#) + 4(port) + 3(filer) + 12(importer#) + 6(printDate) + 6(presDate) + 11(duty) + 11(tax) + 15(filler) = 80]
 *   2. Q2 - Statement Detail Line 2 (Output, Mandatory):
 *      - Daily Statement: Entry Summary Detail Continued
 *        [Pos 1-80: 2(Q2) + 4(port) + 3(filer) + 2(filler) + 8(entry#) + 1(filler) + 11(add) + 11(cvd) + 11(filler) + 1(payType) + 1(payInd) + 1(cvdInd) + 1(addInd) + 4(filler) + 3(team#) + 8(reconInt) + 8(filler) = 80]
 *      - Periodic Monthly Statement: Periodic Daily Statement Totals
 *        [Pos 1-80: 2(Q2) + 11(add) + 11(cvd) + 11(totalDue) + 45(filler) = 80]
 *   3. QA - Statement Detail Fees (Output, Conditional, Repeats up to 5 times per detail):
 *      - Sequence counter (01..), 5 pairs of (3AN Fee Class Code + 11N Fee Amount).
 *        [Pos 1-80: 2(QA) + 2(seq#) + (3+11)*5(feePairs) + 6(filler) = 80]
 *   4. Q3 - Preliminary Statement Totals Line 1 (Output, Mandatory in Preliminary Grouping):
 *      - Daily Statement: Daily Statement # (DDFYJJJXXX), Print Date, Filer, Importer #, Duty, Tax, Deferred Tax, Processing Port.
 *        [Pos 1-80: 2(Q3) + 10(stmt#) + 2(filler) + 6(printDate) + 3(filer) + 2(filler) + 12(importer#) + 11(duty) + 11(tax) + 11(defTax) + 4(procPort) + 6(filler) = 80]
 *      - Periodic Monthly Statement: PMS # (DDCYPMMXXX), Print Date, DUE DATE (MMDDYY), Filer, Importer #, Duty, Tax.
 *        [Pos 1-80: 2(Q3) + 10(pms#) + 6(printDate) + 6(dueDate) + 3(filer) + 12(importer#) + 11(duty) + 11(tax) + 19(filler) = 80]
 *   5. Q4 - Preliminary Statement Totals Line 2 (Output, Mandatory in Preliminary Grouping):
 *      - Daily Statement: ADD, CVD, Total Amount Due, Recon Interest, Revenue Entries Count, Non-Revenue Entries Count.
 *        [Pos 1-80: 2(Q4) + 11(add) + 11(cvd) + 11(totalDue) + 11(reconInt) + 5(revCount) + 5(nonRevCount) + 24(filler) = 80]
 *      - Periodic Monthly Statement: ADD, CVD, Total Amount Due, Space Fill (45S).
 *        [Pos 1-80: 2(Q4) + 11(add) + 11(cvd) + 11(totalDue) + 45(filler) = 80]
 *   6. QE - Preliminary Statement Total Fees (Output, Conditional, Repeats up to 5 times):
 *      - Fee class codes and preliminary fee amounts. Identical field layout to QA.
 *        [Pos 1-80: 2(QE) + 2(seq#) + (3+11)*5(feePairs) + 6(filler) = 80]
 *   7. Q5 - Final Paid Statement Totals Line 1 (Output, Mandatory in Final Grouping):
 *      - Identical field layout to Q3 (contains paid duty & tax amounts upon ACH receipt/acceptance).
 *        [Daily Pos 1-80: 2(Q5)+10(stmt#)+2(filler)+6(date)+3(filer)+2(filler)+12(importer#)+11(duty)+11(tax)+11(defTax)+4(port)+6(filler) = 80]
 *        [PMS Pos 1-80: 2(Q5)+10(pms#)+6(printDate)+6(dueDate)+3(filer)+12(importer#)+11(duty)+11(tax)+19(filler) = 80]
 *   8. Q6 - Final Paid Statement Totals Line 2 (Output, Mandatory in Final Grouping):
 *      - Identical field layout to Q4 (contains Total Amount Paid).
 *        [Daily Pos 1-80: 2(Q6)+11(add)+11(cvd)+11(totalPaid)+11(reconInt)+5(revCount)+5(nonRevCount)+24(filler) = 80]
 *        [PMS Pos 1-80: 2(Q6)+11(add)+11(cvd)+11(totalPaid)+45(filler) = 80]
 *   9. QJ - Final Paid Statement Total Fees (Output, Conditional, Repeats up to 5 times):
 *      - Fee class codes and paid fee amounts. Identical field layout to QE / QA.
 *        [Pos 1-80: 2(QJ) + 2(seq#) + (3+11)*5(feePairs) + 6(filler) = 80]
 *  10. Q7 - Entry Summaries Deleted (Output, Conditional, Repeats up to 2,000 in Daily / 9,999 in PMS):
 *      - Acknowledges entry summaries deleted from statement; contains up to 4 entry delete units per record with internal 2S fillers after each filer code.
 *        [Pos 1-80: 2(Q7) + 10(stmt#) + [3(filer) + 2(filler) + 8(entry#) + 3(delSrc)]*4 + 4(filler) = 80]
 *
 * Explicitly Deferred (Out of Scope for Codec Backbone):
 *   - ABI Statement Update / Delete Transactions (Application Identifier: SU): Filer-initiated statement reschedule/delete inputs; deferred to interactive filing module.
 *   - ACH Payment Authorization Transactions (Application Identifier: RM / PN): ACH Debit authorization messages sent by filers; deferred to banking/payment gateway engine.
 *   - Outstanding Action ES Query Response Grouping: Query response wrapper blocks; deferred to ES query integration.
 *   - Print Report Layout Rendering (Figures 1-4 printed reports): Text/PDF report formatting for human viewing; deferred to UI reporting layer.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DISCREPANCIES, CONFLICTS, AND STALENESS ANALYSIS (2020 PMS vs 2025 Daily)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. Document Revision & Currency Gap:
 *    - 05-daily-statement.pdf is dated April 23, 2025 (Pub # 0875-0419, Revision 15).
 *    - 05b-periodic-monthly-statement.pdf is dated March 6, 2019 / 2020 (Pub # 0875-0419, Revision 7).
 *    - The 2020 PMS document is stale relative to modern ACE enhancements. Where modern rules (e.g. 2,000 de minimis delete limit,
 *      10-digit dollar amounts rule, standard date formatting) apply, the 2025 Daily specification represents current ACE behavior.
 *
 * 2. Structural Divergence between Daily (PF) vs Periodic (MS) Record Types:
 *    - Q1 Record: Daily Q1 represents an Entry Summary detail line (Port, Entry #, Importer #, Print Date, Duty, Tax, Deferred Tax, Entry Type).
 *      Periodic Q1 represents a Periodic Daily Statement listed on the PMS (Statement #, Port, Filer, Importer #, Print Date, Presentation Date, Duty, Tax).
 *    - Q2 Record: Daily Q2 is Entry Summary detail continuation (ADD, CVD, Payment Type Indicator 2-8, Pay/CVD/ADD Indicators, Team #, Recon Interest).
 *      Periodic Q2 is Periodic Daily Statement Totals (ADD, CVD, Total Amount Due).
 *    - Q3/Q5 Records: Daily Q3/Q5 contains Daily Statement Print Date, Processing Port, Deferred Tax, and 2-space fillers (10-11, 24-25).
 *      Periodic Q3/Q5 contains PMS Print Date AND PMS DUE DATE (pos 19-24), with no port or deferred tax fields.
 *    - Q4/Q6 Records: Daily Q4/Q6 contains Recon Interest (36-46), Revenue Entries count (47-51), Non-Revenue Entries count (52-56).
 *      Periodic Q4/Q6 has space fill (45S) for positions 36-80.
 *
 * 3. Statement Number Format Discrepancy:
 *    - Daily Statement Number format: DDFYJJJXXX (DD=District, FY=Fiscal Year, JJJ=Julian Day, XXX=Sequence Number).
 *    - Periodic Monthly Statement Number format: DDCYPMMXXX (DD=District, CY=Calendar Year, P='P' constant, MM=Month, XXX=Sequence Number).
 *
 * 4. Stale Reference Tables & Fee Class Codes:
 *    - 2020 PMS doc references legacy "Appendix B" fee codes and "SU (Statement Delete)".
 *    - 2025 Daily doc references "AE Table 6, User Fee Accounting Class Codes", "SU (Statement Update)", and includes newer fees
 *      such as Pecan and Christmas Tree fees (Rev 14, Sept 2023) and Softwood Lumber fee (Rev 13, March 2020).
 *    - 2025 Daily doc explicitly notes Puerto Rican Coffee Duty is reported in Estimated Duty Amount fields (Rev 8, April 2018).
 *
 * 5. 10-Digit Dollar Amount Limit (Note 1 in 2025 Daily doc):
 *    - Although CATAIR field lengths are 11N (for future expansion), ACE currently supports a max of 10-digit dollar amounts.
 *    - The first digit of all 11N currency fields will always be '0' in actual transmissions.
 *
 * Implementation notes (post-audit): position math independently re-verified
 * against the raw PDF for QA-QJ and Q3-Q6 (see docs/plans/ABI-CERTIFICATION-READINESS.md
 * history). Correctness fixes applied during implementation: every duty/tax/fee
 * amount field's own PDF text says "Two decimal places are implied" — bound to
 * `Decimal` (not a raw JS number) via `impliedDecimalField`, matching this
 * codebase's established money-handling convention. Date fields (print dates,
 * due dates, presentation dates) use `dateField` (`Date` objects), not raw
 * MMDDYY strings, consistent with every other chapter. Code-like fields where
 * a leading zero is significant (district/port, entry type, sequence number,
 * fee class codes) use `numericCodeField` — the same leading-zero bug found
 * and fixed in Entry Summary Query's JF-Record and Entry Summary Create/Update's
 * 89-Record.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect } from "vitest";
import {
  Q1_DAILY_SPEC,
  Q2_DAILY_SPEC,
  QA_STATEMENT_FEE_SPEC,
  Q3_DAILY_SPEC,
  Q4_DAILY_SPEC,
  QE_STATEMENT_FEE_SPEC,
  Q5_DAILY_SPEC,
  Q6_DAILY_SPEC,
  QJ_STATEMENT_FEE_SPEC,
  Q7_STATEMENT_DELETED_SPEC,
  Q1_PERIODIC_SPEC,
  Q2_PERIODIC_SPEC,
  Q3_PERIODIC_SPEC,
  Q4_PERIODIC_SPEC,
  Q5_PERIODIC_SPEC,
  Q6_PERIODIC_SPEC,
} from "@/lib/abi/statement/recordSpecs";

const ALL_DAILY_SPECS = [
  Q1_DAILY_SPEC,
  Q2_DAILY_SPEC,
  QA_STATEMENT_FEE_SPEC,
  Q3_DAILY_SPEC,
  Q4_DAILY_SPEC,
  QE_STATEMENT_FEE_SPEC,
  Q5_DAILY_SPEC,
  Q6_DAILY_SPEC,
  QJ_STATEMENT_FEE_SPEC,
  Q7_STATEMENT_DELETED_SPEC,
];

const ALL_PERIODIC_SPECS = [
  Q1_PERIODIC_SPEC,
  Q2_PERIODIC_SPEC,
  QA_STATEMENT_FEE_SPEC,
  Q3_PERIODIC_SPEC,
  Q4_PERIODIC_SPEC,
  QE_STATEMENT_FEE_SPEC,
  Q5_PERIODIC_SPEC,
  Q6_PERIODIC_SPEC,
  QJ_STATEMENT_FEE_SPEC,
  Q7_STATEMENT_DELETED_SPEC,
];

const ALL_STATEMENT_SPECS = [...ALL_DAILY_SPECS, Q1_PERIODIC_SPEC, Q2_PERIODIC_SPEC, Q3_PERIODIC_SPEC, Q4_PERIODIC_SPEC, Q5_PERIODIC_SPEC, Q6_PERIODIC_SPEC];

describe("Statement Processing Record Specs — 80-Column Layout Validation", () => {
  it.each(ALL_STATEMENT_SPECS.map((spec) => [spec.recordType, spec]))(
    "%s has length 80 and field lengths sum to exactly 80",
    (_recordType, spec) => {
      expect(spec.length).toBe(80);
      const totalFieldLength = spec.fields.reduce((sum, f) => sum + f.length, 0);
      expect(totalFieldLength).toBe(80);
    }
  );

  it.each(ALL_STATEMENT_SPECS.map((spec) => [spec.recordType, spec]))(
    "%s has contiguous 1-indexed field position ranges",
    (_recordType, spec) => {
      let expectedStart = 1;
      for (const field of spec.fields) {
        expect(field.start).toBe(expectedStart);
        expectedStart += field.length;
      }
      expect(expectedStart - 1).toBe(80);
    }
  );
});

describe("Daily Statement Q1 Record Spec — Field Position Math", () => {
  it("matches PDF 05 p. 10-11 stated positions exactly (including internal 2S fillers at 10-11, 20-21, 75-77, 80)", () => {
    const fields = Object.fromEntries(
      Q1_DAILY_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );

    expect(fields.districtPortOfEntrySummary).toMatchObject({ start: 3, length: 4, class: "N", designation: "M" });
    expect(fields.entryFilerCode).toMatchObject({ start: 7, length: 3, class: "AN", designation: "M" });
    expect(fields.filler_10).toMatchObject({ start: 10, length: 2, class: "S", designation: "M" });
    expect(fields.entryNumber).toMatchObject({ start: 12, length: 8, class: "AN", designation: "M" });
    expect(fields.filler_20).toMatchObject({ start: 20, length: 2, class: "S", designation: "M" });
    expect(fields.importerOfRecordNumber).toMatchObject({ start: 22, length: 12, class: "X", designation: "C" });
    expect(fields.preliminaryDailyStatementPrintDate).toMatchObject({ start: 34, length: 6, class: "D", designation: "M" });
    expect(fields.estimatedDutyAmount).toMatchObject({ start: 40, length: 11, class: "SN", designation: "C" });
    expect(fields.estimatedTaxAmount).toMatchObject({ start: 51, length: 11, class: "SN", designation: "C" });
    expect(fields.deferredTaxIndicator).toMatchObject({ start: 62, length: 1, class: "A", designation: "C" });
    expect(fields.brokerReferenceNumber).toMatchObject({ start: 63, length: 9, class: "X", designation: "C" });
    expect(fields.consolidatedIndicator).toMatchObject({ start: 72, length: 1, class: "A", designation: "C" });
    expect(fields.clientBranchDesignation).toMatchObject({ start: 73, length: 2, class: "AN", designation: "C" });
    expect(fields.filler_75).toMatchObject({ start: 75, length: 3, class: "S", designation: "M" });
    expect(fields.entryType).toMatchObject({ start: 78, length: 2, class: "N", designation: "M" });
    expect(fields.filler_80).toMatchObject({ start: 80, length: 1, class: "S", designation: "M" });
  });
});

describe("Daily Statement Q2 Record Spec — Field Position Math", () => {
  it("matches PDF 05 p. 13-14 stated positions exactly (including internal fillers at 10-11, 20, 43-53, 58-61, 73-80)", () => {
    const fields = Object.fromEntries(
      Q2_DAILY_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );

    expect(fields.districtPortOfEntrySummary).toMatchObject({ start: 3, length: 4, class: "N", designation: "M" });
    expect(fields.entryFilerCode).toMatchObject({ start: 7, length: 3, class: "AN", designation: "M" });
    expect(fields.filler_10).toMatchObject({ start: 10, length: 2, class: "S", designation: "M" });
    expect(fields.entryNumber).toMatchObject({ start: 12, length: 8, class: "AN", designation: "M" });
    expect(fields.filler_20).toMatchObject({ start: 20, length: 1, class: "S", designation: "M" });
    expect(fields.antidumpingDutyAmount).toMatchObject({ start: 21, length: 11, class: "SN", designation: "C" });
    expect(fields.countervailingDutyAmount).toMatchObject({ start: 32, length: 11, class: "SN", designation: "C" });
    expect(fields.filler_43).toMatchObject({ start: 43, length: 11, class: "S", designation: "M" });
    expect(fields.paymentTypeIndicator).toMatchObject({ start: 54, length: 1, class: "N", designation: "M" });
    expect(fields.payIndicator).toMatchObject({ start: 55, length: 1, class: "A", designation: "C" });
    expect(fields.countervailingIndicator).toMatchObject({ start: 56, length: 1, class: "A", designation: "C" });
    expect(fields.antidumpingIndicator).toMatchObject({ start: 57, length: 1, class: "A", designation: "C" });
    expect(fields.filler_58).toMatchObject({ start: 58, length: 4, class: "S", designation: "M" });
    expect(fields.teamNumber).toMatchObject({ start: 62, length: 3, class: "AN", designation: "C" });
    expect(fields.interestAmountForReconciliationSummary).toMatchObject({ start: 65, length: 8, class: "SN", designation: "C" });
    expect(fields.filler_73).toMatchObject({ start: 73, length: 8, class: "S", designation: "M" });
  });
});

describe("QA, QE, QJ Fee Record Specs — Field Position Math & CATAIR Class Validation", () => {
  it("matches PDF 05 p. 15-16, 20-21, 26-27 / PDF 05b p. 9-10, 13-14, 17-18 stated positions & classes exactly", () => {
    for (const [spec, constant] of [
      [QA_STATEMENT_FEE_SPEC, "QA"],
      [QE_STATEMENT_FEE_SPEC, "QE"],
      [QJ_STATEMENT_FEE_SPEC, "QJ"],
    ] as const) {
      const fields = Object.fromEntries(
        spec.fields.map((f) => [f.key ?? "filler_" + f.start, f])
      );

      expect(fields.filler_1).toMatchObject({ start: 1, length: 2, class: "A", designation: "M", constant });
      expect(fields.sequenceNumber).toMatchObject({ start: 3, length: 2, class: "N", designation: "M" });
      expect(fields.firstFeeClassCode).toMatchObject({ start: 5, length: 3, class: "N", designation: "C" });
      expect(fields.firstFeeAmount).toMatchObject({ start: 8, length: 11, class: "SN", designation: "C" });
      expect(fields.secondFeeClassCode).toMatchObject({ start: 19, length: 3, class: "N", designation: "C" });
      expect(fields.secondFeeAmount).toMatchObject({ start: 22, length: 11, class: "SN", designation: "C" });
      expect(fields.thirdFeeClassCode).toMatchObject({ start: 33, length: 3, class: "N", designation: "C" });
      expect(fields.thirdFeeAmount).toMatchObject({ start: 36, length: 11, class: "SN", designation: "C" });
      expect(fields.fourthFeeClassCode).toMatchObject({ start: 47, length: 3, class: "N", designation: "C" });
      expect(fields.fourthFeeAmount).toMatchObject({ start: 50, length: 11, class: "SN", designation: "C" });
      expect(fields.fifthFeeClassCode).toMatchObject({ start: 61, length: 3, class: "N", designation: "C" });
      expect(fields.fifthFeeAmount).toMatchObject({ start: 64, length: 11, class: "SN", designation: "C" });
      expect(fields.filler_75).toMatchObject({ start: 75, length: 6, class: "S", designation: "M" });
    }
  });
});

describe("Daily Statement Q3 & Q5 Record Specs — Field Position Math & CATAIR Class Validation", () => {
  it("matches PDF 05 p. 17-18 / p. 22-23 stated positions & classes exactly (including internal 2S fillers at 13-14, 24-25 and print date class 6D)", () => {
    for (const [spec, constant] of [
      [Q3_DAILY_SPEC, "Q3"],
      [Q5_DAILY_SPEC, "Q5"],
    ] as const) {
      const fields = Object.fromEntries(
        spec.fields.map((f) => [f.key ?? "filler_" + f.start, f])
      );

      expect(fields.filler_1).toMatchObject({ start: 1, length: 2, class: "A", designation: "M", constant });
      expect(fields.dailyStatementNumber).toMatchObject({ start: 3, length: 10, class: "AN", designation: "M" });
      expect(fields.filler_13).toMatchObject({ start: 13, length: 2, class: "S", designation: "M" });
      expect(fields.dailyStatementPrintDate).toMatchObject({ start: 15, length: 6, class: "D", designation: "M" });
      expect(fields.entryFilerCode).toMatchObject({ start: 21, length: 3, class: "AN", designation: "M" });
      expect(fields.filler_24).toMatchObject({ start: 24, length: 2, class: "S", designation: "M" });
      expect(fields.importerOfRecordNumber).toMatchObject({ start: 26, length: 12, class: "X", designation: "C" });
      expect(fields.totalEstimatedDuty).toMatchObject({ start: 38, length: 11, class: "SN", designation: "C" });
      expect(fields.totalEstimatedTax).toMatchObject({ start: 49, length: 11, class: "SN", designation: "C" });
      expect(fields.totalDeferredTax).toMatchObject({ start: 60, length: 11, class: "SN", designation: "C" });
      expect(fields.districtPortWhichProcessesEntries).toMatchObject({ start: 71, length: 4, class: "N", designation: "M" });
      expect(fields.filler_75).toMatchObject({ start: 75, length: 6, class: "S", designation: "M" });
    }
  });
});

describe("Daily Statement Q4 & Q6 Record Specs — Field Position Math & CATAIR Class Validation", () => {
  it("matches PDF 05 p. 19-20 / p. 24 stated positions & classes exactly", () => {
    for (const [spec, constant, amountKey] of [
      [Q4_DAILY_SPEC, "Q4", "totalAmountDue"],
      [Q6_DAILY_SPEC, "Q6", "totalAmountPaid"],
    ] as const) {
      const fields = Object.fromEntries(
        spec.fields.map((f) => [f.key ?? "filler_" + f.start, f])
      );

      expect(fields.filler_1).toMatchObject({ start: 1, length: 2, class: "A", designation: "M", constant });
      expect(fields.totalAntidumpingDuty).toMatchObject({ start: 3, length: 11, class: "SN", designation: "C" });
      expect(fields.totalCountervailingDuty).toMatchObject({ start: 14, length: 11, class: "SN", designation: "C" });
      expect(fields[amountKey]).toMatchObject({ start: 25, length: 11, class: "SN", designation: "C" });
      expect(fields.totalInterestAmountForReconciliationSummary).toMatchObject({ start: 36, length: 11, class: "SN", designation: "C" });
      expect(fields.totalNumberRevenueProducingEntries).toMatchObject({ start: 47, length: 5, class: "N", designation: "M" });
      expect(fields.totalNumberNonRevenueProducingEntries).toMatchObject({ start: 52, length: 5, class: "N", designation: "M" });
      expect(fields.filler_57).toMatchObject({ start: 57, length: 24, class: "S", designation: "M" });
    }
  });
});

describe("Q7 Deleted Entries Record Spec — Field Position Math & CATAIR Class Validation", () => {
  it("matches PDF 05 p. 28-30 / PDF 05b p. 19-20 stated positions & classes exactly (including internal 2S fillers at 16-17, 32-33, 48-49, 64-65)", () => {
    const fields = Object.fromEntries(
      Q7_STATEMENT_DELETED_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );

    expect(fields.statementNumber).toMatchObject({ start: 3, length: 10, class: "AN", designation: "M" });
    expect(fields.entryFilerCode1).toMatchObject({ start: 13, length: 3, class: "AN", designation: "M" });
    expect(fields.filler_16).toMatchObject({ start: 16, length: 2, class: "S", designation: "M" });
    expect(fields.entryNumber1).toMatchObject({ start: 18, length: 8, class: "AN", designation: "M" });
    expect(fields.deleteSource1).toMatchObject({ start: 26, length: 3, class: "AN", designation: "M" });
    expect(fields.entryFilerCode2).toMatchObject({ start: 29, length: 3, class: "AN", designation: "C" });
    expect(fields.filler_32).toMatchObject({ start: 32, length: 2, class: "S", designation: "M" });
    expect(fields.entryNumber2).toMatchObject({ start: 34, length: 8, class: "AN", designation: "C" });
    expect(fields.deleteSource2).toMatchObject({ start: 42, length: 3, class: "AN", designation: "C" });
    expect(fields.entryFilerCode3).toMatchObject({ start: 45, length: 3, class: "AN", designation: "C" });
    expect(fields.filler_48).toMatchObject({ start: 48, length: 2, class: "S", designation: "M" });
    expect(fields.entryNumber3).toMatchObject({ start: 50, length: 8, class: "AN", designation: "C" });
    expect(fields.deleteSource3).toMatchObject({ start: 58, length: 3, class: "AN", designation: "C" });
    expect(fields.entryFilerCode4).toMatchObject({ start: 61, length: 3, class: "AN", designation: "C" });
    expect(fields.filler_64).toMatchObject({ start: 64, length: 2, class: "S", designation: "M" });
    expect(fields.entryNumber4).toMatchObject({ start: 66, length: 8, class: "AN", designation: "C" });
    expect(fields.deleteSource4).toMatchObject({ start: 74, length: 3, class: "AN", designation: "C" });
    expect(fields.filler_77).toMatchObject({ start: 77, length: 4, class: "S", designation: "M" });
  });
});

describe("Periodic Monthly Statement Q1 Record Spec — Field Position Math & CATAIR Class Validation", () => {
  it("matches PDF 05b p. 7 stated positions & classes exactly (including date classes 6N)", () => {
    const fields = Object.fromEntries(
      Q1_PERIODIC_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );

    expect(fields.periodicDailyStatementNumber).toMatchObject({ start: 3, length: 10, class: "AN", designation: "M" });
    expect(fields.periodicDailyStatementDistrictPort).toMatchObject({ start: 13, length: 4, class: "N", designation: "M" });
    expect(fields.periodicDailyStatementFilerCode).toMatchObject({ start: 17, length: 3, class: "AN", designation: "M" });
    expect(fields.periodicDailyStatementImporterNumber).toMatchObject({ start: 20, length: 12, class: "X", designation: "C" });
    expect(fields.preliminaryPeriodicDailyStatementPrintDate).toMatchObject({ start: 32, length: 6, class: "D", designation: "M" });
    expect(fields.entrySummaryPresentationDate).toMatchObject({ start: 38, length: 6, class: "D", designation: "M" });
    expect(fields.totalDuty).toMatchObject({ start: 44, length: 11, class: "SN", designation: "C" });
    expect(fields.totalTax).toMatchObject({ start: 55, length: 11, class: "SN", designation: "C" });
    expect(fields.filler_66).toMatchObject({ start: 66, length: 15, class: "S", designation: "M" });
  });
});

describe("Periodic Monthly Statement Q2, Q4, Q6 Record Specs — Field Position Math & CATAIR Class Validation", () => {
  it("matches PDF 05b p. 8, 12, 16 stated positions & classes exactly", () => {
    for (const [spec, constant, amountKey] of [
      [Q2_PERIODIC_SPEC, "Q2", "totalAmountDue"],
      [Q4_PERIODIC_SPEC, "Q4", "totalAmountDue"],
      [Q6_PERIODIC_SPEC, "Q6", "totalAmountPaid"],
    ] as const) {
      const fields = Object.fromEntries(
        spec.fields.map((f) => [f.key ?? "filler_" + f.start, f])
      );

      expect(fields.filler_1).toMatchObject({ start: 1, length: 2, class: "A", designation: "M", constant });
      expect(fields.totalAntidumpingDuty).toMatchObject({ start: 3, length: 11, class: "SN", designation: "C" });
      expect(fields.totalCountervailingDuty).toMatchObject({ start: 14, length: 11, class: "SN", designation: "C" });
      expect(fields[amountKey]).toMatchObject({ start: 25, length: 11, class: "SN", designation: "C" });
      expect(fields.filler_36).toMatchObject({ start: 36, length: 45, class: "S", designation: "M" });
    }
  });
});

describe("Periodic Monthly Statement Q3 & Q5 Record Specs — Field Position Math & CATAIR Class Validation", () => {
  it("matches PDF 05b p. 11 & p. 15 stated positions & classes exactly (including Due Date in pos 19-24 and date classes 6N)", () => {
    for (const [spec, constant] of [
      [Q3_PERIODIC_SPEC, "Q3"],
      [Q5_PERIODIC_SPEC, "Q5"],
    ] as const) {
      const fields = Object.fromEntries(
        spec.fields.map((f) => [f.key ?? "filler_" + f.start, f])
      );

      expect(fields.filler_1).toMatchObject({ start: 1, length: 2, class: "A", designation: "M", constant });
      expect(fields.periodicMonthlyStatementNumber).toMatchObject({ start: 3, length: 10, class: "AN", designation: "M" });
      expect(fields.periodicMonthlyStatementPrintDate).toMatchObject({ start: 13, length: 6, class: "D", designation: "M" });
      expect(fields.periodicMonthlyStatementDueDate).toMatchObject({ start: 19, length: 6, class: "D", designation: "M" });
      expect(fields.periodicMonthlyStatementFilerCode).toMatchObject({ start: 25, length: 3, class: "AN", designation: "M" });
      expect(fields.periodicMonthlyStatementImporterNumber).toMatchObject({ start: 28, length: 12, class: "X", designation: "C" });
      expect(fields.totalDuty).toMatchObject({ start: 40, length: 11, class: "SN", designation: "C" });
      expect(fields.totalTax).toMatchObject({ start: 51, length: 11, class: "SN", designation: "C" });
      expect(fields.filler_62).toMatchObject({ start: 62, length: 19, class: "S", designation: "M" });
    }
  });
});

