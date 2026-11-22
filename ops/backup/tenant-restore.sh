#!/usr/bin/env bash
# Restore ONE bureau from one of its own server-held backups. Other bureaus are never touched.
#   tenant-restore.sh <slug> <schema> <file name in /backups/tenants/<slug>/>
# The current data is renamed aside first and only dropped once the restore succeeded,
# so a failed restore leaves the bureau exactly as it was.
set -euo pipefail

SLUG="${1:?slug}"
SCHEMA="${2:?schema}"
NAME="${3:?file}"
[[ "$SLUG" =~ ^[a-z][a-z0-9-]{1,29}$ ]] || { echo "bad slug"; exit 2; }
[[ "$SCHEMA" =~ ^t_[a-z0-9_]{1,40}$ ]] || { echo "bad schema"; exit 2; }
[[ "$NAME" =~ ^[a-z0-9_-]+\.tar\.enc$ && "$NAME" == "${SLUG}_"* ]] || { echo "bad file name"; exit 2; }
FILE="/backups/tenants/$SLUG/$NAME"
[ -f "$FILE" ] || { echo "Backup not found"; exit 1; }
: "${BACKUP_PASSPHRASE:?missing}"
export PGPASSWORD="$POSTGRES_PASSWORD"
PSQL=(psql -h db -U matri -d matrimonial -v ON_ERROR_STOP=1 -q)

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$FILE" | tar -C "$WORK" -xf - \
  || { echo "Could not decrypt the backup"; exit 1; }
grep -qx "schema=$SCHEMA" "$WORK/meta.txt" || { echo "This backup belongs to a different bureau"; exit 1; }

OLD="${SCHEMA}_old_$(date +%s)"
"${PSQL[@]}" -c "ALTER SCHEMA \"$SCHEMA\" RENAME TO \"$OLD\""
if ! pg_restore -h db -U matri -d matrimonial --no-owner --single-transaction "$WORK/db.dump"; then
  "${PSQL[@]}" -c "DROP SCHEMA IF EXISTS \"$SCHEMA\" CASCADE; ALTER SCHEMA \"$OLD\" RENAME TO \"$SCHEMA\"" || true
  echo "Database restore failed; the bureau's data was left as it was"
  exit 1
fi
"${PSQL[@]}" -c "DROP SCHEMA \"$OLD\" CASCADE"

# Files: swap the folder the same way
mkdir -p "$WORK/files"
tar -C "$WORK/files" -xzf "$WORK/uploads.tgz"
rm -rf "/data/uploads/$SLUG.old"
[ -d "/data/uploads/$SLUG" ] && mv "/data/uploads/$SLUG" "/data/uploads/$SLUG.old"
if [ -d "$WORK/files/$SLUG" ]; then mv "$WORK/files/$SLUG" "/data/uploads/$SLUG"; else mkdir -p "/data/uploads/$SLUG"; fi
chown -R 1000:1000 "/data/uploads/$SLUG"   # the app runs as user "node" (uid 1000)
rm -rf "/data/uploads/$SLUG.old"
echo "restored"
