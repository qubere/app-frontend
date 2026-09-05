import { db as prisma } from "@qubere/db";
import { Prisma } from "@prisma/client";
import { postLedgerEntry } from "./ledgerService";

export interface RunReconciliationInput {
  accountId: string;
  statementRecordId: string;
  toleranceDollar?: number;
  tolerancePercent?: number;
  createdById?: string | null;
}

export async function runStatementReconciliation(input: RunReconciliationInput) {
  const { accountId, statementRecordId, toleranceDollar = 1.0, tolerancePercent = 0.005 } = input;

  const statement = await prisma.statementRecord.findFirst({
    where: { id: statementRecordId, accountId },
    include: { statementFeeLines: true },
  });

  if (!statement) {
    throw new Error(`StatementRecord ${statementRecordId} not found`);
  }

  // Idempotent check
  const existing = await prisma.statementReconciliation.findFirst({
    where: { accountId, statementRecordId },
    include: { lines: true },
  });
  if (existing) return existing;

  // Find disbursements linked to this statementRecordId OR with matching entryNumbers / filerCode
  const disbursements = await prisma.dutyDisbursement.findMany({
    where: {
      accountId,
      OR: [
        { statementRecordId },
        { statementDate: statement.dueDate || statement.printDate },
      ],
    },
    include: { feeLines: true },
  });

  const reconciliation = await prisma.statementReconciliation.create({
    data: {
      accountId,
      statementRecordId,
      status: "IN_PROGRESS",
    },
  });

  let matchedCount = 0;
  let varianceCount = 0;
  let unmatchedCount = 0;
  let totalVarianceAmount = 0;

  // Disbursements that were matched to at least one statement line (used below to
  // flag locally-paid disbursements that never appeared on the statement).
  const matchedDisbursementIds = new Set<string>();
  // A single disbursement carries one fee line per accounting class code, so the
  // dedup key has to be (disbursement, classCode) — keying on disbursement id
  // alone would let the first statement line consume the whole disbursement and
  // spuriously flag every other class code on it as MISSING_IN_QUBERE.
  const consumedFeeLineKeys = new Set<string>();

  // Compare StatementFeeLines against DutyDisbursements
  for (const sLine of statement.statementFeeLines) {
    const sAmt = Number(sLine.amount);
    const classCode = sLine.accountingClassCode;

    // Find candidate disbursement fee line
    const match = disbursements.find((d) => {
      const flMatch = d.feeLines.find((fl) => fl.accountingClassCode === classCode);
      return flMatch && !consumedFeeLineKeys.has(`${d.id}::${classCode}`);
    });

    if (!match) {
      unmatchedCount++;
      const bException = await prisma.billingException.create({
        data: {
          accountId,
          type: "STATEMENT_RECONCILIATION_VARIANCE",
          severity: "HIGH",
          status: "OPEN",
          description: `CBP fee line for class ${classCode} ($${sAmt.toFixed(2)}) is MISSING_IN_QUBERE on statement ${statement.statementNumber}`,
        },
      });

      await prisma.statementReconciliationLine.create({
        data: {
          reconciliationId: reconciliation.id,
          statementFeeLineId: sLine.id,
          accountingClassCode: classCode,
          statementAmount: sLine.amount,
          qubereAmount: new Prisma.Decimal(0),
          varianceAmount: sLine.amount,
          matchStatus: "MISSING_IN_QUBERE",
          billingExceptionId: bException.id,
        },
      });
      totalVarianceAmount += sAmt;
    } else {
      matchedDisbursementIds.add(match.id);
      consumedFeeLineKeys.add(`${match.id}::${classCode}`);
      const flMatch = match.feeLines.find((fl) => fl.accountingClassCode === classCode);
      const qAmt = flMatch
        ? Number(flMatch.actualAmount || flMatch.estimatedAmount || 0)
        : Number(match.actualAmount || match.estimatedAmount || 0);
      const diff = Math.abs(sAmt - qAmt);
      const allowedTolerance = Math.max(toleranceDollar, qAmt * tolerancePercent);

      if (diff <= allowedTolerance) {
        matchedCount++;
        await prisma.statementReconciliationLine.create({
          data: {
            reconciliationId: reconciliation.id,
            statementFeeLineId: sLine.id,
            disbursementId: match.id,
            entryNumber: match.entryNumber,
            accountingClassCode: classCode,
            statementAmount: sLine.amount,
            qubereAmount: match.actualAmount || match.estimatedAmount,
            varianceAmount: new Prisma.Decimal(0),
            matchStatus: "MATCHED",
          },
        });
      } else {
        varianceCount++;
        totalVarianceAmount += diff;

        const bException = await prisma.billingException.create({
          data: {
            accountId,
            type: "STATEMENT_RECONCILIATION_VARIANCE",
            severity: "HIGH",
            status: "OPEN",
            description: `Statement variance on class ${classCode}: CBP $${sAmt.toFixed(2)} vs Qubere $${qAmt.toFixed(2)} (diff $${diff.toFixed(2)})`,
          },
        });

        await prisma.statementReconciliationLine.create({
          data: {
            reconciliationId: reconciliation.id,
            statementFeeLineId: sLine.id,
            disbursementId: match.id,
            entryNumber: match.entryNumber,
            accountingClassCode: classCode,
            statementAmount: sLine.amount,
            qubereAmount: match.actualAmount || match.estimatedAmount,
            varianceAmount: new Prisma.Decimal(diff),
            matchStatus: "VARIANCE",
            billingExceptionId: bException.id,
          },
        });
      }
    }
  }

  // Check for disbursements not present on statement
  for (const d of disbursements) {
    if (!matchedDisbursementIds.has(d.id) && d.status === "PAID_TO_CBP") {
      unmatchedCount++;
      const qAmt = Number(d.actualAmount || d.estimatedAmount);
      totalVarianceAmount += qAmt;

      const bException = await prisma.billingException.create({
        data: {
          accountId,
          type: "STATEMENT_RECONCILIATION_VARIANCE",
          severity: "MEDIUM",
          status: "OPEN",
          description: `Local paid disbursement for entry ${d.entryNumber || d.id} ($${qAmt.toFixed(2)}) is MISSING_ON_STATEMENT`,
        },
      });

      await prisma.statementReconciliationLine.create({
        data: {
          reconciliationId: reconciliation.id,
          disbursementId: d.id,
          entryNumber: d.entryNumber,
          qubereAmount: d.actualAmount || d.estimatedAmount,
          statementAmount: new Prisma.Decimal(0),
          varianceAmount: new Prisma.Decimal(qAmt),
          matchStatus: "MISSING_ON_STATEMENT",
          billingExceptionId: bException.id,
        },
      });
    }
  }

  const finalStatus = varianceCount === 0 && unmatchedCount === 0 ? "CLOSED" : "NEEDS_REVIEW";

  return prisma.statementReconciliation.update({
    where: { id: reconciliation.id },
    data: {
      matchedCount,
      varianceCount,
      unmatchedCount,
      totalVarianceAmount: new Prisma.Decimal(totalVarianceAmount),
      status: finalStatus,
      closedAt: finalStatus === "CLOSED" ? new Date() : null,
    },
    include: { lines: true },
  });
}

export async function resolveReconciliationLine(input: {
  accountId: string;
  lineId: string;
  action: "ACCEPT" | "ADJUST" | "EXCEPTION" | "RELINK";
  userId?: string | null;
  hasOverridePermission?: boolean;
  adjustmentAmount?: number;
  idempotencyKey?: string;
}) {
  const { accountId, lineId, action, userId = null, hasOverridePermission = false, adjustmentAmount } = input;

  const line = await prisma.statementReconciliationLine.findUnique({
    where: { id: lineId },
    include: { reconciliation: true },
  });

  if (!line || line.reconciliation.accountId !== accountId) {
    throw new Error(`StatementReconciliationLine ${lineId} not found`);
  }

  const varAmt = Number(line.varianceAmount || 0);

  if (action === "ACCEPT") {
    if (varAmt > 0 && !hasOverridePermission) {
      throw new Error("billing.funds.override permission is required to ACCEPT a line with variance.");
    }
  } else if (action === "ADJUST") {
    if (!line.disbursementId) {
      throw new Error("Cannot adjust line without a linked disbursement.");
    }
    const disbursement = await prisma.dutyDisbursement.findUnique({
      where: { id: line.disbursementId },
    });
    if (disbursement) {
      const adjVal = adjustmentAmount !== undefined ? adjustmentAmount : varAmt;
      await postLedgerEntry({
        accountId,
        disbursementAccountId: disbursement.disbursementAccountId,
        type: "ADJUSTMENT",
        amount: adjVal,
        description: `Statement reconciliation adjustment for line ${lineId}`,
        disbursementId: disbursement.id,
        createdById: userId,
        idempotencyKey: input.idempotencyKey || `recon-adj-${lineId}-${Date.now()}`,
        allowNegativeBalanceOverride: hasOverridePermission,
      });
    }
  }

  // Close billing exception if linked
  if (line.billingExceptionId) {
    await prisma.billingException.update({
      where: { id: line.billingExceptionId },
      data: { status: "RESOLVED", resolvedAt: new Date(), resolutionNote: `Resolved via ${action} by user ${userId || "system"}` },
    });
  }

  const updatedLine = await prisma.statementReconciliationLine.update({
    where: { id: lineId },
    data: {
      resolution: action,
      resolvedById: userId,
      resolvedAt: new Date(),
    },
  });

  // Check if all lines resolved -> close reconciliation
  const openLines = await prisma.statementReconciliationLine.count({
    where: {
      reconciliationId: line.reconciliationId,
      resolution: null,
      matchStatus: { in: ["VARIANCE", "MISSING_IN_QUBERE", "MISSING_ON_STATEMENT"] },
    },
  });

  if (openLines === 0) {
    await prisma.statementReconciliation.update({
      where: { id: line.reconciliationId },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
      },
    });
  }

  return updatedLine;
}
