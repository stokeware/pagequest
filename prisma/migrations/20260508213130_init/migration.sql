-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('ADMIN', 'COMPETITOR');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CampaignVisibility" AS ENUM ('INVITE_ONLY');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ReadingEntryType" AS ENUM ('BOOK_COMPLETION', 'PAGES_READ', 'AUDIOBOOK_MINUTES', 'CHALLENGE_COMPLETION');

-- CreateEnum
CREATE TYPE "ChallengeAvailability" AS ENUM ('ONE_TIME', 'REPEATABLE');

-- CreateEnum
CREATE TYPE "ChallengeReviewState" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'AUTO_APPROVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "timezone" TEXT,
    "lastSignedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AppRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "CampaignVisibility" NOT NULL DEFAULT 'INVITE_ONLY',
    "pointsPerBook" DECIMAL(12,4) NOT NULL DEFAULT 1,
    "pointsPerPage" DECIMAL(12,4) NOT NULL DEFAULT 1,
    "pointsPerAudiobookMinute" DECIMAL(12,4) NOT NULL DEFAULT 0.75,
    "pointsPerChallengeCompletion" DECIMAL(12,4) NOT NULL DEFAULT 1,
    "challengeCategoryBonuses" JSONB,
    "entryEditWindowMinutes" INTEGER,
    "entryDeleteWindowMinutes" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignParticipant" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "totalBooks" INTEGER NOT NULL DEFAULT 0,
    "totalPages" INTEGER NOT NULL DEFAULT 0,
    "totalAudiobookMinutes" INTEGER NOT NULL DEFAULT 0,
    "totalChallenges" INTEGER NOT NULL DEFAULT 0,
    "totalPoints" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "invitedByUserId" TEXT,
    "acceptedByUserId" TEXT,
    "acceptedParticipantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "pointValue" DECIMAL(12,4),
    "availability" "ChallengeAvailability" NOT NULL DEFAULT 'ONE_TIME',
    "requiresReview" BOOLEAN NOT NULL DEFAULT false,
    "evidencePrompt" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignChallenge" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "pointValueOverride" DECIMAL(12,4),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingEntry" (
    "id" TEXT NOT NULL,
    "campaignParticipantId" TEXT NOT NULL,
    "type" "ReadingEntryType" NOT NULL,
    "value" INTEGER NOT NULL,
    "activityDate" TIMESTAMP(3) NOT NULL,
    "bookTitle" TEXT,
    "bookAuthor" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeCompletion" (
    "id" TEXT NOT NULL,
    "readingEntryId" TEXT NOT NULL,
    "campaignParticipantId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "campaignChallengeId" TEXT,
    "reviewState" "ChallengeReviewState" NOT NULL DEFAULT 'PENDING',
    "evidenceText" TEXT,
    "reviewNotes" TEXT,
    "awardedPoints" DECIMAL(12,4),
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "campaignId" TEXT,
    "campaignParticipantId" TEXT,
    "invitationId" TEXT,
    "challengeId" TEXT,
    "challengeCompletionId" TEXT,
    "readingEntryId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RoleAssignment_userId_role_key" ON "RoleAssignment"("userId", "role");

-- CreateIndex
CREATE INDEX "CampaignParticipant_campaignId_totalPoints_lastActivityAt_idx" ON "CampaignParticipant"("campaignId", "totalPoints", "lastActivityAt");

-- CreateIndex
CREATE INDEX "CampaignParticipant_userId_lastActivityAt_idx" ON "CampaignParticipant"("userId", "lastActivityAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignParticipant_campaignId_userId_key" ON "CampaignParticipant"("campaignId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_acceptedParticipantId_key" ON "Invitation"("acceptedParticipantId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_campaignId_email_key" ON "Invitation"("campaignId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignChallenge_campaignId_challengeId_key" ON "CampaignChallenge"("campaignId", "challengeId");

-- CreateIndex
CREATE INDEX "ReadingEntry_campaignParticipantId_deletedAt_activityDate_idx" ON "ReadingEntry"("campaignParticipantId", "deletedAt", "activityDate");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeCompletion_readingEntryId_key" ON "ChallengeCompletion"("readingEntryId");

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Quest_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignParticipant" ADD CONSTRAINT "CampaignParticipant_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignParticipant" ADD CONSTRAINT "CampaignParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_acceptedParticipantId_fkey" FOREIGN KEY ("acceptedParticipantId") REFERENCES "CampaignParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignChallenge" ADD CONSTRAINT "CampaignChallenge_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignChallenge" ADD CONSTRAINT "CampaignChallenge_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingEntry" ADD CONSTRAINT "ReadingEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingEntry" ADD CONSTRAINT "ReadingEntry_campaignParticipantId_fkey" FOREIGN KEY ("campaignParticipantId") REFERENCES "CampaignParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingEntry" ADD CONSTRAINT "ReadingEntry_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeCompletion" ADD CONSTRAINT "ChallengeCompletion_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeCompletion" ADD CONSTRAINT "ChallengeCompletion_campaignChallengeId_fkey" FOREIGN KEY ("campaignChallengeId") REFERENCES "CampaignChallenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeCompletion" ADD CONSTRAINT "ChallengeCompletion_campaignParticipantId_fkey" FOREIGN KEY ("campaignParticipantId") REFERENCES "CampaignParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeCompletion" ADD CONSTRAINT "ChallengeCompletion_readingEntryId_fkey" FOREIGN KEY ("readingEntryId") REFERENCES "ReadingEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeCompletion" ADD CONSTRAINT "ChallengeCompletion_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_challengeCompletionId_fkey" FOREIGN KEY ("challengeCompletionId") REFERENCES "ChallengeCompletion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_campaignParticipantId_fkey" FOREIGN KEY ("campaignParticipantId") REFERENCES "CampaignParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_readingEntryId_fkey" FOREIGN KEY ("readingEntryId") REFERENCES "ReadingEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
