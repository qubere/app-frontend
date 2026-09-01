#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

require() { [[ -n "${!1:-}" ]] || { echo "Required environment variable is not set: $1" >&2; exit 1; }; }
for name in GCP_PROJECT_ID NEXT_PUBLIC_CUSTOMS_APP_URL NEXT_PUBLIC_TMS_APP_URL NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY DOCLING_API_BASE_URL RUNTIME_SERVICE_ACCOUNT GCS_BUCKET; do require "${name}"; done
command -v gcloud >/dev/null || { echo "gcloud is required" >&2; exit 1; }

GCP_REGION="${GCP_REGION:-us-west1}"
ARTIFACT_REPOSITORY="${ARTIFACT_REPOSITORY:-qubere-demo}"
CUSTOMS_WEB_SERVICE="${CUSTOMS_WEB_SERVICE:-qubere-customs-demo}"
TMS_WEB_SERVICE="${TMS_WEB_SERVICE:-qubere-tms-demo}"
MIGRATION_JOB="${MIGRATION_JOB:-qubere-migrate-demo}"
DOCUMENT_PROCESSING_JOB="${DOCUMENT_PROCESSING_JOB:-qubere-document-worker-demo}"
BACKUP_JOB="${BACKUP_JOB:-qubere-db-backup-demo}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short=12 HEAD)}"
REGISTRY="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${ARTIFACT_REPOSITORY}"
CUSTOMS_IMAGE="${REGISTRY}/customs-web:${IMAGE_TAG}"
TMS_IMAGE="${REGISTRY}/tms-web:${IMAGE_TAG}"
DATABASE_IMAGE="${REGISTRY}/database:${IMAGE_TAG}"
DOCUMENT_IMAGE="${REGISTRY}/document-worker:${IMAGE_TAG}"
BACKUP_IMAGE="${REGISTRY}/db-backup:${IMAGE_TAG}"

DATABASE_URL_SECRET="${DATABASE_URL_SECRET:-qubere-demo-database-url}"
DIRECT_URL_SECRET="${DIRECT_URL_SECRET:-qubere-demo-direct-url}"
PRODUCT_HELP_DATABASE_URL_SECRET="${PRODUCT_HELP_DATABASE_URL_SECRET:-PRODUCT_HELP_DATABASE_URL}"
CLERK_SECRET_KEY_SECRET="${CLERK_SECRET_KEY_SECRET:-qubere-demo-clerk-secret-key}"
GEMINI_API_KEY_SECRET="${GEMINI_API_KEY_SECRET:-qubere-demo-gemini-api-key}"
CRON_SECRET_SECRET="${CRON_SECRET_SECRET:-qubere-demo-cron-secret}"
DOCLING_API_KEY_SECRET="${DOCLING_API_KEY_SECRET:-qubere-demo-docling-api-key}"
RESEND_API_KEY_SECRET="${RESEND_API_KEY_SECRET:-qubere-demo-resend-api-key}"
OPENSIGN_API_TOKEN_SECRET="${OPENSIGN_API_TOKEN_SECRET:-qubere-demo-opensign-api-token}"
SECRET_BINDINGS="DATABASE_URL=${DATABASE_URL_SECRET}:latest,DIRECT_URL=${DIRECT_URL_SECRET}:latest,PRODUCT_HELP_DATABASE_URL=${PRODUCT_HELP_DATABASE_URL_SECRET}:latest,CLERK_SECRET_KEY=${CLERK_SECRET_KEY_SECRET}:latest,GEMINI_API_KEY=${GEMINI_API_KEY_SECRET}:latest,CRON_SECRET=${CRON_SECRET_SECRET}:latest,DOCLING_API_KEY=${DOCLING_API_KEY_SECRET}:latest,RESEND_API_KEY=${RESEND_API_KEY_SECRET}:latest,OPEN_SIGN_API_TOKEN=${OPENSIGN_API_TOKEN_SECRET}:latest"
for secret in "${DATABASE_URL_SECRET}" "${DIRECT_URL_SECRET}" "${PRODUCT_HELP_DATABASE_URL_SECRET}" "${CLERK_SECRET_KEY_SECRET}" "${GEMINI_API_KEY_SECRET}" "${CRON_SECRET_SECRET}" "${DOCLING_API_KEY_SECRET}" "${RESEND_API_KEY_SECRET}" "${OPENSIGN_API_TOKEN_SECRET}"; do
  gcloud secrets describe "${secret}" --project="${GCP_PROJECT_ID}" >/dev/null || { echo "Missing secret: ${secret}" >&2; exit 1; }
done

BASE_ENV="APP_ENV=demo,NEXT_PUBLIC_APP_ENV=demo,NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY},STORAGE_PROVIDER=gcs,GCS_BUCKET=${GCS_BUCKET},DOCUMENT_PARSER_PROVIDER=ibm-docling,DOCLING_API_BASE_URL=${DOCLING_API_BASE_URL},DOCUMENT_MALWARE_SCAN_MODE=basic,CUSTOMS_FILING_MOCK_RESPONSES=true,RESEND_FROM_ADDRESS=notifications@inbound.qubere.ai,ESIGN_PROVIDER=OPEN_SIGN,OPEN_SIGN_BASE_URL=https://sandbox.opensignlabs.com"
JOB_TRIGGER_ENV="${BASE_ENV},DOCUMENT_PROCESSING_EXECUTOR=cloud-run-job,GCP_PROJECT_ID=${GCP_PROJECT_ID},GCP_REGION=${GCP_REGION},DOCUMENT_PROCESSING_JOB=${DOCUMENT_PROCESSING_JOB}"

gcloud services enable artifactregistry.googleapis.com cloudbuild.googleapis.com run.googleapis.com secretmanager.googleapis.com storage.googleapis.com cloudscheduler.googleapis.com --project="${GCP_PROJECT_ID}"
gcloud storage buckets describe "gs://${GCS_BUCKET}" --project="${GCP_PROJECT_ID}" >/dev/null
if ! gcloud artifacts repositories describe "${ARTIFACT_REPOSITORY}" --location="${GCP_REGION}" --project="${GCP_PROJECT_ID}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${ARTIFACT_REPOSITORY}" --repository-format=docker --location="${GCP_REGION}" --project="${GCP_PROJECT_ID}"
fi

gcloud builds submit --project="${GCP_PROJECT_ID}" --region="${GCP_REGION}" --config=infrastructure/gcp/cloudbuild.demo.yaml \
  --substitutions="_REGION=${GCP_REGION},_REPOSITORY=${ARTIFACT_REPOSITORY},_IMAGE_TAG=${IMAGE_TAG},_CUSTOMS_APP_URL=${NEXT_PUBLIC_CUSTOMS_APP_URL},_TMS_APP_URL=${NEXT_PUBLIC_TMS_APP_URL},_NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}" .

VPC_CONNECTOR="${VPC_CONNECTOR:-clamav-vpc-connector}"
CLOUDSQL_INSTANCE="${CLOUDSQL_INSTANCE:-qubere-demo-instance}"

gcloud run jobs deploy "${MIGRATION_JOB}" --project="${GCP_PROJECT_ID}" --region="${GCP_REGION}" --image="${DATABASE_IMAGE}" --service-account="${RUNTIME_SERVICE_ACCOUNT}" --set-vpc-connector="${VPC_CONNECTOR}" --vpc-egress=private-ranges-only --add-cloudsql-instances="${GCP_PROJECT_ID}:${GCP_REGION}:${CLOUDSQL_INSTANCE}" --set-secrets="${SECRET_BINDINGS}" --max-retries=0 --task-timeout=15m
gcloud run jobs execute "${MIGRATION_JOB}" --project="${GCP_PROJECT_ID}" --region="${GCP_REGION}" --wait

gcloud run jobs deploy "${DOCUMENT_PROCESSING_JOB}" --project="${GCP_PROJECT_ID}" --region="${GCP_REGION}" --image="${DOCUMENT_IMAGE}" --service-account="${RUNTIME_SERVICE_ACCOUNT}" --set-vpc-connector="${VPC_CONNECTOR}" --vpc-egress=private-ranges-only --add-cloudsql-instances="${GCP_PROJECT_ID}:${GCP_REGION}:${CLOUDSQL_INSTANCE}" --cpu=2 --memory=4Gi --tasks=1 --parallelism=1 --max-retries=1 --task-timeout=15m --set-env-vars="${BASE_ENV},DOCUMENT_PROCESSING_EXECUTOR=in-process" --set-secrets="${SECRET_BINDINGS}"
gcloud run jobs add-iam-policy-binding "${DOCUMENT_PROCESSING_JOB}" --project="${GCP_PROJECT_ID}" --region="${GCP_REGION}" --member="serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" --role=roles/run.invoker >/dev/null

gcloud run jobs deploy "${BACKUP_JOB}" --project="${GCP_PROJECT_ID}" --region="${GCP_REGION}" --image="${BACKUP_IMAGE}" --service-account="${RUNTIME_SERVICE_ACCOUNT}" --set-vpc-connector="${VPC_CONNECTOR}" --vpc-egress=private-ranges-only --set-cloudsql-instances="${GCP_PROJECT_ID}:${GCP_REGION}:${CLOUDSQL_INSTANCE}" --tasks=1 --parallelism=1 --max-retries=1 --task-timeout=15m --set-env-vars="${BASE_ENV}" --set-secrets="${SECRET_BINDINGS}"
gcloud run jobs add-iam-policy-binding "${BACKUP_JOB}" --project="${GCP_PROJECT_ID}" --region="${GCP_REGION}" --member="serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" --role=roles/run.invoker >/dev/null

deploy_web() {
  local service="$1" image="$2" app_url="$3"
  gcloud run deploy "${service}" --project="${GCP_PROJECT_ID}" --region="${GCP_REGION}" --image="${image}" --service-account="${RUNTIME_SERVICE_ACCOUNT}" --allow-unauthenticated --cpu=2 --memory=2Gi --min-instances=1 --max-instances=3 --concurrency=20 --timeout=300 --vpc-connector="${VPC_CONNECTOR}" --vpc-egress=private-ranges-only --add-cloudsql-instances="${GCP_PROJECT_ID}:${GCP_REGION}:${CLOUDSQL_INSTANCE}" --set-env-vars="${JOB_TRIGGER_ENV},NEXT_PUBLIC_APP_URL=${app_url}" --set-secrets="${SECRET_BINDINGS}"
}
deploy_web "${CUSTOMS_WEB_SERVICE}" "${CUSTOMS_IMAGE}" "${NEXT_PUBLIC_CUSTOMS_APP_URL}"
deploy_web "${TMS_WEB_SERVICE}" "${TMS_IMAGE}" "${NEXT_PUBLIC_TMS_APP_URL}"

echo "Deployment complete. Map ${NEXT_PUBLIC_CUSTOMS_APP_URL} to ${CUSTOMS_WEB_SERVICE} and ${NEXT_PUBLIC_TMS_APP_URL} to ${TMS_WEB_SERVICE}."
