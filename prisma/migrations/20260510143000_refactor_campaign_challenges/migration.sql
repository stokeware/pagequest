-- CreateEnum
CREATE TYPE "ChallengeKind" AS ENUM (
    'ADMIN',
    'RECOMMENDATION_TEMPLATE',
    'PERSONAL_GOAL_TEMPLATE',
    'RECOMMENDATION_INSTANCE',
    'PERSONAL_GOAL_INSTANCE'
);

-- CreateEnum
CREATE TYPE "ParticipantChallengeSourceKind" AS ENUM (
    'RECOMMENDATION',
    'PERSONAL_GOAL'
);

-- CreateTable
CREATE TABLE "Challenge_next" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "ChallengeKind" NOT NULL DEFAULT 'ADMIN',
    "pointValue" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "pageMinuteMultiplier" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "createdByUserId" TEXT,
    "ownerParticipantId" TEXT,
    "templateChallengeId" TEXT,
    "sourceBookTitle" TEXT,
    "normalizedSourceBookTitle" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Challenge_next_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Challenge_next" (
    "id",
    "campaignId",
    "title",
    "kind",
    "pointValue",
    "pageMinuteMultiplier",
    "createdByUserId",
    "ownerParticipantId",
    "templateChallengeId",
    "sourceBookTitle",
    "normalizedSourceBookTitle",
    "isActive",
    "createdAt",
    "updatedAt"
)
SELECT
    assignment."id",
    assignment."campaignId",
    challenge."title",
    'ADMIN'::"ChallengeKind",
    COALESCE(assignment."pointValueOverride", challenge."pointValue", 0),
    0,
    challenge."createdByUserId",
    NULL,
    NULL,
    NULL,
    NULL,
    assignment."isActive",
    LEAST(challenge."createdAt", assignment."createdAt"),
    GREATEST(challenge."updatedAt", assignment."updatedAt")
FROM "CampaignChallenge" assignment
INNER JOIN "Challenge" challenge
    ON challenge."id" = assignment."challengeId";

INSERT INTO "Challenge_next" (
    "id",
    "campaignId",
    "title",
    "kind",
    "pointValue",
    "pageMinuteMultiplier",
    "createdByUserId",
    "ownerParticipantId",
    "templateChallengeId",
    "sourceBookTitle",
    "normalizedSourceBookTitle",
    "isActive",
    "createdAt",
    "updatedAt"
)
SELECT
    campaign."id" || '-recommendation-template',
    campaign."id",
    'Recommendation',
    'RECOMMENDATION_TEMPLATE'::"ChallengeKind",
    0,
    0,
    campaign."createdByUserId",
    NULL,
    NULL,
    NULL,
    NULL,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Campaign" campaign;

INSERT INTO "Challenge_next" (
    "id",
    "campaignId",
    "title",
    "kind",
    "pointValue",
    "pageMinuteMultiplier",
    "createdByUserId",
    "ownerParticipantId",
    "templateChallengeId",
    "sourceBookTitle",
    "normalizedSourceBookTitle",
    "isActive",
    "createdAt",
    "updatedAt"
)
SELECT
    campaign."id" || '-personal-goal-template',
    campaign."id",
    'Personal Goal',
    'PERSONAL_GOAL_TEMPLATE'::"ChallengeKind",
    0,
    COALESCE(
        NULLIF(
            campaign."challengeCategoryBonuses" ->> 'epicReadPageMultiplier',
            ''
        )::DECIMAL(12,4),
        0
    ),
    campaign."createdByUserId",
    NULL,
    NULL,
    NULL,
    NULL,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Campaign" campaign;

ALTER TABLE "ChallengeCompletion"
DROP CONSTRAINT IF EXISTS "ChallengeCompletion_challengeId_fkey";

ALTER TABLE "ChallengeCompletion"
DROP CONSTRAINT IF EXISTS "ChallengeCompletion_campaignChallengeId_fkey";

UPDATE "ChallengeCompletion"
SET "challengeId" = "campaignChallengeId"
WHERE "campaignChallengeId" IS NOT NULL;

UPDATE "ChallengeCompletion" completion
SET "challengeId" = assignment."id"
FROM "CampaignParticipant" participant
INNER JOIN "CampaignChallenge" assignment
        ON assignment."campaignId" = participant."campaignId"
WHERE completion."campaignChallengeId" IS NULL
    AND assignment."challengeId" = completion."challengeId"
  AND participant."id" = completion."campaignParticipantId";

ALTER TABLE "AuditLog"
DROP CONSTRAINT IF EXISTS "AuditLog_challengeId_fkey";

UPDATE "AuditLog" log
SET "challengeId" = assignment."id"
FROM "CampaignChallenge" assignment
WHERE log."challengeId" = assignment."challengeId"
  AND (
      log."campaignId" = assignment."campaignId"
      OR log."entityId" = assignment."id"
  );

UPDATE "AuditLog" log
SET "challengeId" = NULL
WHERE log."challengeId" IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM "Challenge_next" challenge
      WHERE challenge."id" = log."challengeId"
  );

ALTER TABLE "ChallengeCompletion"
DROP COLUMN "campaignChallengeId";

CREATE TABLE "ParticipantChallengeSource" (
    "id" TEXT NOT NULL,
    "campaignParticipantId" TEXT NOT NULL,
    "kind" "ParticipantChallengeSourceKind" NOT NULL,
    "bookTitle" TEXT NOT NULL,
    "normalizedBookTitle" TEXT NOT NULL,
    "generatedChallengeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParticipantChallengeSource_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Challenge"
RENAME TO "Challenge_old";

ALTER TABLE "Challenge_next"
RENAME TO "Challenge";

DROP TABLE "CampaignChallenge";
DROP TABLE "Challenge_old";

ALTER TABLE "Challenge"
RENAME CONSTRAINT "Challenge_next_pkey" TO "Challenge_pkey";

CREATE UNIQUE INDEX "Challenge_campaignId_title_key"
ON "Challenge"("campaignId", "title");

CREATE UNIQUE INDEX "Challenge_ownerParticipantId_kind_key"
ON "Challenge"("ownerParticipantId", "kind");

CREATE INDEX "Challenge_campaignId_kind_isActive_idx"
ON "Challenge"("campaignId", "kind", "isActive");

CREATE INDEX "Challenge_campaignId_ownerParticipantId_kind_idx"
ON "Challenge"("campaignId", "ownerParticipantId", "kind");

CREATE INDEX "Challenge_campaignId_normalizedSourceBookTitle_idx"
ON "Challenge"("campaignId", "normalizedSourceBookTitle");

CREATE INDEX "ChallengeCompletion_participantId_challengeId_idx"
ON "ChallengeCompletion"("campaignParticipantId", "challengeId");

CREATE UNIQUE INDEX "ParticipantChallengeSource_campaignParticipantId_kind_key"
ON "ParticipantChallengeSource"("campaignParticipantId", "kind");

CREATE UNIQUE INDEX "ParticipantChallengeSource_generatedChallengeId_key"
ON "ParticipantChallengeSource"("generatedChallengeId");

CREATE INDEX "ParticipantChallengeSource_title_idx"
ON "ParticipantChallengeSource"("campaignParticipantId", "normalizedBookTitle");

ALTER TABLE "Challenge"
ADD CONSTRAINT "Challenge_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Challenge"
ADD CONSTRAINT "Challenge_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Challenge"
ADD CONSTRAINT "Challenge_ownerParticipantId_fkey"
FOREIGN KEY ("ownerParticipantId") REFERENCES "CampaignParticipant"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Challenge"
ADD CONSTRAINT "Challenge_templateChallengeId_fkey"
FOREIGN KEY ("templateChallengeId") REFERENCES "Challenge"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ParticipantChallengeSource"
ADD CONSTRAINT "ParticipantChallengeSource_campaignParticipantId_fkey"
FOREIGN KEY ("campaignParticipantId") REFERENCES "CampaignParticipant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParticipantChallengeSource"
ADD CONSTRAINT "ParticipantChallengeSource_generatedChallengeId_fkey"
FOREIGN KEY ("generatedChallengeId") REFERENCES "Challenge"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChallengeCompletion"
ADD CONSTRAINT "ChallengeCompletion_challengeId_fkey"
FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AuditLog"
ADD CONSTRAINT "AuditLog_challengeId_fkey"
FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
