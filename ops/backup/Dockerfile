# Nightly encrypted backups of the database and uploaded files.
FROM postgres:17-alpine
RUN apk add --no-cache rclone openssl tzdata bash coreutils
COPY backup.sh restore.sh scheduler.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/scheduler.sh
ENTRYPOINT []
CMD ["/usr/local/bin/scheduler.sh"]
