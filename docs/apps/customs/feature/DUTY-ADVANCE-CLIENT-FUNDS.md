# Duty-Advance & Client-Trust Funds Ledger Architecture

## Overview
This document specifies the technical architecture for the **Duty Disbursement / Client Trust Ledger** in Qubere. It acts as the cash management layer sitting between "broker owes CBP" and "importer owes broker".

## Core Domain Models
1. **`DutyDisbursementAccount`**: Per-client/importer advance account holding trust balances, minimum/target thresholds, and auto-replenishment flags.
2. **`FundsLedgerEntry`**: Append-only movement log. Computes sequential `runningBalance` inside transactional row locks. Corrections are recorded as reversing entries.
3. **`DutyDisbursement`**: Lifecycle tracking for duty fronted to CBP (`ESTIMATED → AUTHORIZED → SCHEDULED → PAID_TO_CBP → BILLED_TO_CLIENT → SETTLED`).
4. **`ReplenishmentRequest`**: Auto-generated requests when an account drops below its minimum threshold.
5. **`StatementReconciliation` & `StatementReconciliationLine`**: Match runs between `DutyDisbursement` records and ingested `StatementRecord` fee lines.

## Validation & Security Invariants
- **Append-Only Ledger**: No `UPDATE` or `DELETE` allowed on `FundsLedgerEntry`. Reversals post `-original.amount`.
- **Tenancy Isolation**: All backend requests are scoped by `accountId`. Portal APIs enforce client scoping server-side via session.
- **Negative Balance Protection**: Blocked unless explicitly authorized with `billing.funds.override`.
- **Money Precision**: All money math uses `Decimal(16,2)` / `Decimal(16,4)`.

## RBAC Permission Catalog
- `billing.funds.view`: Read-only access to trust balances and ledgers.
- `billing.funds.manage`: Create and update account thresholds.
- `billing.funds.authorize`: Authorize duty disbursements.
- `billing.funds.disburse`: Record payment execution to CBP.
- `billing.funds.deposit`: Record advance deposits and replenishment receipts.
- `billing.funds.refund`: Refund trust balances to clients.
- `billing.funds.adjust`: Manual adjustments and ledger reversals.
- `billing.funds.reconcile`: Execute and resolve CBP statement reconciliations.
- `billing.funds.override`: Override negative balance limits and variance acceptances.
