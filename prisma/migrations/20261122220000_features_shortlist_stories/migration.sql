-- Per-bureau feature switches, getting-started checklist, shortlist, success stories
ALTER TABLE "Settings" ADD COLUMN "features" JSONB, ADD COLUMN "onboardingDone" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Proposal" ADD COLUMN "marriedOn" DATE, ADD COLUMN "storyNote" TEXT;

CREATE TABLE "Shortlist" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Shortlist_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Shortlist_clientId_candidateId_key" ON "Shortlist"("clientId", "candidateId");
CREATE INDEX "Shortlist_candidateId_idx" ON "Shortlist"("candidateId");
ALTER TABLE "Shortlist" ADD CONSTRAINT "Shortlist_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Shortlist" ADD CONSTRAINT "Shortlist_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing bureaus already onboarded: don't show them the getting-started checklist
UPDATE "Settings" SET "onboardingDone" = true WHERE EXISTS (SELECT 1 FROM "Profile" WHERE NOT "isDemo");
