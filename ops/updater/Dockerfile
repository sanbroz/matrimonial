# Updater: lets the owner install a new release from inside the app.
# It can only (1) report which code is on the server and (2) run ops/backup-now.sh + ops/deploy.sh.
# It has the Docker socket (needed to rebuild/restart containers), is not published on any port,
# and every request needs UPDATER_TOKEN.
FROM docker:29-cli
RUN apk add --no-cache nodejs git bash coreutils openssl \
 && git config --system safe.directory '*'
COPY server.mjs /opt/updater/server.mjs
WORKDIR /repo
# The docker image's entrypoint would prefix commands with "docker"; run node directly
ENTRYPOINT []
CMD ["node", "/opt/updater/server.mjs"]
