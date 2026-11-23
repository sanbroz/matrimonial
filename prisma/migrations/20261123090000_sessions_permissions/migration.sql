-- Staff permissions (null = defaults)
ALTER TABLE "User" ADD COLUMN "permissions" JSONB;

-- Signed-out sessions
CREATE TABLE "RevokedSession" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RevokedSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RevokedSession_expiresAt_idx" ON "RevokedSession"("expiresAt");
