import { decodeRecord, splitFixedWidthLines, AbiFixedWidthError } from "@/lib/abi/fixedWidth";
import {
  Q1_PERIODIC_SPEC,
  Q2_PERIODIC_SPEC,
  QA_STATEMENT_FEE_SPEC,
  Q3_PERIODIC_SPEC,
  Q4_PERIODIC_SPEC,
  QE_STATEMENT_FEE_SPEC,
  Q5_PERIODIC_SPEC,
  Q6_PERIODIC_SPEC,
  QJ_STATEMENT_FEE_SPEC,
} from "./recordSpecs";
import { classifyStatementLine } from "./parse";
import type {
  Q1PeriodicInput,
  Q2PeriodicInput,
  StatementFeeInput,
  Q3PeriodicInput,
  Q4PeriodicInput,
  Q5PeriodicInput,
  Q6PeriodicInput,
  Q7DeletedInput,
  PeriodicDailyStatementDetailGroup,
  PreliminaryOrFinalPeriodicPaymentGroup,
  FinalPeriodicStatementPaymentGroup,
  ParsedPeriodicStatementResponse,
  PeriodicStatementParseOptions,
} from "./types";

import { decodeQ7Deleted } from "./parseDailyStatement";

export function decodeQ1Periodic(line: string): Q1PeriodicInput {
  return decodeRecord(Q1_PERIODIC_SPEC, line);
}

export function decodeQ2Periodic(line: string): Q2PeriodicInput {
  return decodeRecord(Q2_PERIODIC_SPEC, line);
}

export function decodeQAPeriodicFee(line: string): StatementFeeInput {
  return decodeRecord(QA_STATEMENT_FEE_SPEC, line);
}

export function decodeQ3Periodic(line: string): Q3PeriodicInput {
  return decodeRecord(Q3_PERIODIC_SPEC, line);
}

export function decodeQ4Periodic(line: string): Q4PeriodicInput {
  return decodeRecord(Q4_PERIODIC_SPEC, line);
}

export function decodeQEPeriodicFeeTotal(line: string): StatementFeeInput {
  return decodeRecord(QE_STATEMENT_FEE_SPEC, line);
}

export function decodeQ5Periodic(line: string): Q5PeriodicInput {
  return decodeRecord(Q5_PERIODIC_SPEC, line);
}

export function decodeQ6Periodic(line: string): Q6PeriodicInput {
  return decodeRecord(Q6_PERIODIC_SPEC, line);
}

export function decodeQJPeriodicFeeTotal(line: string): StatementFeeInput {
  return decodeRecord(QJ_STATEMENT_FEE_SPEC, line);
}


interface DraftDetailGroup {
  q1: Q1PeriodicInput;
  q2?: Q2PeriodicInput;
  fees: StatementFeeInput[];
}

interface DraftPreliminaryPaymentGroup {
  q3: Q3PeriodicInput;
  q4?: Q4PeriodicInput;
  feeTotals: StatementFeeInput[];
}

interface DraftFinalPaymentGroup {
  q5: Q5PeriodicInput;
  q6?: Q6PeriodicInput;
  feeTotals: StatementFeeInput[];
}

/**
 * Walks raw Periodic Monthly Statement (Application Identifier MS) fixed-width output lines
 * from ACE and returns a structured representation conforming to the Periodic Monthly Statement
 * Output Record Structure Map (CATAIR 05b-periodic-monthly-statement.pdf, Page 6).
 */
export function parsePeriodicStatement(
  lines: string[],
  options?: PeriodicStatementParseOptions
): ParsedPeriodicStatementResponse {
  const allowMissingFees = options?.allowMissingFees ?? false;

  const details: PeriodicDailyStatementDetailGroup[] = [];
  let currentDetailGroup: DraftDetailGroup | undefined;

  let preliminaryOrFinalPayment: DraftPreliminaryPaymentGroup | undefined;
  let finalStatement: DraftFinalPaymentGroup | undefined;

  const deletedEntrySummaries: Q7DeletedInput[] = [];
  const unrecognizedLines: string[] = [];

  function finalizeDetailGroup(group: DraftDetailGroup) {
    if (!group.q2) {
      throw new AbiFixedWidthError(
        "Periodic Monthly Statement response: Q1 detail group missing mandatory Q2 record."
      );
    }
    if (!allowMissingFees && group.fees.length === 0) {
      throw new AbiFixedWidthError(
        "Periodic Monthly Statement response: Q1 detail group missing mandatory QA fee record (CATAIR Page 6 Designation M)."
      );
    }
    if (details.length >= 9999) {
      throw new AbiFixedWidthError(
        "Periodic Monthly Statement response: Exceeded maximum 9,999 Periodic Daily Statement Details Groupings (CATAIR Page 6 Repeat limit)."
      );
    }
    details.push(group as PeriodicDailyStatementDetailGroup);
  }

  for (const line of lines) {
    const code = classifyStatementLine(line);

    if (code === "Q1") {
      if (currentDetailGroup) {
        finalizeDetailGroup(currentDetailGroup);
      }
      currentDetailGroup = {
        q1: decodeQ1Periodic(line),
        fees: [],
      };
    } else if (code === "Q2") {
      if (!currentDetailGroup) {
        throw new AbiFixedWidthError(
          "Periodic Monthly Statement response: Q2 record encountered without preceding Q1."
        );
      }
      if (currentDetailGroup.q2) {
        throw new AbiFixedWidthError(
          "Periodic Monthly Statement response: Duplicate Q2 record in same detail grouping."
        );
      }
      currentDetailGroup.q2 = decodeQ2Periodic(line);
    } else if (code === "QA") {
      if (!currentDetailGroup) {
        throw new AbiFixedWidthError(
          "Periodic Monthly Statement response: QA fee record encountered without preceding Q1."
        );
      }
      if (currentDetailGroup.fees.length >= 5) {
        throw new AbiFixedWidthError(
          "Periodic Monthly Statement response: Exceeded maximum 5 QA fee records per detail grouping."
        );
      }
      currentDetailGroup.fees.push(decodeQAPeriodicFee(line));
    } else if (code === "Q3") {
      if (currentDetailGroup) {
        finalizeDetailGroup(currentDetailGroup);
        currentDetailGroup = undefined;
      }
      if (preliminaryOrFinalPayment) {
        throw new AbiFixedWidthError(
          "Periodic Monthly Statement response: Duplicate Q3 preliminary/final totals group."
        );
      }
      preliminaryOrFinalPayment = {
        q3: decodeQ3Periodic(line),
        feeTotals: [],
      };
    } else if (code === "Q4") {
      if (!preliminaryOrFinalPayment) {
        throw new AbiFixedWidthError(
          "Periodic Monthly Statement response: Q4 record encountered without preceding Q3."
        );
      }
      if (preliminaryOrFinalPayment.q4) {
        throw new AbiFixedWidthError(
          "Periodic Monthly Statement response: Duplicate Q4 record in preliminary/final totals group."
        );
      }
      preliminaryOrFinalPayment.q4 = decodeQ4Periodic(line);
    } else if (code === "QE") {
      if (!preliminaryOrFinalPayment) {
        throw new AbiFixedWidthError(
          "Periodic Monthly Statement response: QE fee totals record encountered without preceding Q3."
        );
      }
      if (preliminaryOrFinalPayment.feeTotals.length >= 5) {
        throw new AbiFixedWidthError(
          "Periodic Monthly Statement response: Exceeded maximum 5 QE fee totals records per preliminary/final group."
        );
      }
      preliminaryOrFinalPayment.feeTotals.push(decodeQEPeriodicFeeTotal(line));
    } else if (code === "Q5") {
      if (currentDetailGroup) {
        finalizeDetailGroup(currentDetailGroup);
        currentDetailGroup = undefined;
      }
      if (finalStatement) {
        throw new AbiFixedWidthError(
          "Periodic Monthly Statement response: Duplicate Q5 final totals group."
        );
      }
      finalStatement = {
        q5: decodeQ5Periodic(line),
        feeTotals: [],
      };
    } else if (code === "Q6") {
      if (!finalStatement) {
        throw new AbiFixedWidthError(
          "Periodic Monthly Statement response: Q6 record encountered without preceding Q5."
        );
      }
      if (finalStatement.q6) {
        throw new AbiFixedWidthError(
          "Periodic Monthly Statement response: Duplicate Q6 record in final totals group."
        );
      }
      finalStatement.q6 = decodeQ6Periodic(line);
    } else if (code === "QJ") {
      if (!finalStatement) {
        throw new AbiFixedWidthError(
          "Periodic Monthly Statement response: QJ fee totals record encountered without preceding Q5."
        );
      }
      if (finalStatement.feeTotals.length >= 5) {
        throw new AbiFixedWidthError(
          "Periodic Monthly Statement response: Exceeded maximum 5 QJ fee totals records per final group."
        );
      }
      finalStatement.feeTotals.push(decodeQJPeriodicFeeTotal(line));
    } else if (code === "Q7") {
      if (currentDetailGroup) {
        finalizeDetailGroup(currentDetailGroup);
        currentDetailGroup = undefined;
      }
      if (deletedEntrySummaries.length >= 9999) {
        throw new AbiFixedWidthError(
          "Periodic Monthly Statement response: Exceeded maximum 9,999 Entry Summaries Deleted (Q7) records (CATAIR Page 6 Repeat limit)."
        );
      }
      deletedEntrySummaries.push(decodeQ7Deleted(line));
    } else {
      unrecognizedLines.push(line);
    }
  }

  if (currentDetailGroup) {
    finalizeDetailGroup(currentDetailGroup);
  }

  if (preliminaryOrFinalPayment) {
    if (!preliminaryOrFinalPayment.q4) {
      throw new AbiFixedWidthError(
        "Periodic Monthly Statement response: Q3 payment group missing mandatory Q4 record."
      );
    }
    if (!allowMissingFees && preliminaryOrFinalPayment.feeTotals.length === 0) {
      throw new AbiFixedWidthError(
        "Periodic Monthly Statement response: Q3 payment group missing mandatory QE fee totals record (CATAIR Page 6 Designation M)."
      );
    }
  }

  if (finalStatement) {
    if (!finalStatement.q6) {
      throw new AbiFixedWidthError(
        "Periodic Monthly Statement response: Q5 payment group missing mandatory Q6 record."
      );
    }
    if (!allowMissingFees && finalStatement.feeTotals.length === 0) {
      throw new AbiFixedWidthError(
        "Periodic Monthly Statement response: Q5 payment group missing mandatory QJ fee totals record (CATAIR Page 6 Designation M)."
      );
    }
  }

  return {
    details,
    preliminaryOrFinalPayment: preliminaryOrFinalPayment as PreliminaryOrFinalPeriodicPaymentGroup | undefined,
    finalStatement: finalStatement as FinalPeriodicStatementPaymentGroup | undefined,
    deletedEntrySummaries,
    unrecognizedLines,
  };
}

export function parsePeriodicStatementText(
  raw: string,
  options?: PeriodicStatementParseOptions
): ParsedPeriodicStatementResponse {
  return parsePeriodicStatement(splitFixedWidthLines(raw), options);
}
