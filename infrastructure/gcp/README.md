# GCP demo deployment (Customs)

This deploys the Customs Next.js application to Cloud Run while leaving the
current Vercel deployment unchanged. The GCP deployment uses:

- a Cloud Run service for the web application;
- a Cloud Run worker pool for continuous document processing;
- a Cloud Run job for Prisma migrations;
- a private Google Cloud Storage bucket for documents and generated artifacts;
- Secret Manager for runtime credentials; and
- Cloud Scheduler for the routes currently scheduled by `apps/custom/vercel.json`.

The scripts do not create external resources or DNS records. Complete the setup
below, then run the deployment script.

## 1. Choose an isolated demo environment

Use a new hostname, for example `gcp-demo.example.com`, and a **separate demo
database** cloned or seeded to approximately the same size as the existing
environment.

Do not point the first deployment at production. The deployment script runs
`prisma migrate deploy`, and a shared database would also mix GCS-backed document
rows with Vercel-Blob-backed rows. Keeping the databases separate lets both
deployments run simultaneously without cross-cloud file credentials or competing
workers.

Pick the GCP region nearest the database and intended testers. The examples use
`us-west1`.

## 2. Create the Google Cloud resources

Authenticate `gcloud`, select a billed project, and set these shell variables:

```bash
gcloud auth login
gcloud auth application-default login

export GCP_PROJECT_ID="your-project-id"
export GCP_REGION="us-west1"
export GCS_BUCKET="${GCP_PROJECT_ID}-qubere-demo-documents"
export RUNTIME_SERVICE_ACCOUNT="qubere-demo-runtime@${GCP_PROJECT_ID}.iam.gserviceaccount.com"

gcloud config set project "${GCP_PROJECT_ID}"
```

Enable the APIs and create a dedicated runtime identity:

```bash
gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  cloudscheduler.googleapis.com \
  iamcredentials.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com

gcloud iam service-accounts create qubere-demo-runtime \
  --display-name="Qubere GCP demo runtime"
```

Create a private regional bucket. Keep public access prevention enabled; the app
streams documents through authenticated routes and creates short-lived signed
URLs only when a parser needs one.

```bash
gcloud storage buckets create "gs://${GCS_BUCKET}" \
  --location="${GCP_REGION}" \
  --uniform-bucket-level-access \
  --public-access-prevention

gcloud storage buckets add-iam-policy-binding "gs://${GCS_BUCKET}" \
  --member="serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
  --role="roles/storage.objectAdmin"
```

Allow the runtime to read secrets and sign short-lived GCS download URLs:

```bash
gcloud projects add-iam-policy-binding "${GCP_PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

gcloud iam service-accounts add-iam-policy-binding "${RUNTIME_SERVICE_ACCOUNT}" \
  --member="serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
  --role="roles/iam.serviceAccountTokenCreator"
```

The human or CI identity running deployment also needs Cloud Build Editor,
Cloud Run Admin, Artifact Registry Admin, Service Account User on the runtime
identity, and permission to view Secret Manager metadata. Prefer granting these
through your existing deployment group rather than directly to a user.

Cloud Build's default service account needs Artifact Registry write and logging
permissions. Identify it and grant only those roles if they are not already
present:

```bash
BUILD_SERVICE_ACCOUNT="$(gcloud builds get-default-service-account)"

gcloud projects add-iam-policy-binding "${GCP_PROJECT_ID}" \
  --member="serviceAccount:${BUILD_SERVICE_ACCOUNT}" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding "${GCP_PROJECT_ID}" \
  --member="serviceAccount:${BUILD_SERVICE_ACCOUNT}" \
  --role="roles/logging.logWriter"
```

## 3. Add runtime secrets

Create these Secret Manager secrets. Use a password manager or the Google Cloud
console so values do not enter shell history.

| Secret name | Runtime variable | Notes |
| --- | --- | --- |
| `qubere-demo-database-url` | `DATABASE_URL` | Pooled demo PostgreSQL URL |
| `qubere-demo-direct-url` | `DIRECT_URL` | Direct demo PostgreSQL URL for migrations |
| `qubere-demo-clerk-secret-key` | `CLERK_SECRET_KEY` | Clerk instance used by the demo hostname |
| `qubere-demo-gemini-api-key` | `GEMINI_API_KEY` | Google Gemini API key |
| `qubere-demo-cron-secret` | `CRON_SECRET` | New random value, at least 32 bytes |
| `qubere-demo-docling-api-key` | `DOCLING_API_KEY` | Credential for the configured Docling endpoint |

To create a value without placing it on the command line:

```bash
read -rsp "Secret value: " SECRET_VALUE; echo
printf %s "${SECRET_VALUE}" | gcloud secrets create qubere-demo-database-url \
  --replication-policy=automatic \
  --data-file=-
unset SECRET_VALUE
```

For an existing secret, add a version instead:

```bash
printf %s "${SECRET_VALUE}" | gcloud secrets versions add SECRET_NAME --data-file=-
```

Optional integrations are attached automatically when these secrets exist:
`qubere-demo-anthropic-api-key`, `qubere-demo-resend-api-key`,
`qubere-demo-resend-webhook-secret`, `qubere-demo-inngest-event-key`,
`qubere-demo-inngest-signing-key`, `qubere-demo-cbp-filer-code`, and
`qubere-demo-cbp-filer-password`.

The demo deliberately sets `CUSTOMS_FILING_MOCK_RESPONSES=true`. Do not use it
for real filing.

## 4. Configure the external applications

Before building, configure the new hostname in Clerk and add its sign-in,
sign-up, and callback URLs. Use a separate Clerk development instance if the
current production instance cannot safely accept the demo origin.

The previous TMS Next.js configuration contained a hard-coded Clerk secret
fallback. This branch removes it, but removal does not erase Git history. Revoke
and rotate that Clerk secret in the Clerk dashboard, then configure both apps
through Secret Manager or their hosting environment.

If enabling inbound email or Inngest, use separate demo endpoints/environments.
Do not move the existing Vercel webhook during a side-by-side test.

You also need the base URL of the IBM Docling-compatible parser service. The
Cloud Run service and worker must be able to reach it.

## 5. Build and deploy

From the repository root on this branch:

```bash
export GCP_PROJECT_ID="your-project-id"
export GCP_REGION="us-west1"
export GCS_BUCKET="${GCP_PROJECT_ID}-qubere-demo-documents"
export RUNTIME_SERVICE_ACCOUNT="qubere-demo-runtime@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
export NEXT_PUBLIC_APP_URL="https://gcp-demo.example.com"
export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_or_live_value"
export DOCLING_API_BASE_URL="https://your-docling-service.example.com"

./infrastructure/gcp/deploy-demo.sh
```

The public Clerk key and app URL are build arguments because Next.js embeds
`NEXT_PUBLIC_*` variables into the browser bundle. Changing either requires a
new image build.

`IMAGE_TAG` defaults to the Git commit SHA. Override service names, repository,
region, image tag, or secret names with the variables at the top of
`deploy-demo.sh`.

For a web-only performance baseline, set `DEPLOY_WORKER=false`. The migration
job is still run, but no continuous worker pool is deployed. Use the default
(`true`) for a functional document-processing demo.

```bash
DEPLOY_WORKER=false ./infrastructure/gcp/deploy-demo.sh
```

## 6. Verify before adding DNS

The script prints the generated `run.app` URL. Check it first:

```bash
export SERVICE_URL="$(gcloud run services describe qubere-customs-demo \
  --region="${GCP_REGION}" \
  --format='value(status.url)')"

curl -fsS "${SERVICE_URL}/api/health/live"
curl -fsS "${SERVICE_URL}/api/health"
```

Then test sign-in, one ordinary page load, one database-backed page, one small
document upload, and the resulting processing status. Inspect errors with:

```bash
gcloud run services logs read qubere-customs-demo \
  --region="${GCP_REGION}" \
  --limit=100
```

## 7. Map the new DNS name

Verify the parent domain in Google Search Console if Google requests it, then
create a Cloud Run domain mapping:

```bash
gcloud beta run domain-mappings create \
  --service=qubere-customs-demo \
  --domain=gcp-demo.example.com \
  --region="${GCP_REGION}"

gcloud beta run domain-mappings describe \
  --domain=gcp-demo.example.com \
  --region="${GCP_REGION}"
```

Add the DNS records shown by the `describe` command. Certificate issuance can
take time. Do not change the existing deployment's DNS record.

Direct Cloud Run domain mapping is a limited-availability preview feature. It is
reasonable for this demo in a supported region; if your region or policy does
not permit it, place a global external Application Load Balancer with a
serverless NEG and Google-managed certificate in front of the same service.

If Cloudflare fronts the current hostname, use the same proxy/cache mode for the
GCP hostname or measure both origins without the proxy. Otherwise the test also
measures different CDN settings.

## 8. Configure scheduled routes

After the service is healthy, reproduce the schedules from
`apps/custom/vercel.json`:

```bash
export GCP_PROJECT_ID="your-project-id"
export GCP_REGION="us-west1"
./infrastructure/gcp/configure-scheduler.sh
```

Skip this step for a short performance-only trial. Running both sets of
schedules against shared upstream APIs can duplicate work.

## 9. Compare performance fairly

- Warm both applications before a warm-path test; measure cold starts separately.
- Test from the same client region, account, route, and dataset size.
- Run at least five samples per route and compare the median and p95, not one run.
- Record TTFB and full navigation time separately.
- Keep Cloudflare/CDN behavior, Clerk instance, database region, and third-party
  integrations as similar as possible.
- Label the GCP result with the image SHA printed by the deployment script.

## Roll back or remove the demo

Deploy an earlier immutable `IMAGE_TAG` to roll back. Cloud Run keeps revision
history, so traffic can also be reassigned in the console.

When the comparison is finished, remove the domain mapping, Scheduler jobs,
worker pool, web service, migration job, images, secrets, and bucket according
to your organization's retention policy. Review the bucket before deleting it;
uploaded demo documents are not recoverable after deletion.
