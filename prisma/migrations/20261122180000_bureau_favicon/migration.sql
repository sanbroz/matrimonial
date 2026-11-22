-- Per-bureau browser-tab icon (overrides the platform icon)
ALTER TABLE "Settings" ADD COLUMN "favicon" BYTEA, ADD COLUMN "faviconType" TEXT;
