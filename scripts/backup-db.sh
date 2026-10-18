#!/bin/sh
# Daily Postgres backup with 14 days retention.
# Usage: backup-db.sh [target-dir] — connection via PG* env vars.
# pipefail: without it a failed pg_dump would still write an "ok" empty .gz.
set -eu
set -o pipefail

TARGET_DIR="${1:-/backups}"
RETENTION_DAYS=14
STAMP="$(date +%Y-%m-%d_%H%M%S)"
FILE="$TARGET_DIR/workshop-hub_$STAMP.sql.gz"

mkdir -p "$TARGET_DIR"
pg_dump --no-owner --no-privileges | gzip > "$FILE"
echo "Backup written: $FILE"

find "$TARGET_DIR" -name 'workshop-hub_*.sql.gz' -mtime "+$RETENTION_DAYS" -delete
