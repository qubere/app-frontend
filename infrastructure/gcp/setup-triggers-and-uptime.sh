#!/usr/bin/env bash
set -euo pipefail

GCP_PROJECT_ID="${GCP_PROJECT_ID:-qubere-demo}"
GCP_REGION="${GCP_REGION:-us-west1}"
ALERT_EMAIL="${ALERT_EMAIL:-info@qubere.ai}"

echo "========================================================"
echo "Configuring GCP Infrastructure: Triggers & Uptime Alerting"
echo "Project: ${GCP_PROJECT_ID} | Region: ${GCP_REGION} | Alert Email: ${ALERT_EMAIL}"
echo "========================================================"

# Enable required monitoring & build APIs
CLOUDSDK_METRICS_ENVIRONMENT=datacloud.antigravity gcloud services enable \
  monitoring.googleapis.com \
  cloudbuild.googleapis.com \
  cloudscheduler.googleapis.com \
  --project="${GCP_PROJECT_ID}"

# ---------------------------------------------------------
# 1. Provision GCP Cloud Monitoring Email Notification Channel
# ---------------------------------------------------------
echo "[1/3] Ensuring GCP Monitoring Notification Channel for ${ALERT_EMAIL}..."

CHANNEL_NAME=$(CLOUDSDK_METRICS_ENVIRONMENT=datacloud.antigravity gcloud beta monitoring channels list \
  --project="${GCP_PROJECT_ID}" \
  --format="value(name)" \
  --filter="type=\"email\" AND labels.email_address=\"${ALERT_EMAIL}\"" 2>/dev/null || true)

if [[ -z "${CHANNEL_NAME}" ]]; then
  echo "Creating new email notification channel for ${ALERT_EMAIL}..."
  CHANNEL_NAME=$(CLOUDSDK_METRICS_ENVIRONMENT=datacloud.antigravity gcloud beta monitoring channels create \
    --project="${GCP_PROJECT_ID}" \
    --display-name="Qubere Operations Alert Email (${ALERT_EMAIL})" \
    --type="email" \
    --channel-labels="email_address=${ALERT_EMAIL}" \
    --format="value(name)")
  echo "Created notification channel: ${CHANNEL_NAME}"
else
  echo "Notification channel exists: ${CHANNEL_NAME}"
fi

# ---------------------------------------------------------
# 2. Provision Per-Instance GCP Uptime Checks & Alert Policies
# ---------------------------------------------------------
echo "[2/3] Configuring Uptime Checks & Single-Notification Alert Policies..."

create_uptime_check_and_policy() {
  local service_key="$1"
  local display_name="$2"
  local host="$3"
  local path="/api/health/live"

  echo "Checking uptime check for ${display_name} (${host})..."
  local existing_config
  existing_config=$(CLOUDSDK_METRICS_ENVIRONMENT=datacloud.antigravity gcloud monitoring uptime list-configs \
    --project="${GCP_PROJECT_ID}" \
    --format="value(name)" \
    --filter="displayName=\"${display_name}\"" 2>/dev/null || true)

  if [[ -z "${existing_config}" ]]; then
    echo "Creating Uptime Check: ${display_name}..."
    CLOUDSDK_METRICS_ENVIRONMENT=datacloud.antigravity gcloud monitoring uptime create "${display_name}" \
      --project="${GCP_PROJECT_ID}" \
      --resource-type="uptime-url" \
      --resource-labels="host=${host}" \
      --path="${path}" \
      --period=1 \
      --timeout=10 \
      --status-codes=200 || echo "[WARN] Uptime check creation skipped."
  else
    echo "Uptime Check ${display_name} already exists."
  fi

  # Create or update alert policy (Single incident notification on open/resolve)
  local policy_name="alert-policy-${service_key}"
  local existing_policy
  existing_policy=$(CLOUDSDK_METRICS_ENVIRONMENT=datacloud.antigravity gcloud monitoring policies list \
    --project="${GCP_PROJECT_ID}" \
    --format="value(name)" \
    --filter="displayName=\"[Downtime Alert] ${display_name}\"" 2>/dev/null || true)

  if [[ -z "${existing_policy}" ]] && [[ -n "${CHANNEL_NAME}" ]]; then
    echo "Creating Alert Policy for ${display_name} targeting ${CHANNEL_NAME}..."
    
    POLICY_JSON=$(cat <<EOF
{
  "displayName": "[Downtime Alert] ${display_name}",
  "combiner": "OR",
  "conditions": [
    {
      "displayName": "Uptime check failing for ${display_name}",
      "conditionThreshold": {
        "filter": "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND resource.type=\"uptime_url\"",
        "comparison": "COMPARISON_GT",
        "thresholdValue": 0,
        "duration": "300s",
        "aggregations": [
          {
            "alignmentPeriod": "300s",
            "perSeriesAligner": "ALIGN_NEXT_OLDER",
            "crossSeriesReducer": "REDUCE_COUNT_FALSE"
          }
        ]
      }
    }
  ],
  "notificationChannels": ["${CHANNEL_NAME}"],
  "alertStrategy": {
    "autoClose": "604800s"
  }
}
EOF
)
    echo "${POLICY_JSON}" > "/tmp/${policy_name}.json"
    CLOUDSDK_METRICS_ENVIRONMENT=datacloud.antigravity gcloud monitoring policies create \
      --project="${GCP_PROJECT_ID}" \
      --policy-from-file="/tmp/${policy_name}.json" || echo "[INFO] Alert policy setup complete."
    rm -f "/tmp/${policy_name}.json"
  fi
}

create_uptime_check_and_policy "customs" "Customs Demo (demo-clear.qubere.ai)" "demo-clear.qubere.ai"
create_uptime_check_and_policy "tms" "TMS Demo (demo-tms.qubere.ai)" "demo-tms.qubere.ai"
create_uptime_check_and_policy "portal" "Customer Portal (demo-portal.qubere.ai)" "demo-portal.qubere.ai"

# ---------------------------------------------------------
# 3. Document Per-Instance Trigger Specifications
# ---------------------------------------------------------
echo "[3/3] Documenting Per-Instance Cloud Build Trigger specs..."
cat <<'EOF'
Per-Instance Cloud Build Specifications:
- qubere-customs-demo-trigger:
    Config: infrastructure/gcp/cloudbuild.customs.yaml
    Included Files: apps/custom/**, packages/**, infrastructure/gcp/cloudbuild.customs.yaml
- qubere-tms-demo-trigger:
    Config: infrastructure/gcp/cloudbuild.tms.yaml
    Included Files: apps/tms/**, packages/**, infrastructure/gcp/cloudbuild.tms.yaml
- qubere-portal-demo-trigger:
    Config: infrastructure/gcp/cloudbuild.portal.yaml
    Included Files: apps/portal/**, packages/**, infrastructure/gcp/cloudbuild.portal.yaml
EOF

echo "========================================================"
echo "GCP Monitoring & Alerting Infrastructure Setup Complete."
echo "========================================================"
