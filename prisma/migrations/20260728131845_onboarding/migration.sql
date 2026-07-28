-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "isPopular" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "onboardedAt" TIMESTAMP(3);
