-- CreateTable
CREATE TABLE "PendingTransactions" (
    "id" SERIAL NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "telegramSentMessageId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,

    CONSTRAINT "PendingTransactions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PendingTransactions" ADD CONSTRAINT "PendingTransactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
