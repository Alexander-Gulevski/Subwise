/*
  Warnings:

  - Added the required column `billingAnchorAt` to the `Subscription` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "billingAnchorAt" TIMESTAMP(3) NOT NULL;
