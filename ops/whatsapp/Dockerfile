# WhatsApp sender (Baileys). The linked-device session lives in the "whatsapp_auth" volume.
FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server.mjs ./
RUN mkdir -p /data && chown -R node:node /data
USER node
CMD ["node", "server.mjs"]
