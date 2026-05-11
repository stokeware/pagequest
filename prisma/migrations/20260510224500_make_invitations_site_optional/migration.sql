ALTER TABLE "Invitation"
DROP CONSTRAINT "Invitation_campaignId_fkey";

DROP INDEX "Invitation_campaignId_email_key";

ALTER TABLE "Invitation"
ALTER COLUMN "campaignId" DROP NOT NULL;

CREATE INDEX "Invitation_email_status_createdAt_idx"
ON "Invitation"("email", "status", "createdAt");

ALTER TABLE "Invitation"
ADD CONSTRAINT "Invitation_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id")
ON DELETE SET NULL ON UPDATE CASCADE;