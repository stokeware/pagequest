-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "campaignId" TEXT,
    "campaignParticipantId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "metadata" JSONB,
    "scheduledFor" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_idempotencyKey_key" ON "NotificationDelivery"("idempotencyKey");

-- CreateIndex
CREATE INDEX "NotificationDelivery_kind_status_scheduledFor_idx" ON "NotificationDelivery"("kind", "status", "scheduledFor");

-- CreateIndex
CREATE INDEX "NotificationDelivery_campaignParticipantId_kind_sentAt_idx" ON "NotificationDelivery"("campaignParticipantId", "kind", "sentAt");

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_campaignParticipantId_fkey" FOREIGN KEY ("campaignParticipantId") REFERENCES "CampaignParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;