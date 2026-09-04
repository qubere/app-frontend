#!/usr/bin/env sh
set -eu

echo "Starting automated database backup job..."

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL environment variable is required" >&2
  exit 1
fi

GCS_BUCKET="${GCS_BUCKET:-qubere-demo-uploaded-documents}"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")
FILENAME="qubere_db_backup_${TIMESTAMP}.dump"
TEMP_FILE="/tmp/${FILENAME}"

echo "Executing pg_dump to ${TEMP_FILE}..."
pg_dump "${DATABASE_URL}" -Fc -f "${TEMP_FILE}"

echo "Uploading ${FILENAME} to GCS bucket ${GCS_BUCKET}..."
npx tsx apps/custom/scripts/upload-backup-to-gcs.ts "${TEMP_FILE}" "backups/${FILENAME}"

rm -f "${TEMP_FILE}"
echo "Database backup job completed successfully!"
