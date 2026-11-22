#!/usr/bin/env bash
# First install AND every update:  ./ops/deploy.sh
# Builds the images, applies database migrations, creates the owner account on first run,
# and (re)starts everything. Safe to run repeatedly.
set -euo pipefail
export MSYS_NO_PATHCONV=1   # Git Bash on Windows: keep /container/paths as they are
cd "$(dirname "$0")/.."
[ -f .env.production ] || { echo "Missing .env.production (copy .env.production.example and fill it in)"; exit 1; }

DC="docker compose --env-file .env.production -f docker-compose.prod.yml"

echo "==> Building images"
$DC --profile tools build

echo "==> Starting database"
$DC up -d db

echo "==> Applying database migrations / first-time setup"
$DC --profile tools run --rm tools

echo "==> Starting app, web server and backups"
$DC up -d app caddy backup

echo "==> Waiting for the app"
for i in $(seq 1 30); do
  if $DC exec -T app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    echo "App is healthy."
    $DC ps
    exit 0
  fi
  sleep 2
done
echo "App did not become healthy. Logs:"; $DC logs --tail 50 app; exit 1
