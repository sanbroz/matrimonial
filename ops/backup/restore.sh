#!/usr/bin/env bash
# Restore a FULL backup made by backup.sh: the whole server (every bureau + the platform) goes back to
# that moment. REPLACES the current database and uploaded files.
#   restore.sh backup_2026-11-22_0230.tar.enc   (a file name in /backups, or a full path)
# Run it through ./ops/restore.sh on the server, which stops the app first and runs migrations after.
#
# Works for backups from before multi-bureau support (v1, one bureau in schema "public") too:
# the old data comes back into "public" and ops/migrate-all.ts (run next by ops/restore.sh) moves it into
# bureau FIRST_TENANT_SLUG again. To restore ONE bureau, use the console or that bureau's Settings → Backups.
set -euo pipefail

FILE="${1:?usage: restore.sh <backup file>}"
[ -f "$FILE" ] || FILE="/backups/$FILE"
[ -f "$FILE" ] || { echo "Backup not found: $1"; exit 1; }
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE must be set}"
export PGPASSWORD="$POSTGRES_PASSWORD"

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

echo "Decrypting $FILE"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$FILE" | tar -C "$WORK" -xf - \
  || { echo "Could not decrypt. Wrong BACKUP_PASSPHRASE?"; exit 1; }
echo "Backup created: $(cat "$WORK/created.txt" 2>/dev/null || echo unknown)"

if pg_restore -l "$WORK/db.dump" | grep -q "SCHEMA - platform "; then
  echo "Multi-bureau backup"
else
  echo "Backup from before multi-bureau support: the server goes back to that single bureau"
fi

# Everything in ONE transaction: drop the current platform + bureau schemas, then load the dump.
# If anything fails, nothing changes.
SCHEMAS=$(psql -h db -U matri -d matrimonial -At -c "SELECT string_agg(format('%I', schema_name), ',') FROM information_schema.schemata WHERE schema_name = 'platform' OR schema_name LIKE 't\_%'")
echo "Restoring database"
{
  echo "SET client_min_messages = warning;"
  [ -n "$SCHEMAS" ] && echo "DROP SCHEMA IF EXISTS $SCHEMAS CASCADE;"
  # Empty "public" so a v1 dump loads cleanly (a v2 dump recreates what it needs)
  echo "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
  pg_restore --no-owner -f - "$WORK/db.dump" | grep -v '^CREATE SCHEMA public;$'
} | psql -h db -U matri -d matrimonial -v ON_ERROR_STOP=1 --single-transaction -q >/dev/null

echo "Restoring uploaded files"
mkdir -p /data/uploads
find /data/uploads -mindepth 1 -delete
tar -C /data -xzf "$WORK/uploads.tgz"
chown -R 1000:1000 /data/uploads   # the app runs as user "node" (uid 1000)

echo "Restore complete"
