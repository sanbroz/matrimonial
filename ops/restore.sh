#!/usr/bin/env bash
# Restore a backup:  ./ops/restore.sh backup_2026-11-22_0230.tar.enc
# To restore a file downloaded from off-site storage, first copy it into the backups volume:
#   docker compose --env-file .env.production -f docker-compose.prod.yml cp FILE backup:/backups/
set -euo pipefail
export MSYS_NO_PATHCONV=1   # Git Bash on Windows: keep /container/paths as they are
cd "$(dirname "$0")/.."
FILE="${1:?usage: ./ops/restore.sh <backup file name>   (see ./ops/backup-now.sh for the list)}"
DC="docker compose --env-file .env.production -f docker-compose.prod.yml"

read -r -p "This REPLACES all current data with ${FILE}. Type RESTORE to continue: " ok
[ "$ok" = "RESTORE" ] || { echo "Cancelled."; exit 1; }

echo "==> Stopping the app"
$DC stop app
echo "==> Restoring"
$DC exec -T backup /usr/local/bin/restore.sh "$FILE"
echo "==> Applying any newer migrations"
$DC --profile tools run --rm tools
echo "==> Starting the app"
$DC up -d app
echo "Done."
