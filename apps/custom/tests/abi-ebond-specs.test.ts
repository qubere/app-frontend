/**
 * CATAIR eBond Create/Update (CB/CX) Chapter Scope Note & Field Specification Tests
 * Source Document: docs/plans/catair-source-docs/06-ebond-create-update-v1.9.pdf
 * (Pub # 0875-0419, April 10, 2020 - Revision 1.9 / Rev 7)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CATAIR EBOND CREATE/UPDATE CHAPTER SCOPE NOTE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Scope Overview & Architectural Pattern:
 * The eBond Create/Update interface allows electronic bond submission and management between
 * Sureties/Surety Agents/FSC and CBP in ACE via Application Identifier 'CB' (Input) and 'CX' (Output).
 * Following the mandatory backbone pattern, this chapter scopes in the complete set of 10 output/input
 * record types across single transaction bonds (STB) and continuous bonds, bond riders, adjustments,
 * voids, and terminations.
 *
 * NOTE ON INTERNAL FILLER GAPS vs TRAILING FILLERS:
 * - Record 10 (Bond Header): Contains an internal filler gap at position 54 (1S space fill) between
 *   Bond Number (pos 45-53) and Reconciliation Bond Rider Flag (pos 55), plus trailing filler at pos 57-80 (24S).
 * - Record 90 (Error/Accept Message): Contains an internal filler gap at position 8-9 (2X/2S space fill) between
 *   Condition Code (pos 5-7) and Narrative Text (pos 10-80).
 * - Records 12, 20, 30, 35, 36, 40, 45, 46 contain trailing space fill fillers ranging from 10S to 42S.
 *
 * Scoped IN (Mandatory Backbone & Core Bond Records):
 *   1. Record 10 - Bond Header Record (Input/Output, Mandatory):
 *      [Pos 1-80: 2(10) + 1(desigCode) + 1(typeCode) + 3(activityCode) + 10(amount) + 6(execDate) + 9(suretyRef) + 6(effDate) + 6(termDate) + 9(bond#) + 1(filler) + 1(reconFlag) + 1(usviFlag) + 24(filler) = 80]
 *   2. Record 12 - Secondary Notify Parties Record (Input/Output, Conditional):
 *      [Pos 1-80: 2(12) + 9(party1) + 9(party2) + 9(party3) + 9(party4) + 42(filler) = 80]
 *   3. Record 20 - Single Transaction Bond Record (Input/Output, Mandatory for STB):
 *      [Pos 1-80: 2(20) + 1(transIdType) + 2(entryType) + 40(transId) + 35(filler) = 80]
 *   4. Record 30 - Principal Record (Input/Output, Mandatory):
 *      [Pos 1-80: 2(30) + 3(idType) + 12(idNumber) + 40(name) + 23(filler) = 80]
 *   5. Record 35 - Co-principal Record (Input/Output, Conditional):
 *      [Pos 1-80: 2(35) + 3(idType) + 12(idNumber) + 40(name) + 23(filler) = 80]
 *   6. Record 36 - Bond User Record (Input/Output, Conditional):
 *      [Pos 1-80: 2(36) + 3(idType) + 12(idNumber) + 40(name) + 1(riderAction) + 6(addDate) + 6(delDate) + 10(filler) = 80]
 *   7. Record 40 - Surety Record (Input/Output, Mandatory):
 *      [Pos 1-80: 2(40) + 3(suretyCode) + 11(agentId) + 40(suretyName) + 10(liabilityAmount) + 14(filler) = 80]
 *   8. Record 45 - Co-surety Record (Input/Output, Conditional):
 *      [Pos 1-80: 2(45) + 3(coSuretyCode) + 11(agentId) + 40(coSuretyName) + 10(liabilityAmount) + 14(filler) = 80]
 *   9. Record 46 - Re-insurer Record (Input/Output, Conditional):
 *      [Pos 1-80: 2(46) + 3(reinsurerCode) + 11(agentId) + 40(suretyName) + 24(filler) = 80]
 *  10. Record 90 - Error or Accept/Reject Message Record (Output, Mandatory):
 *      [Pos 1-80: 2(90) + 1(dispType) + 1(severity) + 3(condCode) + 2(filler) + 71(narrative) = 80]
 *
 * Explicitly Deferred (Out of Scope for Codec Backbone):
 *   - Interactive eBond Query Transactions (Application Identifier: QB/QX): Deferred to query engine.
 *   - Trade Portal UI Rendering: Human GUI forms deferred to frontend presentation components.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DISCREPANCIES, CONFLICTS, AND STALENESS ANALYSIS
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Whole Dollar Currency Notation (10(S)N):
 *    - Unlike Entry Summary or Daily Statements which use 11N with implied 2 decimal places, eBond currency fields
 *      (Bond Amount, Surety Liability Amount, Co-surety Liability Amount) are specified as 10(S)N whole US dollars with no decimals.
 * 2. Rider Date Constraints:
 *    - User Add Date (Record 36, pos 59-64) must be >= Effective Date on-file.
 *    - User Delete Date (Record 36, pos 65-70) must be at least 10 days from the Effective Date on-file.
 * 3. Continuous Bond Termination Rule:
 *    - Termination Date (Record 10, pos 39-44) for continuous bonds must be at least 15 days from the Execution Date.
 * 4. Internal Filler Gap Consistency:
 *    - Record 10 pos 54 is an explicit 1S filler gap separating Bond Number (45-53) and Reconciliation Rider Flag (55).
 *    - Record 90 pos 8-9 is an explicit 2X/2S filler gap separating Condition Code (5-7) and Narrative Text (10-80).
 * Implementation notes (post-audit): Record 10's position math (including the
 * internal 1S filler at pos 54) independently re-verified against a fresh PDF
 * extraction before implementation (see docs/plans/ABI-CERTIFICATION-READINESS.md
 * history). Correctness fixes applied during implementation: money fields
 * (Bond Amount, Surety/Co-Surety Liability Amount) bound to `Decimal` (not a
 * raw JS number), matching this codebase's established money-handling
 * convention; date fields use `dateField` (`Date` objects), not raw MMDDYY
 * strings; surety codes (which can have a significant leading zero, e.g.
 * "037") preserve their string form via `numericCodeField` — the same
 * leading-zero bug found and fixed in Entry Summary Query's JI-Record.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect } from "vitest";
import {
  RECORD_10_HEADER_SPEC,
  RECORD_12_SECONDARY_NOTIFY_SPEC,
  RECORD_20_STB_SPEC,
  RECORD_30_PRINCIPAL_SPEC,
  RECORD_35_CO_PRINCIPAL_SPEC,
  RECORD_36_BOND_USER_SPEC,
  RECORD_40_SURETY_SPEC,
  RECORD_45_CO_SURETY_SPEC,
  RECORD_46_RE_INSURER_SPEC,
  RECORD_90_MESSAGE_SPEC,
} from "@/lib/abi/ebond/recordSpecs";

const ALL_EBOND_SPECS = [
  RECORD_10_HEADER_SPEC,
  RECORD_12_SECONDARY_NOTIFY_SPEC,
  RECORD_20_STB_SPEC,
  RECORD_30_PRINCIPAL_SPEC,
  RECORD_35_CO_PRINCIPAL_SPEC,
  RECORD_36_BOND_USER_SPEC,
  RECORD_40_SURETY_SPEC,
  RECORD_45_CO_SURETY_SPEC,
  RECORD_46_RE_INSURER_SPEC,
  RECORD_90_MESSAGE_SPEC,
];

describe("eBond Create/Update Record Specs — 80-Column Layout Validation", () => {
  it.each(ALL_EBOND_SPECS.map((spec) => [spec.recordType, spec]))(
    "%s has length 80 and field lengths sum to exactly 80",
    (_recordType, spec) => {
      expect(spec.length).toBe(80);
      const totalFieldLength = spec.fields.reduce((sum, f) => sum + f.length, 0);
      expect(totalFieldLength).toBe(80);
    }
  );

  it.each(ALL_EBOND_SPECS.map((spec) => [spec.recordType, spec]))(
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

describe("Record 10 Bond Header Record Spec — Field Position Math & CATAIR Class Validation", () => {
  it("matches PDF 06 p. 23-26 stated positions & classes exactly (including internal 1S filler at pos 54)", () => {
    const fields = Object.fromEntries(
      RECORD_10_HEADER_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );

    expect(fields.filler_1).toMatchObject({ start: 1, length: 2, class: "A", designation: "M", constant: "10" });
    expect(fields.bondDesignationTypeCode).toMatchObject({ start: 3, length: 1, class: "AN", designation: "M" });
    expect(fields.bondTypeCode).toMatchObject({ start: 4, length: 1, class: "N", designation: "M" });
    expect(fields.bondActivityCode).toMatchObject({ start: 5, length: 3, class: "AN", designation: "C" });
    expect(fields.bondAmount).toMatchObject({ start: 8, length: 10, class: "SN", designation: "C" });
    expect(fields.executionDate).toMatchObject({ start: 18, length: 6, class: "D", designation: "C" });
    expect(fields.suretyReferenceNumber).toMatchObject({ start: 24, length: 9, class: "X", designation: "O" });
    expect(fields.effectiveDate).toMatchObject({ start: 33, length: 6, class: "D", designation: "C" });
    expect(fields.terminationDate).toMatchObject({ start: 39, length: 6, class: "D", designation: "C" });
    expect(fields.bondNumber).toMatchObject({ start: 45, length: 9, class: "AN", designation: "C" });
    expect(fields.filler_54).toMatchObject({ start: 54, length: 1, class: "S", designation: "M" });
    expect(fields.reconciliationBondRiderFlag).toMatchObject({ start: 55, length: 1, class: "AN", designation: "C" });
    expect(fields.usviBondRiderFlag).toMatchObject({ start: 56, length: 1, class: "AN", designation: "C" });
    expect(fields.filler_57).toMatchObject({ start: 57, length: 24, class: "S", designation: "M" });
  });
});

describe("Record 12 Secondary Notify Parties Record Spec — Field Position Math & CATAIR Class Validation", () => {
  it("matches PDF 06 p. 29 stated positions & classes exactly", () => {
    const fields = Object.fromEntries(
      RECORD_12_SECONDARY_NOTIFY_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );

    expect(fields.filler_1).toMatchObject({ start: 1, length: 2, class: "A", designation: "M", constant: "12" });
    expect(fields.secondaryNotifyPartyCode1).toMatchObject({ start: 3, length: 9, class: "AN", designation: "M" });
    expect(fields.secondaryNotifyPartyCode2).toMatchObject({ start: 12, length: 9, class: "AN", designation: "O" });
    expect(fields.secondaryNotifyPartyCode3).toMatchObject({ start: 21, length: 9, class: "AN", designation: "O" });
    expect(fields.secondaryNotifyPartyCode4).toMatchObject({ start: 30, length: 9, class: "AN", designation: "O" });
    expect(fields.filler_39).toMatchObject({ start: 39, length: 42, class: "S", designation: "M" });
  });
});

describe("Record 20 Single Transaction Bond Record Spec — Field Position Math & CATAIR Class Validation", () => {
  it("matches PDF 06 p. 30-31 stated positions & classes exactly", () => {
    const fields = Object.fromEntries(
      RECORD_20_STB_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );

    expect(fields.filler_1).toMatchObject({ start: 1, length: 2, class: "A", designation: "M", constant: "20" });
    expect(fields.transactionIdTypeCode).toMatchObject({ start: 3, length: 1, class: "AN", designation: "M" });
    expect(fields.entryTypeCode).toMatchObject({ start: 4, length: 2, class: "AN", designation: "C" });
    expect(fields.transactionId).toMatchObject({ start: 6, length: 40, class: "X", designation: "M" });
    expect(fields.filler_46).toMatchObject({ start: 46, length: 35, class: "S", designation: "M" });
  });
});

describe("Record 30 Principal & Record 35 Co-principal Specs — Field Position Math & CATAIR Class Validation", () => {
  it("matches PDF 06 p. 32-33 stated positions & classes exactly", () => {
    for (const [spec, constant, idTypeKey, idNumKey, nameKey] of [
      [RECORD_30_PRINCIPAL_SPEC, "30", "principalIdNumberType", "principalIdNumber", "principalName"],
      [RECORD_35_CO_PRINCIPAL_SPEC, "35", "coPrincipalIdNumberType", "coPrincipalIdNumber", "coPrincipalName"],
    ] as const) {
      const fields = Object.fromEntries(
        spec.fields.map((f) => [f.key ?? "filler_" + f.start, f])
      );

      expect(fields.filler_1).toMatchObject({ start: 1, length: 2, class: "A", designation: "M", constant });
      expect(fields[idTypeKey]).toMatchObject({ start: 3, length: 3, class: "AN", designation: "M" });
      expect(fields[idNumKey]).toMatchObject({ start: 6, length: 12, class: "X", designation: "M" });
      expect(fields[nameKey]).toMatchObject({ start: 18, length: 40, class: "X", designation: "C" });
      expect(fields.filler_58).toMatchObject({ start: 58, length: 23, class: "S", designation: "M" });
    }
  });
});

describe("Record 36 Bond User Record Spec — Field Position Math & CATAIR Class Validation", () => {
  it("matches PDF 06 p. 34-35 stated positions & classes exactly", () => {
    const fields = Object.fromEntries(
      RECORD_36_BOND_USER_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );

    expect(fields.filler_1).toMatchObject({ start: 1, length: 2, class: "A", designation: "M", constant: "36" });
    expect(fields.bondUserIdNumberType).toMatchObject({ start: 3, length: 3, class: "AN", designation: "M" });
    expect(fields.bondUserIdNumber).toMatchObject({ start: 6, length: 12, class: "X", designation: "M" });
    expect(fields.bondUserName).toMatchObject({ start: 18, length: 40, class: "X", designation: "C" });
    expect(fields.userRiderActionCode).toMatchObject({ start: 58, length: 1, class: "AN", designation: "C" });
    expect(fields.userAddDate).toMatchObject({ start: 59, length: 6, class: "D", designation: "C" });
    expect(fields.userDeleteDate).toMatchObject({ start: 65, length: 6, class: "D", designation: "C" });
    expect(fields.filler_71).toMatchObject({ start: 71, length: 10, class: "S", designation: "M" });
  });
});

describe("Record 40 Surety, Record 45 Co-surety & Record 46 Re-insurer Specs — Field Position Math & CATAIR Class Validation", () => {
  it("matches PDF 06 p. 36-38 stated positions & classes exactly", () => {
    // Record 40
    const fields40 = Object.fromEntries(
      RECORD_40_SURETY_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );
    expect(fields40.suretyCode).toMatchObject({ start: 3, length: 3, class: "N", designation: "M" });
    expect(fields40.agentIdNumber).toMatchObject({ start: 6, length: 11, class: "X", designation: "M" });
    expect(fields40.suretyName).toMatchObject({ start: 17, length: 40, class: "X", designation: "C" });
    expect(fields40.suretyLiabilityAmount).toMatchObject({ start: 57, length: 10, class: "SN", designation: "C" });
    expect(fields40.filler_67).toMatchObject({ start: 67, length: 14, class: "S", designation: "M" });

    // Record 45
    const fields45 = Object.fromEntries(
      RECORD_45_CO_SURETY_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );
    expect(fields45.coSuretyCode).toMatchObject({ start: 3, length: 3, class: "N", designation: "M" });
    expect(fields45.agentIdNumber).toMatchObject({ start: 6, length: 11, class: "X", designation: "M" });
    expect(fields45.coSuretyName).toMatchObject({ start: 17, length: 40, class: "X", designation: "C" });
    expect(fields45.coSuretyLiabilityAmount).toMatchObject({ start: 57, length: 10, class: "SN", designation: "M" });
    expect(fields45.filler_67).toMatchObject({ start: 67, length: 14, class: "S", designation: "M" });

    // Record 46
    const fields46 = Object.fromEntries(
      RECORD_46_RE_INSURER_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );
    expect(fields46.suretyCodeForReinsurer).toMatchObject({ start: 3, length: 3, class: "N", designation: "M" });
    expect(fields46.agentIdNumber).toMatchObject({ start: 6, length: 11, class: "X", designation: "M" });
    expect(fields46.suretyName).toMatchObject({ start: 17, length: 40, class: "X", designation: "C" });
    expect(fields46.filler_57).toMatchObject({ start: 57, length: 24, class: "S", designation: "M" });
  });
});

describe("Record 90 Error or Accept/Reject Message Record Spec — Field Position Math & CATAIR Class Validation", () => {
  it("matches PDF 06 p. 39 stated positions & classes exactly (including internal 2S filler at pos 8-9)", () => {
    const fields = Object.fromEntries(
      RECORD_90_MESSAGE_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );

    expect(fields.filler_1).toMatchObject({ start: 1, length: 2, class: "A", designation: "M", constant: "90" });
    expect(fields.dispositionTypeCode).toMatchObject({ start: 3, length: 1, class: "AN", designation: "M" });
    expect(fields.severityCode).toMatchObject({ start: 4, length: 1, class: "AN", designation: "M" });
    expect(fields.conditionCode).toMatchObject({ start: 5, length: 3, class: "AN", designation: "M" });
    expect(fields.filler_8).toMatchObject({ start: 8, length: 2, class: "S", designation: "M" });
    expect(fields.narrativeText).toMatchObject({ start: 10, length: 71, class: "X", designation: "M" });
  });
});
