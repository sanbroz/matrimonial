#!/usr/bin/env bash
# Encrypted backup of ONE bureau: its database schema + its uploaded files.
#   tenant-backup.sh <slug> <schema> [label]
#   → /backups/tenants/<slug>/<slug>_YYYY-MM-DD_HHMMSS[_label].tar.enc  (AES-256, key = BACKUP_PASSPHRASE)
# Prints the file name on the last line.
set -euo pipefail

SLUG="${1:?slug}"
SCHEMA="${2:?schema}"
LABEL="${3:-}"
[[ "$SLUG" =~ ^[a-z][a-z0-9-]{1,29}$ ]] || { echo "bad slug"; exit 2; }
[[ "$SCHEMA" =~ ^t_[a-z0-9_]{1,40}$ ]] || { echo "bad schema"; exit 2; }
[[ -z "$LABEL" || "$LABEL" =~ ^[a-z0-9-]{1,20}$ ]] || { echo "bad label"; exit 2; }
: "${POSTGRES_PASSWORD:?missing}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE must be set in .env.production}"
KEEP="${BACKUP_KEEP_DAYS:-14}"

DIR="/backups/tenants/$SLUG"
NAME="${SLUG}_$(date +%Y-%m-%d_%H%M%S)${LABEL:+_$LABEL}.tar.enc"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h db -U matri -d matrimonial -n "$SCHEMA" -Fc -f "$WORK/db.dump"
if [ -d "/data/uploads/$SLUG" ]; then
  tar -C /data/uploads -czf "$WORK/uploads.tgz" "$SLUG"
else
  tar -czf "$WORK/uploads.tgz" -T /dev/null
fi
printf 'slug=%s\nschema=%s\ncreated=%s\n' "$SLUG" "$SCHEMA" "$(date '+%F %T')" > "$WORK/meta.txt"

mkdir -p "$DIR"
tar -C "$WORK" -cf - db.dump uploads.tgz meta.txt \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -out "$DIR/$NAME.part"
mv "$DIR/$NAME.part" "$DIR/$NAME"

find "$DIR" -name '*.tar.enc' -mtime +"$KEEP" -delete || true
if [ -n "${BACKUP_REMOTE:-}" ]; then
  rclone copy "$DIR/$NAME" "$BACKUP_REMOTE/tenants/$SLUG" --s3-no-check-bucket || echo "off-site copy failed"
fi
echo "$NAME"
