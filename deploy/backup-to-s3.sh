#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Optional: back up server/data.db to S3 on a schedule (e.g. via cron).
# S3 is plain object storage, not a subscribed database service — this is
# just durability insurance for the one SQLite file everything relies on,
# not a requirement for the app to run.
#
# Setup:
#   1. Create an S3 bucket (or reuse one), e.g.: aws s3 mb s3://jolt-db-backups
#   2. Give the EC2 instance's IAM role s3:PutObject on that bucket
#   3. Add to crontab (e.g. `crontab -e`):
#        0 * * * * /home/ec2-user/jolt-pickleball-club/deploy/backup-to-s3.sh
#          >> /var/log/jolt-backup.log 2>&1
#
# Usage: ./deploy/backup-to-s3.sh [s3://bucket-name]
# ---------------------------------------------------------------------------
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_PATH="${DB_PATH:-$APP_DIR/server/data.db}"
BUCKET="${1:-${BACKUP_S3_BUCKET:-}}"

if [ -z "$BUCKET" ]; then
  echo "Usage: $0 s3://your-bucket-name  (or set BACKUP_S3_BUCKET)" >&2
  exit 1
fi

if [ ! -f "$DB_PATH" ]; then
  echo "No database file found at $DB_PATH — nothing to back up." >&2
  exit 1
fi

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="${BUCKET%/}/data-$TIMESTAMP.db"

# SQLite's own backup command produces a consistent snapshot even while the
# server is writing to the live file, unlike a plain file copy.
TMP_COPY="$(mktemp)"
sqlite3 "$DB_PATH" ".backup '$TMP_COPY'"

aws s3 cp "$TMP_COPY" "$DEST"
rm -f "$TMP_COPY"

echo "▲ Backed up $DB_PATH → $DEST"
