DROP INDEX IF EXISTS "ReadingEntry_campaignParticipantId_deletedAt_activityDate_idx";

CREATE INDEX "CampaignParticipant_campaignId_removedAt_standings_idx"
ON "CampaignParticipant" (
    "campaignId",
    "removedAt",
    "totalPoints" DESC,
    "totalPages" DESC,
    "totalAudiobookMinutes" DESC,
    "totalBooks" DESC,
    "createdAt" ASC
);

CREATE INDEX "CampaignParticipant_userId_removedAt_createdAt_idx"
ON "CampaignParticipant" (
    "userId",
    "removedAt",
    "createdAt" DESC
);

CREATE INDEX "ReadingEntry_participant_deletedAt_activityDate_createdAt_idx"
ON "ReadingEntry" (
    "campaignParticipantId",
    "deletedAt",
    "activityDate" DESC,
    "createdAt" DESC
);