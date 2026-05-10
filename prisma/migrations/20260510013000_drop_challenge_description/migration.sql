-- AlterTable
ALTER TABLE "Challenge"
DROP COLUMN "description",
DROP COLUMN "category",
DROP COLUMN "availability",
DROP COLUMN "requiresReview",
DROP COLUMN "evidencePrompt";

-- DropEnum
DROP TYPE "ChallengeAvailability";