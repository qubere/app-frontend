#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found: $1" >&2
    exit 1
  fi
}

require_value() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Required environment variable is not set: ${name}" >&2
    exit 1
  fi
}

require_command gcloud
require_command git

require_value GCP_PROJECT_ID
require_value NEXT_PUBLIC_APP_URL
require_value NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
require_value DOCLING_API_BASE_URL
require_value RUNTIME_SERVICE_ACCOUNT
require_value GCS_BUCKET

GCP_REGION="${GCP_REGION:-us-west1}"
ARTIFACT_REPOSITORY="${ARTIFACT_REPOSITORY:-qubere-demo}"
WEB_SERVICE="${WEB_SERVICE:-qubere-customs-demo}"
WORKER_POOL="${WORKER_POOL:-qubere-document-worker-demo}"
MIGRATION_JOB="${MIGRATION_JOB:-qubere-migrate-demo}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short=12 HEAD)}"
DEPLOY_WORKER="${DEPLOY_WORKER:-true}"

WEB_IMAGE="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${ARTIFACT_REPOSITORY}/customs-web:${IMAGE_TAG}"
WORKER_IMAGE="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${ARTIFACT_REPOSITORY}/customs-worker:${IMAGE_TAG}"

# Secret Manager secret names can be overridden without modifying this script.
DATABASE_URL_SECRET="${DATABASE_URL_SECRET:-qubere-demo-database-url}"
DIRECT_URL_SECRET="${DIRECT_URL_SECRET:-qubere-demo-direct-url}"
CLERK_SECRET_KEY_SECRET="${CLERK_SECRET_KEY_SECRET:-qubere-demo-clerk-secret-key}"
GEMINI_API_KEY_SECRET="${GEMINI_API_KEY_SECRET:-qubere-demo-gemini-api-key}"
CRON_SECRET_SECRET="${CRON_SECRET_SECRET:-qubere-demo-cron-secret}"
DOCLING_API_KEY_SECRET="${DOCLING_API_KEY_SECRET:-qubere-demo-docling-api-key}"

REQUIRED_SECRETS=(
  "${DATABASE_URL_SECRET}"
  "${DIRECT_URL_SECRET}"
  "${CLERK_SECRET_KEY_SECRET}"
  "${GEMINI_API_KEY_SECRET}"
  "${CRON_SECRET_SECRET}"
  "${DOCLING_API_KEY_SECRET}"
)

echo "Checking required Secret Manager entries..."
for secret_name in "${REQUIRED_SECRETS[@]}"; do
  if ! gcloud secrets describe "${secret_name}" --project="${GCP_PROJECT_ID}" >/dev/null 2>&1; then
    echo "Missing Secret Manager secret: ${secret_name}" >&2
    exit 1
  fi
done

SECRET_BINDINGS="DATABASE_URL=${DATABASE_URL_SECRET}:latest"
SECRET_BINDINGS+=",DIRECT_URL=${DIRECT_URL_SECRET}:latest"
SECRET_BINDINGS+=",CLERK_SECRET_KEY=${CLERK_SECRET_KEY_SECRET}:latest"
SECRET_BINDINGS+=",GEMINI_API_KEY=${GEMINI_API_KEY_SECRET}:latest"
SECRET_BINDINGS+=",CRON_SECRET=${CRON_SECRET_SECRET}:latest"
SECRET_BINDINGS+=",DOCLING_API_KEY=${DOCLING_API_KEY_SECRET}:latest"

# Attach optional integrations only when their named secrets exist.
OPTIONAL_SECRET_SPECS=(
  "ANTHROPIC_API_KEY:${ANTHROPIC_API_KEY_SECRET:-qubere-demo-anthropic-api-key}"
  "RESEND_API_KEY:${RESEND_API_KEY_SECRET:-qubere-demo-resend-api-key}"
  "RESEND_WEBHOOK_SECRET:${RESEND_WEBHOOK_SECRET_SECRET:-qubere-demo-resend-webhook-secret}"
  "INNGEST_EVENT_KEY:${INNGEST_EVENT_KEY_SECRET:-qubere-demo-inngest-event-key}"
  "INNGEST_SIGNING_KEY:${INNGEST_SIGNING_KEY_SECRET:-qubere-demo-inngest-signing-key}"
  "CBP_ABI_FILER_CODE:${CBP_ABI_FILER_CODE_SECRET:-qubere-demo-cbp-filer-code}"
  "CBP_ABI_FILER_PASSWORD:${CBP_ABI_FILER_PASSWORD_SECRET:-qubere-demo-cbp-filer-password}"
)

for spec in "${OPTIONAL_SECRET_SPECS[@]}"; do
  env_name="${spec%%:*}"
  secret_name="${spec#*:}"
  if gcloud secrets describe "${secret_name}" --project="${GCP_PROJECT_ID}" >/dev/null 2>&1; then
    SECRET_BINDINGS+=",${env_name}=${secret_name}:latest"
  fi
done

RUNTIME_ENV="APP_ENV=demo"
RUNTIME_ENV+=",NEXT_PUBLIC_APP_ENV=demo"
RUNTIME_ENV+=",NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}"
RUNTIME_ENV+=",NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}"
RUNTIME_ENV+=",CUSTOMS_FILING_MOCK_RESPONSES=true"
RUNTIME_ENV+=",STORAGE_PROVIDER=gcs"
RUNTIME_ENV+=",GCS_BUCKET=${GCS_BUCKET}"
RUNTIME_ENV+=",DOCUMENT_PARSER_PROVIDER=ibm-docling"
RUNTIME_ENV+=",DOCLING_API_BASE_URL=${DOCLING_API_BASE_URL}"
RUNTIME_ENV+=",DOCUMENT_MALWARE_SCAN_MODE=basic"

echo "Enabling required Google Cloud APIs..."
gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  iamcredentials.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  cloudscheduler.googleapis.com \
  --project="${GCP_PROJECT_ID}"

if ! gcloud storage buckets describe "gs://${GCS_BUCKET}" \
  --project="${GCP_PROJECT_ID}" >/dev/null 2>&1; then
  echo "Cloud Storage bucket does not exist or is not accessible: gs://${GCS_BUCKET}" >&2
  echo "Create it and grant ${RUNTIME_SERVICE_ACCOUNT} object access before deploying." >&2
  exit 1
fi

if ! gcloud artifacts repositories describe "${ARTIFACT_REPOSITORY}" \
  --location="${GCP_REGION}" \
  --project="${GCP_PROJECT_ID}" >/dev/null 2>&1; then
  echo "Creating Artifact Registry repository ${ARTIFACT_REPOSITORY}..."
  gcloud artifacts repositories create "${ARTIFACT_REPOSITORY}" \
    --repository-format=docker \
    --location="${GCP_REGION}" \
    --project="${GCP_PROJECT_ID}"
fi

echo "Building web and worker images as ${IMAGE_TAG}..."
gcloud builds submit \
  --project="${GCP_PROJECT_ID}" \
  --config="infrastructure/gcp/cloudbuild.demo.yaml" \
  --substitutions="_REGION=${GCP_REGION},_REPOSITORY=${ARTIFACT_REPOSITORY},_IMAGE_TAG=${IMAGE_TAG},_NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL},_NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}" \
  .

echo "Deploying and executing database migrations..."
gcloud run jobs deploy "${MIGRATION_JOB}" \
  --project="${GCP_PROJECT_ID}" \
  --region="${GCP_REGION}" \
  --image="${WORKER_IMAGE}" \
  --service-account="${RUNTIME_SERVICE_ACCOUNT}" \
  --set-secrets="${SECRET_BINDINGS}" \
  --command=npx \
  --args=prisma,migrate,deploy,--schema=packages/db/prisma/schema.prisma \
  --max-retries=0 \
  --task-timeout=15m

gcloud run jobs execute "${MIGRATION_JOB}" \
  --project="${GCP_PROJECT_ID}" \
  --region="${GCP_REGION}" \
  --wait

echo "Deploying Customs web service..."
gcloud run deploy "${WEB_SERVICE}" \
  --project="${GCP_PROJECT_ID}" \
  --region="${GCP_REGION}" \
  --image="${WEB_IMAGE}" \
  --service-account="${RUNTIME_SERVICE_ACCOUNT}" \
  --allow-unauthenticated \
  --cpu=2 \
  --memory=2Gi \
  --min-instances=1 \
  --max-instances=3 \
  --concurrency=20 \
  --timeout=300 \
  --liveness-probe=httpGet.path=/api/health/live,initialDelaySeconds=10,timeoutSeconds=5,periodSeconds=30,failureThreshold=3 \
  --set-env-vars="${RUNTIME_ENV}" \
  --set-secrets="${SECRET_BINDINGS}"

if [[ "${DEPLOY_WORKER}" == "true" ]]; then
  echo "Deploying continuous document worker..."
  gcloud run worker-pools deploy "${WORKER_POOL}" \
    --project="${GCP_PROJECT_ID}" \
    --region="${GCP_REGION}" \
    --image="${WORKER_IMAGE}" \
    --service-account="${RUNTIME_SERVICE_ACCOUNT}" \
    --instances=1 \
    --cpu=2 \
    --memory=2Gi \
    --set-env-vars="${RUNTIME_ENV}" \
    --set-secrets="${SECRET_BINDINGS}"
else
  echo "Skipping the document worker because DEPLOY_WORKER=${DEPLOY_WORKER}."
fi

SERVICE_URL="$(gcloud run services describe "${WEB_SERVICE}" \
  --project="${GCP_PROJECT_ID}" \
  --region="${GCP_REGION}" \
  --format='value(status.url)')"

echo
echo "Deployment complete."
echo "Cloud Run URL: ${SERVICE_URL}"
echo "Liveness:     ${SERVICE_URL}/api/health/live"
echo "Readiness:    ${SERVICE_URL}/api/health"
echo "Image tag:    ${IMAGE_TAG}"
