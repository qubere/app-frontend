#!/usr/bin/env bash
set -euo pipefail

# Configuration - Update these variables for your GCP project
GCP_PROJECT_ID="${GCP_PROJECT_ID:-qubere-production}"
GCP_REGION="${GCP_REGION:-us-west1}"
REPOSITORY_NAME="qubere-repo"
IMAGE_NAME="qubere-app"
SERVICE_NAME="qubere-app-service"

IMAGE_TAG="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${REPOSITORY_NAME}/${IMAGE_NAME}:latest"

echo "=== 1. Enabling GCP Required APIs ==="
gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  --project="${GCP_PROJECT_ID}"

echo "=== 2. Creating Artifact Registry Repository (if not exists) ==="
gcloud artifacts repositories create "${REPOSITORY_NAME}" \
  --repository-format=docker \
  --location="${GCP_REGION}" \
  --project="${GCP_PROJECT_ID}" \
  2>/dev/null || echo "Repository ${REPOSITORY_NAME} already exists."

echo "=== 3. Building and Pushing Docker Image ==="
gcloud builds submit \
  --tag "${IMAGE_TAG}" \
  --project="${GCP_PROJECT_ID}" \
  .

echo "=== 4. Deploying Long-Living Cloud Run Service (min-instances = 1) ==="
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE_TAG}" \
  --region "${GCP_REGION}" \
  --project "${GCP_PROJECT_ID}" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --cpu 2 \
  --memory 2Gi \
  --min-instances 1 \
  --max-instances 10 \
  --concurrency 80 \
  --set-env-vars "NODE_ENV=production"

echo "=== Deployment Complete! ==="
echo "Service URL:"
gcloud run services describe "${SERVICE_NAME}" \
  --region "${GCP_REGION}" \
  --project "${GCP_PROJECT_ID}" \
  --format="value(status.url)"
