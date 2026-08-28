# RDPS — Reverse Denied-Party Screening / Continuous Party Monitoring

RDPS re-screens parties that were already cleared in the past, so a change in
either the party's own data or the government denied-party reference data
gets caught instead of silently persisting behind a stale, one-time-only
clearance. It never reimplements screening — every re-check reuses the exact
same `rescreenParty()` lifecycle function the rest of Restricted Party
Screening (RPS) uses.

## Two dispatchers, one shared outcome path

`src/modules/compliance/rdps/`:

- **`deltaImpactDispatcher.ts`** — reactive. Triggered by a
  `ReferenceDataChangeSet` (a denied-party list update), it re-screens only
  the parties whose prior result could plausibly be affected by that specific
  delta — a targeted, event-driven pass.
- **`fullPopulationDispatcher.ts`** — proactive. Walks the account's entire
  screened-party population on a schedule, independent of whether any
  reference-data change occurred, as a periodic safety net.

Both dispatchers funnel into the same `outcomeRecorder.ts`, which calls the
canonical `rescreenParty()` and persists an `RdpsPartyOutcome` row per party
per run — so a delta-triggered result and a full-population result are
structurally identical and comparable.

## Data model

Additive migrations under `packages/db/prisma/migrations/`. Key models in
`packages/db/prisma/schema.prisma`:

| Table | Holds |
| --- | --- |
| `RdpsRun` | One dispatch execution — `RdpsRunType` (`DELTA_IMPACT` / `FULL_POPULATION`), status, counts, timestamps |
| `RdpsPartyOutcome` | One party's re-screen result within a run — prior vs. new status, evidence, whether the result worsened |
| `ReferenceDataChangeSet` | One denied-party list update event that a delta-impact run reacted to |

A worsening outcome (previously clear, now a hit/review) is what drives the
exception/audit flow — `rdpsRecallValidator.ts`
(`src/modules/agents/compliance/restrictedParty/`) validates that a worsened
result is correctly escalated rather than silently absorbed into a routine
"re-screened, still fine" outcome.

## UI and API surface

`RdpsPanel.tsx` (rendered inside `ComplianceWorkspaceClient.tsx` on the
Compliance workspace) surfaces run history and per-party outcomes. Eight API
routes back it, all under `withAuthenticatedRoute` so `accountId` is always
derived from the session — never a request parameter, matching the standing
tenant-isolation convention used across every compliance route.

## Export

`rdpsExport.ts` and `rdpsQueryService.ts` provide the same evidence-carrying
export pattern used by Community Screening — a downloaded run includes the
prior/new status and worsening flag per party, not just a pass/fail summary.

## Scheduling

`rdps-delta-impact-dispatch` (every 10 minutes), `rdps-full-population-dispatch`
(hourly), and `community-screening-dispatch` (every 2 minutes) are registered
in both `apps/custom/vercel.json` and `infrastructure/gcp/configure-scheduler.sh`,
and listed in the admin cron dashboard (`src/lib/admin/cronData.ts`). Until
this was added, both dispatchers were manual-trigger-only, so RDPS could not
be relied on as a continuous-monitoring control rather than an on-demand tool.
