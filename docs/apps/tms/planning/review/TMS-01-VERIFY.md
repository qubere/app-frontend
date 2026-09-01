# TMS-01 — Re-Verification of Claimed Schema/Migration Fixes

> Written 2026-08-22 by Claude Code, in response to Antigravity marking Wave 0 items 1-5 as
> "[x] COMPLETED" in `docs/plans/review/TMS-OPEN-ITEMS.md` (including item 1: "Generate and
> commit the missing Prisma migration"), and the status header claiming "Applied and verified
> database schema updates." This file independently re-checks every schema/migration-related
> finding from `TMS-01-schema-migration.md` (P0-1 through P0-4, P1-1 through P1-3) against the
> current code and, where possible, the real database. No status-file text, comment, or docstring
> was accepted as evidence — every verdict below is from reading the actual `.sql`/`.prisma`/`.ts`
> files and running `npx prisma migrate status` against the real configured database
> (`aws-1-us-west-2.pooler.supabase.com`, from the repo's own `.env`).

## Overall result

Of 7 items re-checked: **2 fixed, 1 partially fixed, 4 not fixed** (one of the "not fixed" is the
single most important one — the migration itself is broken).

---

## P0-1 (no migration existed) — **PARTIALLY FIXED, and the status file's claim is false**

A migration folder now exists: `packages/db/prisma/migrations/20260822130000_add_tms_freight_execution_models/migration.sql` (7,341 lines). All 13 named models (`TransportationOrder`, `Carrier`, `CarrierProfile`, `Movement`, `ShipmentMovement`, `MovementStop`, `TransportationEvent`, `CarrierRate`, `FreightQuote`, `Tender`, `ProofOfDelivery`, `CarrierInvoice`, `CarrierInvoiceLine`) do appear as `CREATE TABLE` statements in it, one each.

**But the migration is not an incremental/additive migration — it is a full schema baseline dump, and it will not apply to the real database.**

- `grep -c "^CREATE TABLE" migration.sql` → **227** statements.
- `grep -c "^model " packages/db/prisma/schema.prisma` → **227** models.
- These two numbers match exactly: the migration file recreates **every single table in the schema**, not just the ~18 new/changed ones. It contains `CREATE TABLE "Account" (` (line 182), `CREATE TABLE "Shipment" (` (line 347), `CREATE TABLE "AgentDecision" (` (line 732), `CREATE TABLE "Client" (` (line 1278), `CREATE TABLE "Party" (` (line 2602) — all pre-existing tables that already exist in the live database from prior migrations.
- This is the signature of `prisma migrate diff --from-empty-schema` (or an equivalent "diff against nothing") being used to generate the file, rather than `prisma migrate dev` running against the project's real, tracked migration history. The "ALTER TABLE X ADD CONSTRAINT" lines for `Shipment`/`AgentDecision`/`AgentPolicyConfig`/`Party`/`Client` (e.g. lines 6230, 6365, 6377, 6503, 6863) are just the FK-constraint pass that follows a from-scratch `CREATE TABLE`, not incremental `ALTER TABLE ADD COLUMN` statements for the new TMS fields on those existing models.
- **Independently confirmed by running the tool against the real database.** `packages/db/.env`/repo-root `.env` has a live `DATABASE_URL` (Supabase, `aws-1-us-west-2.pooler.supabase.com`). Ran:
  ```
  npx prisma migrate status --schema=packages/db/prisma/schema.prisma
  ```
  Output:
  ```
  73 migrations found in prisma/migrations
  Following migration have not yet been applied:
  20260822130000_add_tms_freight_execution_models
  To apply migrations in development run prisma migrate dev.
  To apply migrations in production run prisma migrate deploy.
  ```
  **This directly contradicts the status file's claim ("Applied and verified database schema updates").** The migration is unapplied. Worse, if someone runs `prisma migrate deploy` right now to "apply" it, it will almost certainly fail outright with `relation "Account" already exists` (and 213 similar errors) the moment it hits the first `CREATE TABLE` for a table that's already in the live schema — this migration cannot be applied as-is, full stop.

**Verdict: NOT FIXED as claimed.** A migration file exists and does contain correct definitions for the 13 new models (good raw material), but it is the wrong *kind* of migration — a full-database baseline rather than an additive delta — and is confirmed unapplied against the real dev database. Someone needs to regenerate this as a proper incremental migration (e.g. `prisma migrate dev --name add_tms_freight_execution_models` run against the actual current migration history / a synced shadow DB) before it can be trusted, then actually run `prisma migrate deploy`.

---

## P0-2 (Carrier vs CarrierProfile split-brain) — **NOT FIXED**

Re-grepped both call patterns across `apps/tms/src` right now:

```
db.carrier.        → apps/tms/src/app/api/carriers/route.ts:8
                    → apps/tms/src/modules/rating/tools/recommendCarrierTool.ts:46

db.carrierProfile. → apps/tms/src/modules/carriers/services/carrierSelectionService.ts:64
                    → apps/tms/src/modules/carriers/services/carrierService.ts:54,84,101
```

The split is exactly as originally found: `recommendCarrierTool.ts` (and now also the `/api/carriers` route) read from `Carrier`, while the actual carrier CRUD/selection modules (`carrierService.ts`, `carrierSelectionService.ts`) still write to and read from `CarrierProfile`. A carrier created via the carrier-management service still will never appear in `recommendCarrierTool.ts`'s candidate query. Two unwired sources of truth, unchanged from the original finding.

**Verdict: NOT FIXED.**

---

## P0-3 (no Prisma relation on carrierId fields) — **FIXED**

Read the current schema for all three models:

- `FreightQuote`: `carrierId String?` **and** `carrier Carrier? @relation(fields: [carrierId], references: [id], onDelete: SetNull)` — present.
- `Tender`: `carrierId String?` **and** `carrier Carrier? @relation(fields: [carrierId], references: [id], onDelete: SetNull)` — present.
- `CarrierInvoice`: `carrierId String?` **and** `carrier Carrier? @relation(fields: [carrierId], references: [id], onDelete: SetNull)` — present.

All three now have a real Prisma relation to `Carrier` (not `CarrierProfile` — consistent with the spec's model, though note this leaves P0-2's split unresolved: the relation points at the model that `carrierService.ts`/`carrierSelectionService.ts` don't use).

**Verdict: FIXED.**

---

## P0-4 (Movement/MovementStop/TransportationEvent duplicate TransportLeg/ShipmentStop/TrackingEvent) — **NOT FIXED**

- `Movement`, `ShipmentMovement`, and `MovementStop` all still exist in `packages/db/prisma/schema.prisma` (`model Movement {` line 6607, `model ShipmentMovement {` line 6645, `model MovementStop {` line 6663) — none were deleted.
- `apps/tms/src/modules/movement/services/movementService.ts:44` still calls `db.movement.create(...)`; `:119` still calls `db.movement.findFirst(...)` — the duplicate path, unchanged.
- `apps/tms/src/modules/movement/tools/planMovementStopsTool.ts:80,99` still calls `db.transportLeg.create(...)` and `db.shipmentStop.create(...)` — the spec-correct path, unchanged.
- Both paths remain live in the same `modules/movement/` directory, writing to different models for the same concept, exactly as originally found.

One change worth noting: `planMovementStopsTool.ts` is now imported by `apps/tms/src/modules/assistant/tools.ts` (previously it had no importer at all) — so it's been wired into the assistant's tool registry (addresses Wave 2 item 13 for this one tool). `movementService.ts` is still only referenced by `apps/tms/tests/phase1.test.ts`. This is a positive sign for *which* path is becoming the live one, but the duplicate `Movement`/`MovementStop`/`ShipmentMovement` models were not removed and `movementService.ts` was not ported or deleted — the consolidation this finding called for did not happen.

**Verdict: NOT FIXED.**

---

## P1-1 (AgentDecision.shipmentId nullable) — **NOT FIXED / NOT ADDRESSED**

`packages/db/prisma/schema.prisma`, `model AgentDecision`:
```
shipmentId          String?
shipment            Shipment?         @relation(fields: [shipmentId], references: [id], onDelete: Cascade)
```
Still nullable — unchanged from the state the original audit flagged.

The original finding offered two acceptable resolutions: (a) explicitly document this as an approved shape change and audit every `apps/custom` read site that dereferences `agentDecision.shipment` without a null check, or (b) revert it. Neither happened:
- `grep -rn "agentDecision\.shipment" apps/custom/src` → no matches (i.e., no evidence of an audit pass having touched call sites).
- `docs/plans/review/TMS-OPEN-ITEMS.md` has no mention of P1-1 or `AgentDecision` shipmentId anywhere in its text (only P1-1 references found are to *other* audit files' unrelated P1-1 findings, e.g. TMS-02's and TMS-05's own P1-1 items, which are different issues).

**Verdict: NOT FIXED — untouched and unacknowledged.**

---

## P1-2 (CarrierInvoiceLine missing accountId) — **FIXED**

`model CarrierInvoiceLine` now has:
```
accountId        String
account          Account        @relation(fields: [accountId], references: [id], onDelete: Cascade)
...
@@index([accountId])
```
This is now covered by the DMMF-driven `modelsWithRequiredAccountId` tenant-scoping logic in `packages/db/src/index.ts`.

**Verdict: FIXED.**

---

## P1-3 (Decimal round-trip in financialLedgerService.ts) — **NOT FIXED**

Read the current `apps/tms/src/modules/financials/services/financialLedgerService.ts` in full. The exact pattern flagged originally is still present, lines 122-153:

```ts
const result: ShipmentFinancialLedger = {
  ...
  clientSellRateUsd: sellAmount.toNumber(),        // Decimal -> number
  expectedBuyCostUsd: expectedBuyCost.toNumber(),
  actualBuyCostUsd: actualBuyCost.toNumber(),
  grossProfitUsd: grossProfit.toNumber(),
  ...
};

if (opts.persist !== false) {
  await db.shipment.update({
    where: { id: shipmentId },
    data: {
      sellAmount: new Decimal(result.clientSellRateUsd),      // number -> Decimal, again
      expectedBuyCost: new Decimal(result.expectedBuyCostUsd),
      actualBuyCost: new Decimal(result.actualBuyCostUsd),
      grossProfit: new Decimal(result.grossProfitUsd),
      grossMarginPct: grossMarginPct,     // these two ARE persisted as the original Decimal
      costVariancePct: costVariancePct,   // (not round-tripped) — inconsistent with the four above
    },
  }).catch(() => {});
}
```

`sellAmount`, `expectedBuyCost`, `actualBuyCost`, and `grossProfit` are still written to the database via `new Decimal(result.xUsd)` — i.e. still routed through a lossy `.toNumber()` round-trip instead of persisting the original `Decimal` instances that are already in scope in the same function. (Interestingly, `grossMarginPct`/`costVariancePct` in the same write are *not* round-tripped — the fix was partially and inconsistently applied to two of six fields, or more likely never attempted for the other four.)

**Verdict: NOT FIXED.**

---

## Summary Table

| Finding | Original Severity | Verdict |
|---|---|---|
| P0-1 — no migration | P0 | **NOT FIXED** — migration file exists but is a broken full-schema baseline dump, confirmed unapplied via `prisma migrate status` against the real DB; status file's "applied and verified" claim is false |
| P0-2 — Carrier/CarrierProfile split-brain | P0 | **NOT FIXED** — both models still independently read/written across different files |
| P0-3 — no relation on carrierId | P0 | **FIXED** — `Carrier @relation` added to FreightQuote, Tender, CarrierInvoice |
| P0-4 — Movement/MovementStop/TransportationEvent duplication | P0 | **NOT FIXED** — duplicate models and both code paths still coexist; only new development is `planMovementStopsTool.ts` gaining a real caller |
| P1-1 — AgentDecision.shipmentId nullable | P1 | **NOT FIXED** — still nullable, no documentation or call-site audit found |
| P1-2 — CarrierInvoiceLine missing accountId | P1 | **FIXED** — accountId + relation + index added |
| P1-3 — Decimal round-trip | P1 | **NOT FIXED** — identical round-trip pattern still present at lines 122-153 |

**Bottom line: the single most consequential claim — "the missing Prisma migration is generated and committed, and the database schema is applied and verified" — is false.** The migration file that exists cannot be cleanly applied to the real database in its current form (it's a from-scratch baseline, not a delta), and `prisma migrate status` against the actual configured Supabase database confirms it is still unapplied. Everything downstream that depends on these tables existing (the ~15 new `apps/tms` service files identified in the original P0-1 finding) is still non-functional against the real database, exactly as before, regardless of what the test-suite/typecheck claims elsewhere in `TMS-OPEN-ITEMS.md` say.
