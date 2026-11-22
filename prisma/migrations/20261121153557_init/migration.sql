-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'STAFF');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('PHONE', 'WHATSAPP', 'WALK_IN', 'REFERRAL', 'SOCIAL_MEDIA', 'NEWSPAPER', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'FOLLOW_UP', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('NEVER_MARRIED', 'DIVORCED', 'AWAITING_DIVORCE', 'WIDOWED', 'ANNULLED');

-- CreateEnum
CREATE TYPE "ProfileStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'MATCHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "NoteKind" AS ENUM ('CALL', 'VISIT', 'WHATSAPP', 'OTHER');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('SHARED', 'INTERESTED', 'DECLINED', 'MEETING_SCHEDULED', 'MET', 'MATCHED', 'DROPPED');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('REGISTRATION', 'MEMBERSHIP', 'SUCCESS_FEE', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'UPI', 'BANK', 'CHEQUE', 'OTHER');

-- CreateEnum
CREATE TYPE "DueStatus" AS ENUM ('OPEN', 'PAID', 'WAIVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STAFF',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "bureauName" TEXT NOT NULL DEFAULT 'My Matrimonial Bureau',
    "tagline" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "address" TEXT,
    "logoPath" TEXT,
    "profileCodePrefix" TEXT NOT NULL DEFAULT 'PM',
    "nextProfileNumber" INTEGER NOT NULL DEFAULT 1001,
    "registrationFee" INTEGER NOT NULL DEFAULT 0,
    "successFeeDefault" INTEGER NOT NULL DEFAULT 0,
    "receiptPrefix" TEXT NOT NULL DEFAULT 'R',
    "nextReceiptNumber" INTEGER NOT NULL DEFAULT 1,
    "biodataOptions" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptionItem" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OptionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "introLimit" INTEGER,
    "successFee" INTEGER,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "altPhone" TEXT,
    "source" "LeadSource" NOT NULL DEFAULT 'PHONE',
    "forWhom" TEXT,
    "gender" "Gender",
    "city" TEXT,
    "details" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "lostReason" TEXT,
    "assignedToId" TEXT,
    "createdById" TEXT NOT NULL,
    "profileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "ProfileStatus" NOT NULL DEFAULT 'ACTIVE',
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "vip" BOOLEAN NOT NULL DEFAULT false,
    "specialCase" BOOLEAN NOT NULL DEFAULT false,
    "fullName" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "dob" DATE,
    "birthTime" TEXT,
    "birthPlace" TEXT,
    "heightCm" INTEGER,
    "weightKg" INTEGER,
    "complexion" TEXT,
    "bodyType" TEXT,
    "maritalStatus" "MaritalStatus" NOT NULL DEFAULT 'NEVER_MARRIED',
    "childrenCount" INTEGER NOT NULL DEFAULT 0,
    "childrenLivingWith" TEXT,
    "disability" TEXT,
    "diet" TEXT,
    "smoking" TEXT,
    "drinking" TEXT,
    "motherTongue" TEXT,
    "about" TEXT,
    "religion" TEXT,
    "caste" TEXT,
    "subCaste" TEXT,
    "gotraSelf" TEXT,
    "gotraMother" TEXT,
    "gotraGrandmother" TEXT,
    "sikhStatus" TEXT,
    "manglik" TEXT,
    "rashi" TEXT,
    "nakshatra" TEXT,
    "kundliPath" TEXT,
    "education" TEXT,
    "educationDetail" TEXT,
    "profession" TEXT,
    "employer" TEXT,
    "annualIncome" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT DEFAULT 'India',
    "nativePlace" TEXT,
    "nativeDistrict" TEXT,
    "visaStatus" TEXT,
    "willingAbroad" TEXT,
    "fatherName" TEXT,
    "fatherOccupation" TEXT,
    "motherName" TEXT,
    "motherOccupation" TEXT,
    "brothers" INTEGER,
    "brothersMarried" INTEGER,
    "sisters" INTEGER,
    "sistersMarried" INTEGER,
    "familyType" TEXT,
    "familyValues" TEXT,
    "property" TEXT,
    "contactName" TEXT,
    "contactRelation" TEXT,
    "phone" TEXT,
    "altPhone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "consentAt" TIMESTAMP(3),
    "importedFrom" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerPreference" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "ageMin" INTEGER,
    "ageMax" INTEGER,
    "heightMinCm" INTEGER,
    "heightMaxCm" INTEGER,
    "religions" TEXT[],
    "castes" TEXT[],
    "excludeCastes" TEXT[],
    "casteNoBar" BOOLEAN NOT NULL DEFAULT false,
    "maritalStatuses" "MaritalStatus"[],
    "manglik" TEXT,
    "countries" TEXT[],
    "education" TEXT,
    "minIncome" TEXT,
    "diet" TEXT,
    "notes" TEXT,

    CONSTRAINT "PartnerPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "onBiodata" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "kind" "NoteKind" NOT NULL DEFAULT 'CALL',
    "body" TEXT NOT NULL,
    "leadId" TEXT,
    "profileId" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "leadId" TEXT,
    "profileId" TEXT,
    "assignedToId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "fromProfileId" TEXT NOT NULL,
    "toProfileId" TEXT NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'SHARED',
    "declineReason" TEXT,
    "meetingAt" TIMESTAMP(3),
    "matchedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "price" INTEGER NOT NULL,
    "successFee" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "receiptNo" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "kind" "PaymentKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "mode" "PaymentMode" NOT NULL DEFAULT 'CASH',
    "reference" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "membershipId" TEXT,
    "dueId" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Due" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "kind" "PaymentKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "DueStatus" NOT NULL DEFAULT 'OPEN',
    "proposalId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Due_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "OptionItem_category_sortOrder_idx" ON "OptionItem"("category", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "OptionItem_category_value_key" ON "OptionItem"("category", "value");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_profileId_key" ON "Lead"("profileId");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_phone_idx" ON "Lead"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_code_key" ON "Profile"("code");

-- CreateIndex
CREATE INDEX "Profile_gender_status_idx" ON "Profile"("gender", "status");

-- CreateIndex
CREATE INDEX "Profile_religion_caste_idx" ON "Profile"("religion", "caste");

-- CreateIndex
CREATE INDEX "Profile_phone_idx" ON "Profile"("phone");

-- CreateIndex
CREATE INDEX "Profile_fullName_idx" ON "Profile"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerPreference_profileId_key" ON "PartnerPreference"("profileId");

-- CreateIndex
CREATE INDEX "Note_leadId_idx" ON "Note"("leadId");

-- CreateIndex
CREATE INDEX "Note_profileId_idx" ON "Note"("profileId");

-- CreateIndex
CREATE INDEX "FollowUp_done_dueAt_idx" ON "FollowUp"("done", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_fromProfileId_toProfileId_key" ON "Proposal"("fromProfileId", "toProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptNo_key" ON "Payment"("receiptNo");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPreference" ADD CONSTRAINT "PartnerPreference_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_fromProfileId_fkey" FOREIGN KEY ("fromProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_toProfileId_fkey" FOREIGN KEY ("toProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_dueId_fkey" FOREIGN KEY ("dueId") REFERENCES "Due"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Due" ADD CONSTRAINT "Due_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Due" ADD CONSTRAINT "Due_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
