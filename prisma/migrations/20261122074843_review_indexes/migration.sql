-- CreateIndex
CREATE INDEX "Due_proposalId_idx" ON "Due"("proposalId");

-- CreateIndex
CREATE INDEX "FollowUp_profileId_idx" ON "FollowUp"("profileId");

-- CreateIndex
CREATE INDEX "FollowUp_leadId_idx" ON "FollowUp"("leadId");

-- CreateIndex
CREATE INDEX "Membership_profileId_startDate_idx" ON "Membership"("profileId", "startDate");

-- CreateIndex
CREATE INDEX "Payment_dueId_idx" ON "Payment"("dueId");

-- CreateIndex
CREATE INDEX "Photo_profileId_idx" ON "Photo"("profileId");

-- CreateIndex
CREATE INDEX "Proposal_toProfileId_idx" ON "Proposal"("toProfileId");

-- CreateIndex
CREATE INDEX "Proposal_fromProfileId_createdAt_idx" ON "Proposal"("fromProfileId", "createdAt");
