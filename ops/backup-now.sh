#!/usr/bin/env bash
# Take a backup right now (also handy before an update) and list the backups on the server.
set -euo pipefail
export MSYS_NO_PATHCONV=1   # Git Bash on Windows: keep /container/paths as they are
cd "$(dirname "$0")/.."
DC="docker compose --env-file .env.production -f docker-compose.prod.yml"
$DC exec -T backup /usr/local/bin/backup.sh
$DC exec -T backup sh -c 'ls -lh /backups'
