# Production image for Bureau CRM.
#   runner: the slim web app (node server.js)
#   tools:  full source + dev tools, runs ops/migrate-all.ts (all bureaus' migrations) on every deploy
# Build/run via docker-compose.prod.yml (see DEPLOY.md).

FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- dependencies (cached unless package files change) ----
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# ---- build ----
FROM deps AS tools
COPY . .
RUN npm run db:generate && npx next build

# ---- runtime ----
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/data/uploads
COPY --from=tools --chown=node:node /app/.next/standalone ./
COPY --from=tools --chown=node:node /app/.next/static ./.next/static
COPY --from=tools --chown=node:node /app/public ./public
# Migrations: the console creates new bureaus (and restores old backups) by applying them itself
COPY --from=tools --chown=node:node /app/prisma/migrations ./prisma/migrations
COPY --from=tools --chown=node:node /app/prisma/platform/migrations ./prisma/platform/migrations
RUN mkdir -p /data/uploads && chown -R node:node /data
# Which code this image was built from (shown in the app; used to detect updates). Set by ops/deploy.sh.
ARG APP_COMMIT=unknown
ARG APP_BUILT_AT=
ENV APP_COMMIT=$APP_COMMIT \
    APP_BUILT_AT=$APP_BUILT_AT
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
