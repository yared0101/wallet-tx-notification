-- CreateTable
CREATE TABLE "DeletedPendingTransactions" (
    "id" SERIAL NOT NULL,
    "transactionHash" TEXT NOT NULL,

    CONSTRAINT "DeletedPendingTransactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeletedPendingTransactions_transactionHash_key" ON "DeletedPendingTransactions"("transactionHash");
