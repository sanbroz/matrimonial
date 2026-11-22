# WhatsApp sender (Baileys). The linked-device session lives in the "whatsapp_auth" volume.
FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
# Optional newer Baileys chosen in the app (Settings → WhatsApp → Update), via .env.production
ARG BAILEYS_VERSION=
COPY version-tools.mjs apply-override.mjs ./
RUN BAILEYS_VERSION="$BAILEYS_VERSION" node apply-override.mjs
COPY server.mjs ./
RUN mkdir -p /data && chown -R node:node /data
USER node
CMD ["node", "server.mjs"]
