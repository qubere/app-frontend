# Actions read-path performance

Scope: `/app/actions` and the exception list that feeds it. Tracks the
audit, the changes made, how to measure, and what is left.

Branch: `perf/actions-read-path` (PR #94).

---

## 1. Real request path

`/app/actions` is a **React Server Component that queries Prisma directly** —
it does *not* call `/api/exceptions`. The `/api/exceptions` route exists for
external API consumers and the assistant's `list_exceptions` tool.

```
Browser GET /app/actions
└─ apps/custom/src/app/app/actions/page.tsx           (export const dynamic = "force-dynamic")
   ├─ getAccountContext()                             auth + account/dataMode resolution (Clerk + DB)
   ├─ withDataModeContext(dataMode, …)                tenant/dataMode AsyncLocalStorage scope
   │  └─ Promise.all([
   │     ├─ db.agentDecision.findMany   take:200  select+nested shipment/broker/client/reviewer, evidenceItems JSON
   │     ├─ db.shipmentDocument.findMany take:200  select+nested shipment
   │     ├─ db.exceptionItem.findMany    take:200  status IN openStatusVariants(), select+nested shipment/broker/client/assignee
   │     ├─ canWrite(context)                      (sync)
   │     └─ hasPermission(RISK_ACCEPTANCE_PERMISSION)
   │    ])
   │  └─ loadWorkQueueForAccountFromPrefetched(…)     +2 queries: customsFiling.findMany, complianceDeadline.findMany
   ├─ groupDecisions / buildShipmentActionGroups / buildWorkQueue   (in-memory)
   └─ <ActionsClient …/>                              "use client", ~69 KB source, hydrates the whole tree
      └─ ExceptionSlideOver (dynamic, ssr:false)      on open: GET /api/exceptions/:id  (full record)

Browser GET /api/exceptions            (external consumers + assistant only)
└─ apps/custom/src/app/api/exceptions/route.ts
   └─ withAuthenticatedRoute → ExceptionService.listExceptions(accountId, userId, query, pagination)
      └─ db.exceptionItem.findMany  →  PostgreSQL  →  JSON serialize  →  response
```

### Findings

| # | Finding | Location |
|---|---|---|
| A | `/api/exceptions` list paged on `where.id < cursor` while ordering by `createdAt DESC` — cursor order ≠ sort order, so pages could repeat or drop rows. | `exception.service.ts` `listExceptions` (pre-change) |
| B | List returned full `shipment` / `filing` / `assignedToUser` records via `include: true`. | same |
| C | List ran `db.exceptionItem.count({ where: { accountId } })` on **every** page. | same |
| D | Severity filter used `mode: "insensitive"` (ILIKE, non-sargable) on a known 4-value enum-like column. | same |
| E | `/app/actions` page does **6 DB round trips after auth** (4 in the `Promise.all`, 2 in the prefetched work-queue loader), each `take: 200`. The plan's target is ≤ 2 for the initial screen. | `page.tsx` |
| F | The page ships `evidenceItems` (unbounded JSON) and full descriptions for up to 200 decisions in the initial RSC payload. | `page.tsx` `agentDecision` select |
| G | `ActionsClient.tsx` is one ~69 KB client component; the entire Actions UI hydrates before it is interactive, and there is no Suspense boundary between the page shell and the data. | `ActionsClient.tsx`, `page.tsx` |
| — | No seed-on-GET was found in the Actions/exceptions read path (the plan anticipated one). No GET writes exist here today. | verified by grep |

---

## 2. Baseline

**Not measured in warm production.** This branch was developed against a
checkout with no local Postgres and only a shared remote demo database, which
is not a safe or representative benchmark target. The numbers below are
**structural** (counts, payload composition, query shape) established by
reading the code and the schema; latency/Web-Vitals targets require the
`bench:actions` script (§5) against a disposable Postgres, and Cloud SQL Query
Insights after the GCP move.

| Metric | Baseline (structural) | After this branch | Target |
|---|---|---|---|
| DB round trips, `/api/exceptions` list | 2 (findMany + count) | 1 (findMany), or 2 with `?withCount=true` | — |
| DB round trips, `/app/actions` initial screen | 6 | 6 *(unchanged — see §7)* | ≤ 2 |
| `/api/exceptions` list projection | full `shipment`+`filing`+`assignedToUser` rows | id + label fields only | narrow DTO |
| `/api/exceptions` page size | default 50, max 200, offset-ish | default 25, max 100, keyset | 25 / 100 |
| Cursor correctness | broken (id vs createdAt) | total order `(createdAt DESC, id DESC)` | stable |
| Writes from GET | none | none | none |

---

## 3. Changes on this branch

### `perf(exceptions): keyset pagination + narrow list projection` (`0789201`)

- **`src/lib/api/keysetCursor.ts`** (new) — opaque base64url `(createdAt, id)`
  cursor. `encodeCursor` / `decodeCursor` (throws `InvalidCursorError` on any
  malformed token), `keysetWhere` (the `OR` predicate for "strictly after this
  point" under `createdAt DESC, id DESC`), `KEYSET_ORDER_BY`, `sliceKeysetPage`
  (fetch-N+1 → `hasMore` without a COUNT).
- **`ExceptionService.listExceptions`** — keyset pagination; `EXCEPTION_LIST_SELECT`
  narrow projection; default 25 / hard cap 100 / floor 1; `normalizeExceptionSeverity`
  maps any casing → canonical `Critical|High|Medium|Low` then exact-equals (no
  ILIKE); unknown severity → `{ in: [] }` (narrows, never widens); `withCount`
  opt-in; filtered COUNT (`where`) not account-wide.
- **`src/app/api/exceptions/route.ts`** — `limit` bounded/coerced at the zod
  boundary; `withCount` query param; `InvalidCursorError` → `400 INVALID_CURSOR`;
  `Server-Timing` response header.
- **`src/lib/perf/serverTiming.ts`** (new) — `PerfTimer` span collector →
  `Server-Timing` header + structured-log fields. Records span **names and
  durations only** — no SQL text, parameters, row data, or PII.
- **`list_exceptions` assistant tool** — pinned to `limit: 50` to preserve its
  prior behaviour.

### `perf(db): ExceptionItem indexes` (`b60d552`)

Migration `20260827120000_actions_exception_list_indexes` + schema `@@index`.

### `test(exceptions): …` (`91196d9`)

`tests/actions-exception-list.test.ts` — 32 cases (see §5).

---

## 4. Indexes added and the queries they serve

| Index | Query it supports |
|---|---|
| `ExceptionItem(accountId, createdAt)` | Default Actions/exception list: `WHERE accountId = $1 ORDER BY createdAt DESC, id DESC LIMIT n` (keyset). Prefix `accountId` + `createdAt` range scan, read backwards. |
| `ExceptionItem(accountId, assignedToUserId, createdAt)` | "Assigned to me": `WHERE accountId = $1 AND assignedToUserId = $2 ORDER BY createdAt DESC, id DESC`. |

Already present, still relied on:

| Index | Query |
|---|---|
| `ExceptionItem(accountId, status, createdAt)` (migration `20260826210000`) | Status-filtered list, and the page's `status IN openStatusVariants()` read. |

**Not added:** a severity index — deferred until production-like measurement
shows the `(accountId, …)` scans are still too slow with a severity predicate.
The `id` tiebreak column is not in the index; `createdAt` collisions are rare
(cuid + `now()`), and Postgres resolves the tiebreak cheaply within a
same-timestamp block. Add `(accountId, createdAt, id)` if `EXPLAIN` shows a
sort node on the tiebreak under load.

### Verifying the plan (run after `migrate deploy` on a seeded DB)

```
npx tsx scripts/bench-actions.ts --explain
```

Expect `Index Scan Backward using "ExceptionItem_accountId_createdAt_idx"` (and
the `assignedToUserId` variant), **no** `Sort` node, and `Limit` stopping after
~26 rows regardless of table size.

---

## 5. Tests & how to run them

```
# unit (no DB) — 32 cases
cd apps/custom && npx vitest run tests/actions-exception-list.test.ts

# existing exception suites still green
npx vitest run tests/exception-resolution.test.ts tests/exception-risk-acceptance.test.ts tests/exceptions-bulk.test.ts

# typecheck / lint
npx tsc --noEmit          # 2 pre-existing unrelated errors: missing @qubere/cloud-runtime, nodemailer
npx eslint src/lib/api/keysetCursor.ts src/lib/perf/serverTiming.ts src/app/api/exceptions/route.ts src/modules/exceptions/exception.service.ts scripts/bench-actions.ts tests/actions-exception-list.test.ts

# schema / migration
npx prisma validate --schema packages/db/prisma/schema.prisma
npx prisma migrate diff --from-empty --to-schema-datamodel packages/db/prisma/schema.prisma --script | grep ExceptionItem_accountId
```

`tests/actions-exception-list.test.ts` covers: cursor round-trip + opaqueness,
7 malformed-cursor cases, severity normalisation, default/cap/floor page size,
`(createdAt DESC, id DESC)` ordering, narrow select (no `include`, no
`resolutionReasonCode`), account scoping, `assignedToMe`, index-friendly
severity equality, unknown-severity → empty, cursor → keyset predicate,
malformed cursor → `InvalidCursorError`, `hasMore`/`nextCursor` via the N+1
probe, `withCount` opt-in + filtered total, and the duplicate-timestamp page
boundary (no skip, no repeat).

### Benchmark (`bench:actions`)

Requires a **disposable** Postgres via `BENCH_DATABASE_URL` (refuses to run if
it equals `DATABASE_URL`).

```
export BENCH_DATABASE_URL=postgresql://localhost:5432/qubere_bench
DATABASE_URL=$BENCH_DATABASE_URL DIRECT_URL=$BENCH_DATABASE_URL \
  npx prisma migrate deploy --schema packages/db/prisma/schema.prisma

cd apps/custom
npx tsx scripts/bench-actions.ts --seed 10000     # tenant A: 10k, tenant B: 1k, mixed sev/status/assignee, colliding timestamps
npx tsx scripts/bench-actions.ts --iterations 200 # p50/p95 for page 1 and page ~40, query count, payload KB, rows
npx tsx scripts/bench-actions.ts --explain        # EXPLAIN (ANALYZE, BUFFERS)
```

Reports p50, p95, SQL queries/page, payload size, rows returned. Keep it out
of the unit suite (no wall-clock assertions there).

---

## 6. Behaviour changes (documented per the plan's "don't change visible behaviour without documenting it")

`GET /api/exceptions` (list only — the `/:id` detail endpoint is unchanged):

1. **`exceptions[].shipment` / `.filing` / `.assignedToUser`** are now
   `{ id, … label fields }` instead of the full related records. Full data is
   at `GET /api/exceptions/:id`. Known consumers (`list_exceptions` assistant
   tool) only read `shipment.shipmentNumber` and scalars — unaffected.
2. **`pagination.total`** is `null` unless `?withCount=true`. When requested it
   is now the **filtered** count, not the account-wide count.
3. **Default page size 50 → 25; max 200 → 100.**
4. **`cursor`** is now an opaque `(createdAt, id)` token, not a bare id. A
   malformed cursor returns `400 INVALID_CURSOR` instead of silently starting
   from the top.
5. **`severity`** filter is now an exact case-normalised match; a value that is
   not a known severity returns no rows (previously an ILIKE that could match
   unexpected rows).
6. New `Server-Timing` response header.

Not changed: tenant/account scoping, `withDataModeContext` isolation, auth,
permissions, audit logging, sort direction, the `/:id` detail route, the
`/api/actions` route, or `/app/actions` rendering.

---

## 7. Remaining work / risks

**Not done on this branch:**

- **`/app/actions` still does 6 DB round trips.** Collapsing to ≤ 2 means
  reshaping `page.tsx` + the work-queue builders (a combined actionable-items
  query, or a shared server service the page and `/api/actions` both call).
  Higher blast radius — deferred to its own change. Must preserve
  `withDataModeContext` (page comment: queries "silently default to PRODUCTION
  isolation" without it).
- **Payload / bundle (findings F, G).** Drop `evidenceItems` from the initial
  page payload (load per-card or on slide-over open); add `loading.tsx` +
  Suspense so the shell/filters/skeleton paint before the queue resolves; split
  `ActionsClient.tsx`. First-render / LCP targets depend on this.
- **Baseline & final measurements.** No warm-prod numbers — see §2. Run
  `bench:actions` + Query Insights and fill in the §2 table.
- **`EXPLAIN` before/after** against a seeded DB (script ready, DB not available
  in this environment).
- **Migration not applied to a disposable DB** here (no local Postgres). Names
  verified against Prisma's canonical output; `prisma validate` passes.
- Other endpoints in the plan (compliance audit list/detail, shipment detail,
  bonds, drawback, drawback matching, reconciliation) — untouched.
- GCP Cloud SQL / Cloud Run sizing doc — not started.

**Risks:**

- External `/api/exceptions` consumers outside this repo that depended on the
  full relation objects or the always-present `total` will see the §6 changes.
  Mitigation: `?withCount=true` restores the total; detail endpoint restores
  full relations.
- `CREATE INDEX` (not `CONCURRENTLY`) takes a brief `ACCESS EXCLUSIVE` lock; on
  a large production `ExceptionItem` table run the `CONCURRENTLY` form
  out-of-band and mark the migration applied (noted in the migration file).

---

## 8. Environment & limitations

- Dev checkout: no local Postgres (`pg_ctl`/`initdb` absent, no Docker); only a
  shared remote demo DB, unsafe to benchmark or migrate against.
- Prisma 6.19.3. `npm install` state is incomplete in this checkout
  (`@qubere/cloud-runtime`, `nodemailer` unresolved) — pre-existing, unrelated.
- Concurrent automated tooling was active in the working tree during
  development; commits were reconstructed onto this branch and verified with
  `tsc` / `eslint` / `vitest` / `prisma validate`.
