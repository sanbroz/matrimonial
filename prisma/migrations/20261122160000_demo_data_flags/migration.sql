-- Demo (sample) data flags, so a bureau can remove the samples and keep its own data
ALTER TABLE "Profile" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lead" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Plan" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- Profiles added by the earlier demo script
UPDATE "Profile" SET "isDemo" = true WHERE "importedFrom" = 'Demo data';

CREATE INDEX "Profile_isDemo_idx" ON "Profile"("isDemo") WHERE "isDemo";
