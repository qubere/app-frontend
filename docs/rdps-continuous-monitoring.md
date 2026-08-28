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
| `RdpsRun` | One dispatch execution — `RdpsRunType` (`DELTA_IMPACT` / `FULL_POPULATION` / `TARGETED` / `MANUAL`), status, counts, timestamps |
| `RdpsPartyOutcome` | One party's re-screen result within a run — prior vs. new status, `transitionType`, `triggeringChangeSetIds`, evidence, whether the result worsened |
| `ReferenceDataChangeSet` | One denied-party list update event — `changeType` `ADDED` / `UPDATED` / `SUPERSEDED` / `EXPIRED` |

A worsening outcome (previously clear, now a hit/review) is what drives the
exception/audit flow — `rdpsRecallValidator.ts`
(`src/modules/agents/compliance/restrictedParty/`) validates that a worsened
result is correctly escalated rather than silently absorbed into a routine
"re-screened, still fine" outcome.

### Reference-data change types

`ReferenceDataChangeSet.changeType` distinguishes four ways a denied-party
list entity can change, so downstream consumers (reference-data health, the
Reference Changes UI, delta-impact dispatch) never conflate them:

| `changeType` | Written by | Meaning |
| --- | --- | --- |
| `ADDED` | Every ingestion service | A brand-new entity appeared in the feed |
| `UPDATED` | Every ingestion service | An existing, still-active entity's fields changed |
| `SUPERSEDED` | Full-load sweep-by-omission (OFAC/BIS/UFLPA), or an explicit delist/ActiveStatus flip in a Dow Jones delta feed | The source stopped listing this entity, or explicitly delisted it |
| `EXPIRED` | `referenceDataExpirySweep.ts` (hourly cron, `reference-data-expiry-sweep` dataset id) | The entity's *own* `expirationDate` elapsed while it was still present/active in every feed — a case none of the ingestion services would otherwise ever catch, since they only supersede on omission or an explicit delist |

### Transition classification

`recordRdpsOutcome` (`outcomeRecorder.ts`) classifies every outcome's
previous → new status pair via `classifyRdpsTransition()` into one
`transitionType`:

`UNCHANGED_CLEAR` / `UNCHANGED_REVIEW` / `UNCHANGED_HIT`, `NEW_REVIEW` /
`NEW_HIT`, `ESCALATED` (specifically `REVIEW_REQUIRED` → `HIT`),
`RISK_REDUCED` / `CLEARED` (risk decreased), and `ERROR` / `SKIPPED` /
`PARTIAL` (passthrough for non-determinate rescreen outcomes — never
silently reclassified as a risk tier). A party with no prior summary is
treated as a `CLEAR` baseline, so a first-ever `HIT`/`REVIEW_REQUIRED` still
classifies as `NEW_*`, not `UNCHANGED_*`.

### Per-change-set impact attribution

`RdpsPartyOutcome.triggeringChangeSetIds: String[]` records which
`ReferenceDataChangeSet` row(s) caused a party to be re-screened as a
DELTA_IMPACT candidate — populated by `deltaImpactDispatcher.ts`, always
empty for `FULL_POPULATION`/`MANUAL`/`TARGETED` runs. This is what backs the
per-change-set Impacted Parties drill-down below; it is attribution only and
is never used to re-derive a match (that logic lives solely in
`impactAnalysis.ts`).

## Preview Impact (read-only)

`previewReferenceChangeImpact()` (`rdpsQueryService.ts`) answers "which
parties would this reference-data change match today?" without mutating
anything — it reuses the exact same `buildPartyIdentityIndex()` +
`findImpactedParties()` logic the delta-impact dispatcher uses (never a
second matcher), but never creates an `RdpsRun`, never writes an
`RdpsPartyOutcome`, and never calls `rescreenParty()`. Candidates are
enriched with each party's *last known* screening status only — never a
freshly computed one, since computing one would itself mutate
`PartyScreeningSummary`. Backed by
`POST /api/compliance/rdps/reference-changes/[id]/preview-impact` and
surfaced as a "Preview Impact" modal per change row in `RdpsPanel.tsx`.

## UI and API surface

`RdpsPanel.tsx` (rendered inside `ComplianceWorkspaceClient.tsx` on the
Compliance workspace) surfaces run history, per-party outcomes, reference
data changes (with a Preview Impact action and an Impacted Parties
drill-down per change), and reference-data health. All API routes are under
`withAuthenticatedRoute` so `accountId` is always derived from the session —
never a request parameter, matching the standing tenant-isolation convention
used across every compliance route. Two additions on top of the original
eight:

- `GET /api/compliance/rdps/reference-changes/[id]/impacts` — paginated list
  of `RdpsPartyOutcome` rows whose `triggeringChangeSetIds` contains this
  change-set id (`listImpactsForChange()`).
- `POST /api/compliance/rdps/reference-changes/[id]/preview-impact` — the
  read-only preview above.

## Export

`rdpsExport.ts` and `rdpsQueryService.ts` provide the same evidence-carrying
export pattern used by Community Screening — a downloaded run includes the
prior/new status and worsening flag per party, not just a pass/fail summary.

## Reference-data health

`getReferenceDataHealth()` rolls up, per known dataset (OFAC SDN, BIS CSL,
UFLPA, Dow Jones full/delta, and the `reference-data-expiry-sweep` sweep
dataset), the last import's status/error, the last *successful* import's
published version and record count, and that dataset's own latest run's
Added/Updated/Removed/Expired counts — never cumulative across all prior
runs, and never mixed across datasets. Surfaced via
`GET /api/compliance/rdps/reference-data-health` and the "Reference Data
Health" sub-tab in `RdpsPanel.tsx`.

## Scheduling

`rdps-delta-impact-dispatch` (every 10 minutes), `rdps-full-population-dispatch`
(hourly), `reference-data-expiry-sweep` (hourly, `sweepExpiredReferenceData()`),
and `community-screening-dispatch` (every 2 minutes) are registered in both
`apps/custom/vercel.json` and `infrastructure/gcp/configure-scheduler.sh` (the
GCP Cloud Scheduler config is authoritative in production; `vercel.json`'s
`crons` array is dead config now that the app deploys to GCP, kept only so the
two files stay in sync for local reference), and listed in the admin cron
dashboard (`src/lib/admin/cronData.ts`).
