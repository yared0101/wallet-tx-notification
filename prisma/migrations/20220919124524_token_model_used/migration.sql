/*
  Warnings:

  - You are about to drop the column `blackListedTokens` on the `Channel` table. All the data in the column will be lost.
  - You are about to drop the column `buyBlackListedTokens` on the `Channel` table. All the data in the column will be lost.
  - Added the required column `name` to the `BlackListContracts` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "BlackListContracts_contractId_key";

-- AlterTable
ALTER TABLE "BlackListContracts" ADD COLUMN     "buyChannelId" INTEGER,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "sellChannelId" INTEGER;

-- AlterTable
ALTER TABLE "Channel" DROP COLUMN "blackListedTokens",
DROP COLUMN "buyBlackListedTokens";

-- AddForeignKey
ALTER TABLE "BlackListContracts" ADD CONSTRAINT "BlackListContracts_sellChannelId_fkey" FOREIGN KEY ("sellChannelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlackListContracts" ADD CONSTRAINT "BlackListContracts_buyChannelId_fkey" FOREIGN KEY ("buyChannelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
