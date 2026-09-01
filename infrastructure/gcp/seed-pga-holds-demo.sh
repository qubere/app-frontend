#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--help" ]]; then
  echo "Usage: bash infrastructure/gcp/seed-pga-holds-demo.sh [--dry-run]"
  echo "Required: GCP_PROJECT_ID, RUNTIME_SERVICE_ACCOUNT, PGA_ACCOUNT_ID, PGA_SHIPMENT_ID"
  echo "Optional: PGA_USER_ID, PGA_APP_URL, GCP_REGION, ARTIFACT_REPOSITORY, CLOUD_SQL_CONNECTION_NAME, VPC_CONNECTOR"
  exit 0
fi
if [[ $# -gt 1 || ( $# -eq 1 && "$1" != "--dry-run" ) ]]; then
  echo "Only --dry-run or --help is supported." >&2
  exit 1
fi
for name in GCP_PROJECT_ID RUNTIME_SERVICE_ACCOUNT PGA_ACCOUNT_ID PGA_SHIPMENT_ID; do
  [[ -n "${!name:-}" ]] || { echo "Required variable missing: ${name}" >&2; exit 1; }
done
# gcloud's --args uses a comma-separated list. Reject ambiguous input rather
# than letting an identifier inject another CLI flag into the seed process.
for name in PGA_ACCOUNT_ID PGA_SHIPMENT_ID PGA_USER_ID; do
  [[ -z "${!name:-}" || "${!name}" =~ ^[A-Za-z0-9_-]+$ ]] || { echo "Invalid identifier: ${name}" >&2; exit 1; }
done
if [[ -n "${PGA_APP_URL:-}" && ! "${PGA_APP_URL}" =~ ^https?://[A-Za-z0-9.-]+(:[0-9]+)?/?$ ]]; then
  echo "PGA_APP_URL must be an http(s) origin without a path, credentials, or query string." >&2
  exit 1
fi
command -v gcloud >/dev/null || { echo "gcloud is required" >&2; exit 1; }

SEED_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${SEED_ROOT}"
GCP_REGION="${GCP_REGION:-us-west1}"
ARTIFACT_REPOSITORY="${ARTIFACT_REPOSITORY:-qubere-demo}"
PGA_SEED_JOB="${PGA_SEED_JOB:-qubere-pga-seed-demo}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short=12 HEAD)}"
DATABASE_URL_SECRET="${DATABASE_URL_SECRET:-qubere-demo-database-url}"
DIRECT_URL_SECRET="${DIRECT_URL_SECRET:-qubere-demo-direct-url}"
SEED_IMAGE="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${ARTIFACT_REPOSITORY}/pga-demo-seed:${IMAGE_TAG}"
SEED_ARGS="--account-id,${PGA_ACCOUNT_ID},--shipment-id,${PGA_SHIPMENT_ID}"
[[ -z "${PGA_USER_ID:-}" ]] || SEED_ARGS+=",--user-id,${PGA_USER_ID}"
[[ -z "${PGA_APP_URL:-}" ]] || SEED_ARGS+=",--app-url,${PGA_APP_URL}"
[[ "${1:-}" != "--dry-run" ]] || SEED_ARGS+=",--dry-run"

network_args=()
if [[ -n "${CLOUD_SQL_CONNECTION_NAME:-}" ]]; then
  network_args+=("--set-cloudsql-instances=${CLOUD_SQL_CONNECTION_NAME}")
fi
if [[ -n "${VPC_CONNECTOR:-}" ]]; then
  network_args+=("--vpc-connector=${VPC_CONNECTOR}" "--vpc-egress=private-ranges-only")
fi

gcloud builds submit --project="${GCP_PROJECT_ID}" --region="${GCP_REGION}" \
  --config=infrastructure/gcp/cloudbuild.pga-demo-seed.yaml \
  --substitutions="_REGION=${GCP_REGION},_REPOSITORY=${ARTIFACT_REPOSITORY},_IMAGE_TAG=${IMAGE_TAG}" .

# This separate administrative job receives only the demo DB secrets. It does
# not inherit the web service's runtime, credentials or transmission settings.
gcloud run jobs deploy "${PGA_SEED_JOB}" --project="${GCP_PROJECT_ID}" --region="${GCP_REGION}" \
  --image="${SEED_IMAGE}" --service-account="${RUNTIME_SERVICE_ACCOUNT}" \
  --set-env-vars="NODE_ENV=development,APP_ENV=demo,NEXT_PUBLIC_APP_ENV=demo,ALLOW_DEMO_SEEDING=true" \
  --set-secrets="DATABASE_URL=${DATABASE_URL_SECRET}:latest,DIRECT_URL=${DIRECT_URL_SECRET}:latest" \
  --args="${SEED_ARGS}" --tasks=1 --parallelism=1 --max-retries=0 --task-timeout=5m \
  --cpu=1 --memory=512Mi ${network_args[@]+"${network_args[@]}"}

gcloud run jobs execute "${PGA_SEED_JOB}" --project="${GCP_PROJECT_ID}" --region="${GCP_REGION}" --wait
gcloud run jobs logs read "${PGA_SEED_JOB}" --project="${GCP_PROJECT_ID}" --region="${GCP_REGION}" --limit=60
