#!/usr/bin/env sh
set -e

# Deployment configuration for Qubere Customer Portal on GCP Cloud Run
PROJECT_ID=${GCP_PROJECT_ID:-"qubere-prod"}
REGION=${GCP_REGION:-"us-central1"}
SERVICE_NAME="qubere-customer-portal"
IMAGE_TAG="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:${GIT_COMMIT_SHA:-latest}"

# Document object storage. The runtime service account must have
# roles/storage.objectAdmin on this bucket. Without GCS_BUCKET the portal has
# no durable place to put uploads and rejects them (it never falls back to
# ephemeral per-instance disk on Cloud Run).
GCS_BUCKET=${GCS_BUCKET:-"qubere-demo-uploaded-documents"}

echo "Building Qubere Customer Portal container image..."
docker build --target portal-web -t "${IMAGE_TAG}" .

echo "Pushing image to GCP Artifact Registry / Container Registry..."
docker push "${IMAGE_TAG}"

echo "Deploying ${SERVICE_NAME} to GCP Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image="${IMAGE_TAG}" \
  --platform=managed \
  --region="${REGION}" \
  --allow-unauthenticated \
  --port=8080 \
  --set-env-vars="NEXT_PUBLIC_APP_ENV=demo,NEXT_PUBLIC_APP_URL=https://demo-portal.qubere.ai,STORAGE_PROVIDER=gcs,GCS_BUCKET=${GCS_BUCKET}"

echo "Qubere Customer Portal successfully deployed to GCP Cloud Run!"
