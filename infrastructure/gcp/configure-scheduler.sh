#!/usr/bin/env bash
set -euo pipefail

require_value() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Required environment variable is not set: ${name}" >&2
    exit 1
  fi
}

require_value GCP_PROJECT_ID
require_value RUNTIME_SERVICE_ACCOUNT

GCP_REGION="${GCP_REGION:-us-west1}"
WEB_SERVICE="${WEB_SERVICE:-qubere-customs-demo}"
DOCUMENT_PROCESSING_JOB="${DOCUMENT_PROCESSING_JOB:-qubere-document-worker-demo}"
CRON_SECRET_SECRET="${CRON_SECRET_SECRET:-qubere-demo-cron-secret}"

SERVICE_URL="${SERVICE_URL:-$(gcloud run services describe "${WEB_SERVICE}" \
  --project="${GCP_PROJECT_ID}" \
  --region="${GCP_REGION}" \
  --format='value(status.url)')}"

CRON_SECRET_VALUE="$(gcloud secrets versions access latest \
  --secret="${CRON_SECRET_SECRET}" \
  --project="${GCP_PROJECT_ID}")"

upsert_job() {
  local name="$1"
  local schedule="$2"
  local path="$3"

  local common_args=(
    --project="${GCP_PROJECT_ID}"
    --location="${GCP_REGION}"
    --schedule="${schedule}"
    --uri="${SERVICE_URL}${path}"
    --http-method=GET
    --headers="Authorization=Bearer ${CRON_SECRET_VALUE}"
    --time-zone=Etc/UTC
    --attempt-deadline=30m
  )

  if gcloud scheduler jobs describe "${name}" \
    --project="${GCP_PROJECT_ID}" \
    --location="${GCP_REGION}" >/dev/null 2>&1; then
    gcloud scheduler jobs update http "${name}" "${common_args[@]}"
  else
    gcloud scheduler jobs create http "${name}" "${common_args[@]}"
  fi
}

upsert_document_job() {
  local uri="https://run.googleapis.com/v2/projects/${GCP_PROJECT_ID}/locations/${GCP_REGION}/jobs/${DOCUMENT_PROCESSING_JOB}:run"
  local common_args=(
    --project="${GCP_PROJECT_ID}"
    --location="${GCP_REGION}"
    --schedule="*/5 * * * *"
    --uri="${uri}"
    --http-method=POST
    --message-body="{}"
    --oauth-service-account-email="${RUNTIME_SERVICE_ACCOUNT}"
    --oauth-token-scope="https://www.googleapis.com/auth/cloud-platform"
    --time-zone=Etc/UTC
    --attempt-deadline=30m
  )
  if gcloud scheduler jobs describe qubere-document-processing-backstop \
    --project="${GCP_PROJECT_ID}" --location="${GCP_REGION}" >/dev/null 2>&1; then
    gcloud scheduler jobs update http qubere-document-processing-backstop "${common_args[@]}"
  else
    gcloud scheduler jobs create http qubere-document-processing-backstop "${common_args[@]}"
  fi
}

upsert_job qubere-data-dispatcher "0 2 * * *" /api/cron/data-dispatcher
upsert_document_job
upsert_job qubere-bis-csl-ingest "0 4 * * *" /api/cron/bis-csl-ingest
upsert_job qubere-fx-rate-refresh "0 3 * * *" /api/cron/fx-rate-refresh
upsert_job qubere-uflpa-ingest "0 6 * * *" /api/cron/uflpa-entity-list-ingest
upsert_job qubere-cbp-cross-ingest "0 5 * * *" /api/cron/cbp-cross-rulings-ingest
upsert_job qubere-outbox-dispatch "*/5 * * * *" /api/cron/outbox-dispatch

unset CRON_SECRET_VALUE
echo "Cloud Scheduler jobs configured for ${SERVICE_URL}."
