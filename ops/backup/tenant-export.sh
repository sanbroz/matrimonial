#!/usr/bin/env bash
# Re-packs one bureau backup as a password-protected 7-Zip file the owner can download and keep.
#   EXPORT_PASSWORD=... tenant-export.sh <slug> <file name> <output path>
set -euo pipefail

SLUG="${1:?slug}"
NAME="${2:?file}"
OUT="${3:?output}"
[[ "$SLUG" =~ ^[a-z][a-z0-9-]{1,29}$ ]] || { echo "bad slug"; exit 2; }
[[ "$NAME" =~ ^[a-z0-9_-]+\.tar\.enc$ && "$NAME" == "${SLUG}_"* ]] || { echo "bad file name"; exit 2; }
FILE="/backups/tenants/$SLUG/$NAME"
[ -f "$FILE" ] || { echo "Backup not found"; exit 1; }
: "${EXPORT_PASSWORD:?missing}"

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$FILE" | tar -C "$WORK" -xf -
cat > "$WORK/README.txt" <<EOF
Bureau CRM backup of "$SLUG" ($(grep '^created=' "$WORK/meta.txt" | cut -d= -f2-))

  db.dump      the database (PostgreSQL custom format; open with pg_restore)
  uploads.tgz  photos, kundli files and the logo

Keep this file safe: it contains your clients' personal details.
EOF
cd "$WORK"
7z a -t7z -mhe=on -p"$EXPORT_PASSWORD" "$OUT" db.dump uploads.tgz meta.txt README.txt >/dev/null
