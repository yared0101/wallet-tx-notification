/*
  Warnings:

  - A unique constraint covering the columns `[transactionHash,accountId]` on the table `PendingTransactions` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "PendingTransactions_transactionHash_key";

-- CreateIndex
CREATE UNIQUE INDEX "PendingTransactions_transactionHash_accountId_key" ON "PendingTransactions"("transactionHash", "accountId");
