-- Bureaus that only share profiles can switch meeting stages off
ALTER TABLE "Settings" ADD COLUMN "trackMeetings" BOOLEAN NOT NULL DEFAULT true;
