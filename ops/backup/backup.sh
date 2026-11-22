#!/usr/bin/env bash
# One encrypted backup file containing the database dump and all uploaded files.
#   /backups/backup_YYYY-MM-DD_HHMM.tar.enc   (AES-256, key = BACKUP_PASSPHRASE)
# Keeps BACKUP_KEEP_DAYS days locally; optionally copies to BACKUP_REMOTE with rclone.
set -euo pipefail

: "${POSTGRES_PASSWORD:?missing}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE must be set in .env.production}"
KEEP="${BACKUP_KEEP_DAYS:-14}"
STAMP=$(date +%Y-%m-%d_%H%M)
OUT="/backups/backup_${STAMP}.tar.enc"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

echo "$(date '+%F %T') backup starting"
PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h db -U matri -d matrimonial -Fc -f "$WORK/db.dump"
# No files yet: archive an empty folder (busybox tar refuses an empty archive)
[ -d /data/uploads ] && SRC=/data || { SRC="$WORK/empty"; mkdir -p "$SRC/uploads"; }
tar -C "$SRC" -czf "$WORK/uploads.tgz" uploads
date '+%F %T' > "$WORK/created.txt"

mkdir -p /backups
tar -C "$WORK" -cf - db.dump uploads.tgz created.txt \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -out "$OUT.part"
mv "$OUT.part" "$OUT"
echo "$(date '+%F %T') wrote $OUT ($(du -h "$OUT" | cut -f1))"

find /backups -name 'backup_*.tar.enc' -mtime +"$KEEP" -print -delete | sed 's/^/removed old: /' || true

if [ -n "${BACKUP_REMOTE:-}" ]; then
  rclone copy "$OUT" "$BACKUP_REMOTE" --s3-no-check-bucket
  rclone delete "$BACKUP_REMOTE" --min-age "${BACKUP_REMOTE_KEEP_DAYS:-60}d" --include 'backup_*.tar.enc' || true
  echo "$(date '+%F %T') copied to $BACKUP_REMOTE"
fi
echo "$(date '+%F %T') backup done"
