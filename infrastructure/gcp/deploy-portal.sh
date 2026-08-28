#!/usr/bin/env sh
set -e

# Deployment configuration for Qubere Customer Portal on GCP Cloud Run
PROJECT_ID=${GCP_PROJECT_ID:-"qubere-prod"}
REGION=${GCP_REGION:-"us-central1"}
SERVICE_NAME="qubere-customer-portal"
IMAGE_TAG="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:${GIT_COMMIT_SHA:-latest}"

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
  --set-env-vars="NEXT_PUBLIC_APP_ENV=demo,NEXT_PUBLIC_APP_URL=https://demo-portal.qubere.ai"

echo "Qubere Customer Portal successfully deployed to GCP Cloud Run!"
