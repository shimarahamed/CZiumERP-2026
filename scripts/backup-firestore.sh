#!/usr/bin/env bash
# Daily Firestore backup to Google Cloud Storage.
#
# One-time setup:
#   gsutil mb -l <region> gs://YOUR_PROJECT-backups
#   gsutil lifecycle set <(echo '{"rule":[{"action":{"type":"Delete"},"condition":{"age":30}}]}') gs://YOUR_PROJECT-backups
#
# Run manually, or schedule with Cloud Scheduler / cron:
#   0 3 * * * /path/to/backup-firestore.sh YOUR_PROJECT_ID
set -euo pipefail
PROJECT_ID="${1:?Usage: backup-firestore.sh <project-id> [bucket]}"
BUCKET="${2:-gs://${PROJECT_ID}-backups}"
STAMP="$(date +%Y-%m-%d-%H%M)"
echo "Exporting Firestore (${PROJECT_ID}) → ${BUCKET}/${STAMP}"
gcloud firestore export "${BUCKET}/${STAMP}" --project "${PROJECT_ID}"
echo "Done. Restore with: gcloud firestore import ${BUCKET}/${STAMP} --project ${PROJECT_ID}"
