#!/usr/bin/env bash
# Restore a backup made by backup.sh. REPLACES the current database and uploaded files.
#   restore.sh backup_2026-11-22_0230.tar.enc   (a file name in /backups, or a full path)
# Run it through ./ops/restore.sh on the server, which stops the app first.
set -euo pipefail

FILE="${1:?usage: restore.sh <backup file>}"
[ -f "$FILE" ] || FILE="/backups/$FILE"
[ -f "$FILE" ] || { echo "Backup not found: $1"; exit 1; }
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE must be set}"

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

echo "Decrypting $FILE"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$FILE" | tar -C "$WORK" -xf - \
  || { echo "Could not decrypt. Wrong BACKUP_PASSPHRASE?"; exit 1; }
echo "Backup created: $(cat "$WORK/created.txt" 2>/dev/null || echo unknown)"

echo "Restoring database"
PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -h db -U matri -d matrimonial --clean --if-exists --no-owner --single-transaction "$WORK/db.dump"

echo "Restoring uploaded files"
mkdir -p /data/uploads
find /data/uploads -mindepth 1 -delete
tar -C /data -xzf "$WORK/uploads.tgz"
chown -R 1000:1000 /data/uploads   # the app runs as user "node" (uid 1000)

echo "Restore complete"
