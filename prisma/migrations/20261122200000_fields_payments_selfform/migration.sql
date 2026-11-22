-- Per-bureau profile fields, payment details, name on shared biodatas, self-fill profile links
ALTER TABLE "Settings"
  ADD COLUMN "hiddenFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "paymentUpi" TEXT,
  ADD COLUMN "paymentBank" TEXT,
  ADD COLUMN "paymentQrPath" TEXT,
  ADD COLUMN "paymentNote" TEXT;

ALTER TABLE "ShareLink" ADD COLUMN "nameMode" TEXT NOT NULL DEFAULT 'none';

CREATE TABLE "ProfileFormLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "submissions" INTEGER NOT NULL DEFAULT 0,
    "lastSubmittedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProfileFormLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProfileFormLink_token_key" ON "ProfileFormLink"("token");
CREATE INDEX "ProfileFormLink_profileId_idx" ON "ProfileFormLink"("profileId");
ALTER TABLE "ProfileFormLink" ADD CONSTRAINT "ProfileFormLink_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
