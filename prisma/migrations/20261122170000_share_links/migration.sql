-- Public, expiring share links for one or more biodatas
CREATE TABLE "ShareLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "title" TEXT,
    "profileIds" TEXT[],
    "forProfileId" TEXT,
    "layout" TEXT NOT NULL,
    "sections" TEXT[],
    "lang" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "views" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ShareLink_token_key" ON "ShareLink"("token");
CREATE INDEX "ShareLink_createdAt_idx" ON "ShareLink"("createdAt");
CREATE INDEX "ShareLink_forProfileId_idx" ON "ShareLink"("forProfileId");
