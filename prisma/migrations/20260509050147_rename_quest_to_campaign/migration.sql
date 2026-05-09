-- AlterTable
ALTER TABLE "Campaign" RENAME CONSTRAINT "Quest_pkey" TO "Campaign_pkey";

-- RenameForeignKey
ALTER TABLE "Campaign" RENAME CONSTRAINT "Quest_createdByUserId_fkey" TO "Campaign_createdByUserId_fkey";
