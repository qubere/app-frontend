import { encodeRecord } from "@/lib/abi/fixedWidth";
import {
  Q1_DAILY_SPEC,
  Q2_DAILY_SPEC,
  QA_STATEMENT_FEE_SPEC,
  QE_STATEMENT_FEE_SPEC,
  QJ_STATEMENT_FEE_SPEC,
  Q3_DAILY_SPEC,
  Q5_DAILY_SPEC,
  Q4_DAILY_SPEC,
  Q6_DAILY_SPEC,
  Q7_STATEMENT_DELETED_SPEC,
  Q1_PERIODIC_SPEC,
  Q2_PERIODIC_SPEC,
  Q4_PERIODIC_SPEC,
  Q6_PERIODIC_SPEC,
  Q3_PERIODIC_SPEC,
  Q5_PERIODIC_SPEC,
} from "./recordSpecs";
import type {
  Q1DailyInput,
  Q2DailyInput,
  StatementFeeInput,
  Q3DailyInput,
  Q5DailyInput,
  Q4DailyInput,
  Q6DailyInput,
  Q7DeletedInput,
  Q1PeriodicInput,
  Q2PeriodicInput,
  Q4PeriodicInput,
  Q6PeriodicInput,
  Q3PeriodicInput,
  Q5PeriodicInput,
} from "./types";

export function buildQ1Daily(input: Q1DailyInput): string {
  return encodeRecord(Q1_DAILY_SPEC, input);
}

export function buildQ2Daily(input: Q2DailyInput): string {
  return encodeRecord(Q2_DAILY_SPEC, input);
}

export function buildStatementFee(input: StatementFeeInput): string {
  return encodeRecord(QA_STATEMENT_FEE_SPEC, input);
}

export function buildPreliminaryStatementFeeTotal(input: StatementFeeInput): string {
  return encodeRecord(QE_STATEMENT_FEE_SPEC, input);
}

export function buildFinalPaidStatementFeeTotal(input: StatementFeeInput): string {
  return encodeRecord(QJ_STATEMENT_FEE_SPEC, input);
}

export function buildQ3Daily(input: Q3DailyInput): string {
  return encodeRecord(Q3_DAILY_SPEC, input);
}

export function buildQ5Daily(input: Q5DailyInput): string {
  return encodeRecord(Q5_DAILY_SPEC, input);
}

export function buildQ4Daily(input: Q4DailyInput): string {
  return encodeRecord(Q4_DAILY_SPEC, input);
}

export function buildQ6Daily(input: Q6DailyInput): string {
  return encodeRecord(Q6_DAILY_SPEC, input);
}

export function buildQ7Deleted(input: Q7DeletedInput): string {
  return encodeRecord(Q7_STATEMENT_DELETED_SPEC, input);
}

export function buildQ1Periodic(input: Q1PeriodicInput): string {
  return encodeRecord(Q1_PERIODIC_SPEC, input);
}

export function buildQ2Periodic(input: Q2PeriodicInput): string {
  return encodeRecord(Q2_PERIODIC_SPEC, input);
}

export function buildQ4Periodic(input: Q4PeriodicInput): string {
  return encodeRecord(Q4_PERIODIC_SPEC, input);
}

export function buildQ6Periodic(input: Q6PeriodicInput): string {
  return encodeRecord(Q6_PERIODIC_SPEC, input);
}

export function buildQ3Periodic(input: Q3PeriodicInput): string {
  return encodeRecord(Q3_PERIODIC_SPEC, input);
}

export function buildQ5Periodic(input: Q5PeriodicInput): string {
  return encodeRecord(Q5_PERIODIC_SPEC, input);
}
