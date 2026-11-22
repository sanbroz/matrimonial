# Nightly encrypted backups (whole server + each bureau) and the backup API used by the app.
FROM postgres:17-alpine
RUN apk add --no-cache rclone openssl tzdata bash coreutils nodejs 7zip
COPY backup.sh restore.sh tenant-backup.sh tenant-restore.sh tenant-export.sh /usr/local/bin/
COPY server.mjs /opt/backup/server.mjs
RUN chmod +x /usr/local/bin/*.sh
ENTRYPOINT []
CMD ["node", "/opt/backup/server.mjs"]
