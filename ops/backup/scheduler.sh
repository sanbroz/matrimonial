#!/usr/bin/env bash
# Runs backup.sh once a day at BACKUP_TIME (India time, TZ is set by docker compose).
set -u
TIME="${BACKUP_TIME:-02:30}"
echo "Backup scheduler started: daily at ${TIME} ($(date +%Z))"

while true; do
  now=$(date +%s)
  next=$(date -d "today ${TIME}" +%s)
  if [ "$next" -le "$now" ]; then next=$((next + 86400)); fi
  sleep $((next - now))
  /usr/local/bin/backup.sh || echo "$(date '+%F %T') BACKUP FAILED (see above)"
done
