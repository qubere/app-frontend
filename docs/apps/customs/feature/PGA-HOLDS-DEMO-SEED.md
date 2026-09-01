# PGA holds: demo data and runbook

Use this seed to populate **Today → Agency holds** and the **Agency holds** section on a shipment. It adds synthetic records to an existing shipment in an explicitly selected **DEMO** or **SANDBOX** account. It does not create accounts, alter roles, change shipment deadlines, run agents, or transmit messages.

## What the seed adds

| Agency | State | Age on first run | What to demonstrate |
| --- | --- | --- | --- |
| FDA | Open | 6 hours | Prepare a response; edit the lot number, save and reopen the draft. |
| USDA | Rejected | 48 hours | Open the previous simulated submission; correct the highlighted **Species scientific name** field. |
| EPA | Submitted | 24 hours | Show a recorded response awaiting agency action, with the simulated filing reference and message. |
| CPSC | Released | 72 hours | Select **Include released holds** on the shipment to see the completed history. |

The first run creates four holds, three submission-history records, and four audit entries. Three new open-work items appear in the holds API; the released hold is excluded unless `includeClosed=true` is paired with `shipmentId`. Existing holds can make the total higher.

All notices, reason codes, filed messages and response evidence are labeled **DEMO**. They are fictional workflow examples, not authoritative agency codes or an assessment of whether an agency regulates the selected shipment. No live agency notice or acceptance is implied.

## Localhost

1. Use a checkout containing this change. Before merge:

   ```bash
   git fetch origin
   git switch --track origin/codex/pga-holds-demo-seed
   ```

   If the branch already exists locally, use `git switch codex/pga-holds-demo-seed` followed by `git pull --ff-only`. After merge, use the updated `main` branch instead.

2. Install dependencies, generate the Prisma client and apply pending migrations using your development database configuration:

   ```bash
   npm ci
   npm --workspace @qubere/db run db:generate
   npm --workspace @qubere/db run db:migrate:deploy
   ```

   Prisma migration commands use the database package's environment / exported `DATABASE_URL` and `DIRECT_URL`. The seed loads **`apps/custom/.env*`** using the installed Next.js environment loader, with `next dev` precedence. Exported variables take precedence. Ensure both commands target the database used by your local app; generation alone does not apply migrations.

3. Copy the account ID from the selected workspace's API request or server log, and the shipment ID from `/app/shipments/<shipment-id>`. Use IDs from the same account. Preview:

   ```bash
   npm --workspace @qubere/custom run seed:pga-holds -- \
     --account-id YOUR_DEMO_ACCOUNT_ID \
     --shipment-id YOUR_DEMO_SHIPMENT_ID \
     --dry-run
   ```

4. Create the data by running the same command without `--dry-run`:

   ```bash
   npm --workspace @qubere/custom run seed:pga-holds -- \
     --account-id YOUR_DEMO_ACCOUNT_ID \
     --shipment-id YOUR_DEMO_SHIPMENT_ID
   ```

   `--user-id` can select an active member for the simulated submission's operator reference. Otherwise the earliest active account member is used. Audit events are attributed to the seed, not to an actual filing by that member.

5. If you regenerated Prisma, fully restart the dev server, then open the printed links:

   ```bash
   npm --workspace @qubere/custom run dev
   ```

   Sign in to the seeded account and click **Refresh holds** on Today. A browser reload is sufficient after seeding if the server already has the current Prisma client.

## GCP demo environment

The dedicated **`pga-demo-seed` Docker target** runs the same command in a one-off Cloud Run job. It builds from the repository's existing `source` stage, so scripts, dependencies and a generated Prisma client are included. It does not use the standalone web image, which does not contain the seed tooling.

Prerequisites:

- The GCP demo deployment is already configured, the API is deployed with PGA support, and migrations are applied to its database.
- The selected account is DEMO/SANDBOX and contains the shipment you will demonstrate. IDs can differ from localhost.
- Your `gcloud` identity can submit Cloud Builds, push to the existing Artifact Registry repository, deploy/execute Cloud Run jobs, and act as the job's runtime service account.
- The runtime service account has access to the selected demo database secrets, plus Cloud SQL Client if using a Cloud SQL socket connection. Use the demo deployment's service account and network settings.

Set these values in your terminal or Cloud Shell from the checked-out repository:

```bash
export GCP_PROJECT_ID="your-demo-project"
export GCP_REGION="us-west1"
export ARTIFACT_REPOSITORY="qubere-demo"
export RUNTIME_SERVICE_ACCOUNT="your-demo-runtime-account@your-demo-project.iam.gserviceaccount.com"
export PGA_ACCOUNT_ID="YOUR_GCP_DEMO_ACCOUNT_ID"
export PGA_SHIPMENT_ID="YOUR_GCP_DEMO_SHIPMENT_ID"
export PGA_APP_URL="https://your-customs-demo-host"

# Use the instance attached to your demo app when its DATABASE_URL uses /cloudsql/.
export CLOUD_SQL_CONNECTION_NAME="your-demo-project:us-west1:your-demo-instance"

# Only if the database uses a private IP reached through a VPC connector:
# export VPC_CONNECTOR="your-existing-demo-connector"
```

The defaults for the secret names are `qubere-demo-database-url` and `qubere-demo-direct-url`. Override `DATABASE_URL_SECRET` / `DIRECT_URL_SECRET` only if your demo deployment uses different names. These variables contain **secret names**, not database credentials. `PGA_APP_URL` only changes the printed navigation links.

Preview the intended records:

```bash
bash infrastructure/gcp/seed-pga-holds-demo.sh --dry-run
```

Then create them:

```bash
bash infrastructure/gcp/seed-pga-holds-demo.sh
```

Each invocation builds the seed image, deploys/updates `qubere-pga-seed-demo`, executes it once and reads its logs. A dry-run still builds and executes a job, but does not write database records. Nothing is scheduled, and the web service and migration job are not modified. `PGA_SEED_JOB` can override the seed job name; `PGA_USER_ID` is optional.

The seed job has its own development/demo runtime and only the database secrets. Production web services retain `NODE_ENV=production`. The shared seed safety guard remains in effect; an explicitly production environment or a PRODUCTION account is rejected. Do not change a production account's data mode to run the demo.

For Cloud SQL Unix sockets, `CLOUD_SQL_CONNECTION_NAME` attaches the instance; for private-IP databases, supply the existing VPC connector and route as required by your deployment. External database endpoints can omit both. Inspect the current demo service's Cloud SQL/network settings rather than guessing them. Connection failures are not fixed by changing account permissions.

GCP command references: [deploy a Cloud Run job](https://docs.cloud.google.com/sdk/gcloud/reference/run/jobs/deploy), [read job logs](https://docs.cloud.google.com/sdk/gcloud/reference/run/jobs/logs/read).

## Verify and demonstrate

1. Sign in to the selected account. Open `/api/pga/holds?shipmentId=<id>`: a fresh seed contributes Open, Rejected and Submitted holds.
2. Open `/app/actions`. **Agency holds → Resolve hold** opens the shipment drawer.
3. Use FDA to show draft recovery, USDA to show a correction highlighted against preserved evidence, and EPA to show the distinction between recorded filing and agency acceptance.
4. On the shipment, check **Include released holds** to show CPSC's completed history. The API equivalent is `/api/pga/holds?shipmentId=<id>&includeClosed=true`.
5. Explain that these are synthetic examples. The feature records manual filing and response evidence; live ACE/PGA transport is not part of this seed or this demo flow.

Visibility still requires `pga.read`. Preparing a response requires `pga.update`; recording a filing/response requires `pga.approve`; portfolio filters use `pga.review`. The seed does not grant any permissions.

## Reruns and troubleshooting

- References are stable per account, shipment and scenario. Rerunning preserves saved drafts, corrected values, statuses and history; it does not refresh timestamps or reopen released holds. Use a different demo shipment for a fresh walkthrough. No destructive reset is provided.
- `db.pgaHold` undefined: regenerate Prisma and restart the app. The CLI gives a specific error if its own generated client lacks PGA models.
- Missing table/column: apply migrations to the database used by the seed. The CLI identifies Prisma P2021/P2022 errors.
- Account/shipment not found: check the database and selected account; no cross-account fallback is performed.
- Seed refused: the shared environment guard or the account's data mode is blocking it. Use the intended demo environment; production seeding is not supported.
- Nothing on Today: verify the logged-in account and `pga.read`, then check whether your demo holds were already released. Reruns keep that progress.

Focused checks:

```bash
npm --workspace @qubere/custom run test -- tests/pga-holds-demo-seed.test.ts
PGA_ASSIST_INTEGRATION=1 npm --workspace @qubere/custom run test -- tests/pga-holds-demo-seed.integration.test.ts
```

The PostgreSQL test requires a disposable `localhost/qubere_test` database with migrations applied. It verifies actual writes, dry-run, tenant rejection, rerun preservation and transaction rollback. Fixtures are retired rather than deleted because audit history is append-only. No live GCP deployment is performed by the tests.
