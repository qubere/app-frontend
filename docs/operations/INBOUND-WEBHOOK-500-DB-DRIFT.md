# Incident hand-off: inbound Resend webhook returning 500 (demo)

**Status:** open — `qubere-customs-demo` `/api/webhooks/resend/inbound` returns HTTP 500 on
every `email.received` event as of 2026-09-04 ~02:00 UTC.
**Owner action:** Antigravity to run the fix below against the **demo** environment
(`qubere-demo` GCP project). Not prod.

---

## Symptom

Resend delivery log shows our endpoint responding:

```json
{"error":{"code":"INTERNAL_ERROR","message":"Internal server error","requestId":"req_mtma32sd_iihd423"}}
```

That envelope is **our own** `handleApiError` output (`packages/auth/src/error.ts`),
`req_<base36>_<rand>` is our `generateRequestId()`. So Resend is healthy; the 500 is ours.

## Root cause — migration history drift on the demo DB

Runtime error from `qubere-customs-demo` logs (still firing at 02:00:12 UTC):

```
prisma:error
Invalid `prisma.inboundAddress.findFirst()` invocation:
The column `InboundAddress.autoAttachPolicy` does not exist in the current database.
code: 'P2022'
```

Path: `route.ts` → `resolveInboundAddress()` → `db.inboundAddress.findFirst()` selects
`autoAttachPolicy`; column missing → Prisma throws `P2022` → non-`P2002` → `throw error`
at `apps/custom/src/app/api/webhooks/resend/inbound/route.ts:141` → 500.

Migration [`packages/db/prisma/migrations/20260903170000_inbound_body_llm_match_autoattach/migration.sql`](../../packages/db/prisma/migrations/20260903170000_inbound_body_llm_match_autoattach/migration.sql)
adds three columns:

| table | column | definition |
|---|---|---|
| `InboundEmail` | `bodyText` | `TEXT` (nullable) |
| `DocumentShipmentCandidate` | `reasoning` | `TEXT` (nullable) |
| `InboundAddress` | `autoAttachPolicy` | `TEXT NOT NULL DEFAULT 'CONFIDENT'` |

The demo DB (`qubere_db` @ `10.98.0.3`, Cloud SQL `qubere-demo:us-west1:qubere-demo-instance`)
has a **row in `_prisma_migrations` marking `20260903170000` as applied** (so
`prisma migrate deploy` reports *"No pending migrations to apply"* — confirmed in job
execution `qubere-migrate-demo-vn9dm`, 2026-09-04 01:37 UTC), **but the `ALTER TABLE`
statements never actually ran**. The three columns do not exist.

Likely how it got marked applied without running: a `prisma migrate resolve --applied`
(or the since-deleted `apps/custom/src/app/api/admin/run-migration/route.ts`) was used to
unblock a deploy, with the DDL meant to be applied separately — and the separate step
never succeeded (see next).

### The existing band-aid is broken

The `qubere-migrate-demo` Cloud Run **job has been overridden** away from its normal
`npx prisma migrate deploy` command. It currently runs:

```
command: ["node"]
args: ["-e", "... db.$executeRawUnsafe('ALTER TABLE \"InboundEmail\" ADD COLUMN IF NOT EXISTS \"bodyText\" TEXT; ALTER TABLE \"DocumentShipmentCandidate\" ... ; ALTER TABLE \"InboundAddress\" ...;') ..."]
```

That fails every run with:

```
Raw query failed. Code: `42601`. Message: `ERROR: cannot insert multiple commands into a prepared statement`
```

`$executeRawUnsafe` cannot run three `;`-separated statements in one call, and the script
swallows the error (`.catch(console.error)`) and `exit(0)`, so the deploy pipeline goes
green while the columns are still missing. Executions `qubere-migrate-demo-54hpz` /
`-w7fp5` (01:57–01:59 UTC) both no-op'd this way.

## App version — OK, no redeploy needed for the fix

Deployed image `us-west1-docker.pkg.dev/qubere-demo/qubere-demo/customs-web:4739c904`
(revision `qubere-customs-demo-00115`) = squash merge **PR #313** *"Feat/inbound llm
matching and parser hardening"*. It contains the LLM-matching route, the schema fields,
and the migration file. `origin/feat/inbound-llm-matching-and-parser-hardening` (`b404d7ad`)
is nominally 3 commits ahead but `git diff 4739c904..b404d7ad` is 4 trivial files
(deletes the temp `run-migration` route + minor `.tsx` copy) — nothing relevant. **The
application code is fine. This is purely a DB-state fix.**

---

## Fix (demo only)

### Step 1 — apply the three columns for real

Preferred: fix the job to run each statement separately, execute once, verify.

```bash
PROJECT=qubere-demo
REGION=us-west1

SCRIPT='const{PrismaClient}=require("@prisma/client");const db=new PrismaClient();
const stmts=[
 `ALTER TABLE "InboundEmail" ADD COLUMN IF NOT EXISTS "bodyText" TEXT`,
 `ALTER TABLE "DocumentShipmentCandidate" ADD COLUMN IF NOT EXISTS "reasoning" TEXT`,
 `ALTER TABLE "InboundAddress" ADD COLUMN IF NOT EXISTS "autoAttachPolicy" TEXT NOT NULL DEFAULT '"'"'CONFIDENT'"'"'`
];
(async()=>{for(const s of stmts){console.log("RUN",s);await db.$executeRawUnsafe(s);}
 const c=await db.$queryRawUnsafe(`select table_name||'"'"'.'"'"'||column_name c from information_schema.columns where (table_name='"'"'InboundAddress'"'"' and column_name='"'"'autoAttachPolicy'"'"') or (table_name='"'"'InboundEmail'"'"' and column_name='"'"'bodyText'"'"') or (table_name='"'"'DocumentShipmentCandidate'"'"' and column_name='"'"'reasoning'"'"')`);
 console.log("PRESENT",JSON.stringify(c));
})().catch(e=>{console.error(e);process.exit(1);}).finally(()=>db.$disconnect());'

gcloud run jobs update qubere-migrate-demo --project=$PROJECT --region=$REGION \
  --command=node --args="-e,$SCRIPT"

gcloud run jobs execute qubere-migrate-demo --project=$PROJECT --region=$REGION --wait
```

Expect the tail to show all three in `PRESENT`.

Alternative (equivalent, if you have `psql`/Cloud SQL access): run the three
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` statements directly against `qubere_db`.

### Step 2 — check for wider drift

`20260903170000` was marked applied-without-running; confirm no other recent migration
is in the same state. From a checkout of the deployed commit (`4739c904`):

```bash
# generates SQL for everything the DB is still missing vs the committed schema
npx prisma migrate diff \
  --from-url "$DIRECT_URL_FOR_DEMO" \
  --to-schema-datamodel packages/db/prisma/schema.prisma \
  --script
```

`$DIRECT_URL_FOR_DEMO` = value of secret `qubere-demo-direct-url`
(`postgresql://postgres:***@10.98.0.3:5432/qubere_db?sslmode=disable` — reachable only
from inside the VPC / via the Cloud SQL connector, so run this from a Cloud Run job or
Cloud Shell with the proxy, not a laptop).

Empty output = DB matches schema, done. Any output = apply it, then re-run to confirm empty.

### Step 3 — restore the migrate job to its real command

So the next pipeline run does real migrations, not the band-aid:

```bash
gcloud run jobs update qubere-migrate-demo --project=$PROJECT --region=$REGION \
  --command=npx \
  --args="prisma,migrate,deploy,--schema=packages/db/prisma/schema.prisma"
```

(Matches `Dockerfile` `database` target `CMD` and
`infrastructure/gcp/cloudbuild.demo.yaml` `run-migrations` step intent.)

### Step 4 — verify recovery

- Hit the endpoint / watch logs: no more `P2022` / `[API Error]` on
  `qubere-customs-demo` for `resend/inbound`.
  ```bash
  gcloud logging read 'resource.labels.service_name="qubere-customs-demo" textPayload:"resend/inbound"' \
    --project=qubere-demo --freshness=15m --limit=20
  ```
- In the **Resend dashboard**, re-deliver the stuck message
  `Re: SHP-TGT-2026-001` from `janeilohani@gmail.com` →
  `docs-lbe7ec6u3e3blosk@inbound.qubere.ai` (email_id
  `19ca186d-a4ad-4b64-a9a8-0549039223a5`, received 2026-09-04T01:26:20Z). The original
  webhook retries have likely lapsed.
- Confirm the resulting `InboundEmail` row processes and the
  `SHP-TGT-2026-001-fifth.PDF` attachment lands / matches.

## Guardrail to add (optional, follow-up)

The webhook throwing 500 on a Prisma error means Resend keeps retrying and the failure is
invisible unless someone reads logs. Consider: on unexpected `create`/lookup failure,
still persist a minimal `InboundEmail` row (or a dead-letter record) and return 202, so
schema drift degrades to "quarantined, needs attention" instead of a retry storm.
