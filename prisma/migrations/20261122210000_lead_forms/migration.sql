-- Trackable public lead form links (website, email footer, WhatsApp, Facebook, Instagram, campaigns)
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'WEBSITE';
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'EMAIL';

CREATE TABLE "LeadForm" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "heading" TEXT,
    "message" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadForm_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LeadForm_token_key" ON "LeadForm"("token");

ALTER TABLE "Lead" ADD COLUMN "leadFormId" TEXT;
CREATE INDEX "Lead_leadFormId_idx" ON "Lead"("leadFormId");
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_leadFormId_fkey" FOREIGN KEY ("leadFormId") REFERENCES "LeadForm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
