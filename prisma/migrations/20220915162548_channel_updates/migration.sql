-- AlterTable
ALTER TABLE "Channel" ADD COLUMN     "blackListedTokens" TEXT[],
ADD COLUMN     "incomingTransfer" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "outGoingTransfer" BOOLEAN NOT NULL DEFAULT true;
