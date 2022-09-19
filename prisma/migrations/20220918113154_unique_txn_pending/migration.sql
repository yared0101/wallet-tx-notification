/*
  Warnings:

  - A unique constraint covering the columns `[transactionHash]` on the table `PendingTransactions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "PendingTransactions_transactionHash_key" ON "PendingTransactions"("transactionHash");
