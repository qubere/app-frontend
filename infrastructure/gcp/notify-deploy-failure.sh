#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${1:-unknown-service}"
COMMIT_SHA="${2:-unknown-sha}"
BUILD_ID="${3:-unknown-build}"
STATUS="${4:-FAILED}"
TARGET_EMAIL="${5:-info@qubere.ai}"

GCP_PROJECT_ID="${GCP_PROJECT_ID:-qubere-demo}"
ALERT_BUCKET="${GCS_BUCKET:-qubere-demo-storage}"
DEDUP_KEY="notified-${SERVICE_NAME}-${COMMIT_SHA}"
LOCAL_LOCK="/tmp/${DEDUP_KEY}.lock"

# -------------------------------------------------------------
# DEDUPLICATION CHECK: Exactly 1 email per (Service, Commit SHA)
# -------------------------------------------------------------
if [[ "${COMMIT_SHA}" != "unknown-sha" ]]; then
  # 1. Local container / process check
  if [[ -f "${LOCAL_LOCK}" ]]; then
    echo "[INFO] Alert for ${SERVICE_NAME} commit ${COMMIT_SHA} already sent locally. Skipping duplicate email."
    exit 0
  fi

  # 2. Remote Cloud Storage check (persists across ephemeral build containers)
  if gcloud storage objects describe "gs://${ALERT_BUCKET}/alerts/${DEDUP_KEY}" --project="${GCP_PROJECT_ID}" >/dev/null 2>&1; then
    echo "[INFO] Alert for ${SERVICE_NAME} commit ${COMMIT_SHA} already sent (GCS lock found). Skipping duplicate email."
    touch "${LOCAL_LOCK}"
    exit 0
  fi
fi

# Attempt to fetch Resend API key from Secret Manager if not set
RESEND_API_KEY="${RESEND_API_KEY:-}"
if [[ -z "${RESEND_API_KEY}" ]]; then
  RESEND_API_KEY="$(gcloud secrets versions access latest --secret="qubere-demo-resend-api-key" --project="${GCP_PROJECT_ID}" 2>/dev/null || true)"
fi

if [[ -z "${RESEND_API_KEY}" ]]; then
  echo "[WARN] RESEND_API_KEY unavailable. Failure alert logged for ${SERVICE_NAME} (commit: ${COMMIT_SHA}, build: ${BUILD_ID})." >&2
  exit 0
fi

SUBJECT="[ALERT] GCP Deployment ${STATUS}: ${SERVICE_NAME} (${COMMIT_SHA})"
BODY="<h2>🚨 GCP Deployment Failure Alert</h2><p><strong>Service:</strong> <code>${SERVICE_NAME}</code></p><p><strong>Status:</strong> <span style='color:red;'>${STATUS}</span></p><p><strong>Commit SHA:</strong> <code>${COMMIT_SHA}</code></p><p><strong>Build ID:</strong> <code>${BUILD_ID}</code></p><p><strong>GCP Project:</strong> <code>${GCP_PROJECT_ID}</code></p><hr /><p><a href='https://console.cloud.google.com/cloud-build/builds/${BUILD_ID}?project=${GCP_PROJECT_ID}'>View Cloud Build Logs in GCP Console</a></p>"

PAYLOAD=$(node -e '
  const payload = {
    from: "Qubere Alerts <notifications@inbound.qubere.ai>",
    to: [process.argv[1]],
    subject: process.argv[2],
    html: process.argv[3]
  };
  console.log(JSON.stringify(payload));
' "${TARGET_EMAIL}" "${SUBJECT}" "${BODY}" 2>/dev/null || cat <<EOF
{
  "from": "Qubere Alerts <notifications@inbound.qubere.ai>",
  "to": ["${TARGET_EMAIL}"],
  "subject": "${SUBJECT}",
  "html": "${BODY}"
}
EOF
)

# Send the email alert
curl -s -X POST "https://api.resend.com/emails" \
  -H "Authorization: Bearer ${RESEND_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "${PAYLOAD}" >/dev/null || true

# Write deduplication locks (local + GCS) to ensure only 1 email per SHA
touch "${LOCAL_LOCK}"
if [[ "${COMMIT_SHA}" != "unknown-sha" ]]; then
  echo "alerted_at=$(date -u +'%Y-%m-%dT%H:%M:%SZ')" | gcloud storage cp - "gs://${ALERT_BUCKET}/alerts/${DEDUP_KEY}" --project="${GCP_PROJECT_ID}" >/dev/null 2>&1 || true
fi

echo "[INFO] Failure notification sent to ${TARGET_EMAIL} for service ${SERVICE_NAME} (Commit: ${COMMIT_SHA})."
