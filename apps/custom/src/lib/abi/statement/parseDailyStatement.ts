import { decodeRecord, splitFixedWidthLines, AbiFixedWidthError } from "@/lib/abi/fixedWidth";
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
} from "./recordSpecs";
import { classifyStatementLine } from "./parse";
import type {
  Q1DailyInput,
  Q2DailyInput,
  StatementFeeInput,
  Q3DailyInput,
  Q4DailyInput,
  Q5DailyInput,
  Q6DailyInput,
  Q7DeletedInput,
  DailyStatementDetailGroup,
  PreliminaryOrFinalDailyPaymentGroup,
  FinalDailyStatementPaymentGroup,
  ParsedDailyStatementResponse,
} from "./types";

export function decodeQ1Daily(line: string): Q1DailyInput {
  return decodeRecord(Q1_DAILY_SPEC, line);
}

export function decodeQ2Daily(line: string): Q2DailyInput {
  return decodeRecord(Q2_DAILY_SPEC, line);
}

export function decodeQADailyFee(line: string): StatementFeeInput {
  return decodeRecord(QA_STATEMENT_FEE_SPEC, line);
}

export function decodeQ3Daily(line: string): Q3DailyInput {
  return decodeRecord(Q3_DAILY_SPEC, line);
}

export function decodeQ4Daily(line: string): Q4DailyInput {
  return decodeRecord(Q4_DAILY_SPEC, line);
}

export function decodeQEDailyFeeTotal(line: string): StatementFeeInput {
  return decodeRecord(QE_STATEMENT_FEE_SPEC, line);
}

export function decodeQ5Daily(line: string): Q5DailyInput {
  return decodeRecord(Q5_DAILY_SPEC, line);
}

export function decodeQ6Daily(line: string): Q6DailyInput {
  return decodeRecord(Q6_DAILY_SPEC, line);
}

export function decodeQJDailyFeeTotal(line: string): StatementFeeInput {
  return decodeRecord(QJ_STATEMENT_FEE_SPEC, line);
}

export function decodeQ7Deleted(line: string): Q7DeletedInput {
  return decodeRecord(Q7_STATEMENT_DELETED_SPEC, line);
}

interface DraftDetailGroup {
  q1: Q1DailyInput;
  q2?: Q2DailyInput;
  fees: StatementFeeInput[];
}

interface DraftPreliminaryPaymentGroup {
  q3: Q3DailyInput;
  q4?: Q4DailyInput;
  feeTotals: StatementFeeInput[];
}

interface DraftFinalPaymentGroup {
  q5: Q5DailyInput;
  q6?: Q6DailyInput;
  feeTotals: StatementFeeInput[];
}

/**
 * Walks raw Daily Statement (Application Identifier PF) fixed-width output lines
 * from ACE and returns a structured representation conforming to the Daily Statement
 * Output Record Structure Map (CATAIR 05-daily-statement.pdf, Page 9).
 */
export function parseDailyStatement(lines: string[]): ParsedDailyStatementResponse {
  const details: DailyStatementDetailGroup[] = [];
  let currentDetailGroup: DraftDetailGroup | undefined;

  let preliminaryOrFinalPayment: DraftPreliminaryPaymentGroup | undefined;
  let finalStatement: DraftFinalPaymentGroup | undefined;

  const deletedEntrySummaries: Q7DeletedInput[] = [];
  const unrecognizedLines: string[] = [];

  for (const line of lines) {
    const code = classifyStatementLine(line);

    if (code === "Q1") {
      if (currentDetailGroup) {
        if (!currentDetailGroup.q2) {
          throw new AbiFixedWidthError(
            "Daily Statement response: Q1 record encountered before preceding Q1 group received mandatory Q2."
          );
        }
        details.push(currentDetailGroup as DailyStatementDetailGroup);
      }
      currentDetailGroup = {
        q1: decodeQ1Daily(line),
        fees: [],
      };
    } else if (code === "Q2") {
      if (!currentDetailGroup) {
        throw new AbiFixedWidthError("Daily Statement response: Q2 record encountered without preceding Q1.");
      }
      if (currentDetailGroup.q2) {
        throw new AbiFixedWidthError("Daily Statement response: Duplicate Q2 record in same detail grouping.");
      }
      currentDetailGroup.q2 = decodeQ2Daily(line);
    } else if (code === "QA") {
      if (!currentDetailGroup) {
        throw new AbiFixedWidthError("Daily Statement response: QA fee record encountered without preceding Q1.");
      }
      currentDetailGroup.fees.push(decodeQADailyFee(line));
    } else if (code === "Q3") {
      if (currentDetailGroup) {
        if (!currentDetailGroup.q2) {
          throw new AbiFixedWidthError(
            "Daily Statement response: Q3 record encountered before detail group received mandatory Q2."
          );
        }
        details.push(currentDetailGroup as DailyStatementDetailGroup);
        currentDetailGroup = undefined;
      }
      if (preliminaryOrFinalPayment) {
        throw new AbiFixedWidthError("Daily Statement response: Duplicate Q3 preliminary/final totals group.");
      }
      preliminaryOrFinalPayment = {
        q3: decodeQ3Daily(line),
        feeTotals: [],
      };
    } else if (code === "Q4") {
      if (!preliminaryOrFinalPayment) {
        throw new AbiFixedWidthError("Daily Statement response: Q4 record encountered without preceding Q3.");
      }
      if (preliminaryOrFinalPayment.q4) {
        throw new AbiFixedWidthError("Daily Statement response: Duplicate Q4 record in preliminary/final totals group.");
      }
      preliminaryOrFinalPayment.q4 = decodeQ4Daily(line);
    } else if (code === "QE") {
      if (!preliminaryOrFinalPayment) {
        throw new AbiFixedWidthError("Daily Statement response: QE fee totals record encountered without preceding Q3.");
      }
      preliminaryOrFinalPayment.feeTotals.push(decodeQEDailyFeeTotal(line));
    } else if (code === "Q5") {
      if (currentDetailGroup) {
        if (!currentDetailGroup.q2) {
          throw new AbiFixedWidthError(
            "Daily Statement response: Q5 record encountered before detail group received mandatory Q2."
          );
        }
        details.push(currentDetailGroup as DailyStatementDetailGroup);
        currentDetailGroup = undefined;
      }
      if (finalStatement) {
        throw new AbiFixedWidthError("Daily Statement response: Duplicate Q5 final totals group.");
      }
      finalStatement = {
        q5: decodeQ5Daily(line),
        feeTotals: [],
      };
    } else if (code === "Q6") {
      if (!finalStatement) {
        throw new AbiFixedWidthError("Daily Statement response: Q6 record encountered without preceding Q5.");
      }
      if (finalStatement.q6) {
        throw new AbiFixedWidthError("Daily Statement response: Duplicate Q6 record in final totals group.");
      }
      finalStatement.q6 = decodeQ6Daily(line);
    } else if (code === "QJ") {
      if (!finalStatement) {
        throw new AbiFixedWidthError("Daily Statement response: QJ fee totals record encountered without preceding Q5.");
      }
      finalStatement.feeTotals.push(decodeQJDailyFeeTotal(line));
    } else if (code === "Q7") {
      if (currentDetailGroup) {
        if (!currentDetailGroup.q2) {
          throw new AbiFixedWidthError(
            "Daily Statement response: Q7 record encountered before detail group received mandatory Q2."
          );
        }
        details.push(currentDetailGroup as DailyStatementDetailGroup);
        currentDetailGroup = undefined;
      }
      deletedEntrySummaries.push(decodeQ7Deleted(line));
    } else {
      unrecognizedLines.push(line);
    }
  }

  if (currentDetailGroup) {
    if (!currentDetailGroup.q2) {
      throw new AbiFixedWidthError(
        "Daily Statement response: End of lines reached before detail group received mandatory Q2."
      );
    }
    details.push(currentDetailGroup as DailyStatementDetailGroup);
  }

  if (preliminaryOrFinalPayment && !preliminaryOrFinalPayment.q4) {
    throw new AbiFixedWidthError("Daily Statement response: Q3 payment group missing mandatory Q4.");
  }

  if (finalStatement && !finalStatement.q6) {
    throw new AbiFixedWidthError("Daily Statement response: Q5 payment group missing mandatory Q6.");
  }

  return {
    details,
    preliminaryOrFinalPayment: preliminaryOrFinalPayment as PreliminaryOrFinalDailyPaymentGroup | undefined,
    finalStatement: finalStatement as FinalDailyStatementPaymentGroup | undefined,
    deletedEntrySummaries,
    unrecognizedLines,
  };
}

export function parseDailyStatementText(raw: string): ParsedDailyStatementResponse {
  return parseDailyStatement(splitFixedWidthLines(raw));
}
