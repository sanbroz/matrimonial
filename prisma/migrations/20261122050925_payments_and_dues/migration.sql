/*
  Warnings:

  - Added the required column `label` to the `Due` table without a default value. This is not possible if the table is not empty.
  - Added the required column `description` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `payerName` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `profileCode` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_profileId_fkey";

-- AlterTable
ALTER TABLE "Due" ADD COLUMN     "label" TEXT NOT NULL,
ADD COLUMN     "membershipId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "payerName" TEXT NOT NULL,
ADD COLUMN     "profileCode" TEXT NOT NULL,
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidedById" TEXT,
ALTER COLUMN "profileId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Due_status_idx" ON "Due"("status");

-- CreateIndex
CREATE INDEX "Due_profileId_idx" ON "Due"("profileId");

-- CreateIndex
CREATE INDEX "Membership_endDate_idx" ON "Membership"("endDate");

-- CreateIndex
CREATE INDEX "Payment_paidAt_idx" ON "Payment"("paidAt");

-- CreateIndex
CREATE INDEX "Payment_profileId_idx" ON "Payment"("profileId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Due" ADD CONSTRAINT "Due_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
